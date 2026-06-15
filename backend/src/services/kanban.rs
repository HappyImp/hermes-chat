use serde_json::Value;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

use crate::db::DbPool;
use crate::errors::AppError;
use crate::models::kanban::{EmployeeInfo, KanbanTask};
use crate::models::permission::TenantPermission;

const HERMES_BIN: &str = "/opt/hermes/.venv/bin/hermes";
const CACHE_TTL: Duration = Duration::from_secs(300);

/// 员工缓存：(最后刷新时间, 数据)
type EmployeeCache = Arc<RwLock<Option<(Instant, Vec<EmployeeInfo>)>>>;

#[derive(Clone)]
pub struct KanbanService {
    employee_cache: EmployeeCache,
    #[allow(dead_code)]
    kanban_pool: Option<DbPool>,
}

impl Default for KanbanService {
    fn default() -> Self {
        Self::new()
    }
}

impl KanbanService {
    pub fn new() -> Self {
        Self {
            employee_cache: Arc::new(RwLock::new(None)),
            kanban_pool: None,
        }
    }

    pub fn with_kanban_pool(pool: DbPool) -> Self {
        Self {
            employee_cache: Arc::new(RwLock::new(None)),
            kanban_pool: Some(pool),
        }
    }

    /// 查询看板任务列表
    /// 先返回 stub 数据，后续对接 hermes kanban CLI
    pub async fn list_tasks(&self, _tenant_id: &str) -> Result<Vec<KanbanTask>, AppError> {
        // TODO: 对接 hermes kanban list --tenant <tenant_id> --json
        Ok(vec![])
    }

    /// 🔴1: 从 CLI 获取任务列表 JSON（供 WS 事件轮询使用）
    ///
    /// 执行 `hermes kanban list --json --tenant <tenant_id>`，返回原始 JSON 数组。
    /// 失败时返回空数组（降级），不中断 WS 连接。
    pub async fn list_tasks_json(&self, tenant_id: &str) -> Result<Vec<Value>, AppError> {
        let tenant_id = tenant_id.to_string();

        let result = tokio::task::spawn_blocking(move || {
            let output = std::process::Command::new(HERMES_BIN)
                .args(["kanban", "list", "--json", "--tenant", &tenant_id])
                .output();

            match output {
                Ok(o) if o.status.success() => {
                    let stdout = String::from_utf8_lossy(&o.stdout);
                    match serde_json::from_str::<Value>(&stdout) {
                        Ok(Value::Array(arr)) => Ok(arr),
                        Ok(_) => Ok(vec![]),
                        Err(e) => {
                            // 🔴4: 原始错误记日志，返回通用错误
                            tracing::error!("kanban list JSON 解析失败: {}", e);
                            Err(AppError::Internal("服务暂时不可用，请稍后重试".to_string()))
                        }
                    }
                }
                Ok(o) => {
                    let stderr = String::from_utf8_lossy(&o.stderr);
                    tracing::error!("kanban list CLI 执行失败: {}", stderr);
                    Err(AppError::Internal("服务暂时不可用，请稍后重试".to_string()))
                }
                Err(e) => {
                    tracing::error!("kanban list CLI 启动失败: {}", e);
                    Err(AppError::Internal("服务暂时不可用，请稍后重试".to_string()))
                }
            }
        })
        .await
        .map_err(|e| {
            tracing::error!("kanban list spawn_blocking 失败: {}", e);
            AppError::Internal("服务暂时不可用，请稍后重试".to_string())
        })?;

        result
    }

    /// 查询单个任务详情（必须传 tenant_id 做隔离）
    pub async fn get_task(&self, task_id: &str, tenant_id: &str) -> Result<Value, AppError> {
        let task_id = task_id.to_string();
        let tenant_id = tenant_id.to_string();

        let result = tokio::task::spawn_blocking(move || {
            let output = std::process::Command::new(HERMES_BIN)
                .args(["kanban", "show", &task_id, "--json"])
                .output();

            match output {
                Ok(o) if o.status.success() => {
                    let stdout = String::from_utf8_lossy(&o.stdout);
                    match serde_json::from_str::<Value>(&stdout) {
                        Ok(v) => Ok(v),
                        Err(e) => {
                            // 🔴4: 原始错误记日志
                            tracing::error!("kanban show JSON 解析失败: {}", e);
                            Err(AppError::Internal("服务暂时不可用，请稍后重试".to_string()))
                        }
                    }
                }
                Ok(o) => {
                    let stderr = String::from_utf8_lossy(&o.stderr);
                    // 判断是否是任务不存在
                    if stderr.contains("not found")
                        || stderr.contains("不存在")
                        || o.status.code() == Some(1)
                    {
                        Err(AppError::NotFound("任务不存在".to_string()))
                    } else {
                        // 🔴4: 原始错误记日志，返回通用消息
                        tracing::error!("kanban show CLI 执行失败: {}", stderr);
                        Err(AppError::Internal("服务暂时不可用，请稍后重试".to_string()))
                    }
                }
                Err(e) => {
                    // 🔴4: 原始错误记日志
                    tracing::error!("kanban show CLI 启动失败: {}", e);
                    Err(AppError::Internal("服务暂时不可用，请稍后重试".to_string()))
                }
            }
        })
        .await
        .map_err(|e| {
            tracing::error!("kanban show spawn_blocking 失败: {}", e);
            AppError::Internal("服务暂时不可用，请稍后重试".to_string())
        })?;

        let data = result?;

        // 验证 tenant 隔离：task.tenant 存在时必须匹配
        if let Some(task_tenant) = data.get("task").and_then(|t| t.get("tenant")) {
            if !task_tenant.is_null() {
                if let Some(t) = task_tenant.as_str() {
                    if t != tenant_id {
                        return Err(AppError::Forbidden(
                            "无权访问该任务：tenant 不匹配".to_string(),
                        ));
                    }
                }
            }
        }

        Ok(data)
    }

    /// 查询看板统计（必须传 tenant_id 做隔离）
    /// 🟡5: 传递 --tenant 参数给 CLI
    pub async fn get_stats(&self, tenant_id: &str) -> Result<Value, AppError> {
        let tenant_id = tenant_id.to_string();

        let result = tokio::task::spawn_blocking(move || {
            let output = std::process::Command::new(HERMES_BIN)
                .args(["kanban", "stats", "--json", "--tenant", &tenant_id])
                .output();

            match output {
                Ok(o) if o.status.success() => {
                    let stdout = String::from_utf8_lossy(&o.stdout);
                    match serde_json::from_str::<Value>(&stdout) {
                        Ok(v) => Ok(v),
                        Err(e) => {
                            // 🔴4: 原始错误记日志
                            tracing::error!("kanban stats JSON 解析失败: {}", e);
                            Err(AppError::Internal("服务暂时不可用，请稍后重试".to_string()))
                        }
                    }
                }
                Ok(o) => {
                    let stderr = String::from_utf8_lossy(&o.stderr);
                    tracing::error!("kanban stats CLI 执行失败: {}", stderr);
                    Err(AppError::Internal("服务暂时不可用，请稍后重试".to_string()))
                }
                Err(e) => {
                    tracing::error!("kanban stats CLI 启动失败: {}", e);
                    Err(AppError::Internal("服务暂时不可用，请稍后重试".to_string()))
                }
            }
        })
        .await
        .map_err(|e| {
            tracing::error!("kanban stats spawn_blocking 失败: {}", e);
            AppError::Internal("服务暂时不可用，请稍后重试".to_string())
        })?;

        result
    }

    // ==================== KAN-205: 员工列表 ====================

    /// 查询员工列表（从 hermes profiles + kanban assignees 推导）
    /// 缓存 5 分钟，CLI 失败时降级返回空列表
    pub async fn get_employees(
        &self,
        pool: &DbPool,
        tenant_id: &str,
    ) -> Result<Vec<EmployeeInfo>, AppError> {
        // 检查缓存
        {
            let cache = self.employee_cache.read().await;
            if let Some((ts, ref employees)) = *cache {
                if ts.elapsed() < CACHE_TTL {
                    return Ok(Self::filter_by_tenant(pool, employees, tenant_id).await);
                }
            }
        }

        // 缓存过期，重新获取
        let employees = Self::fetch_employees_from_cli().await;

        // 更新缓存
        {
            let mut cache = self.employee_cache.write().await;
            *cache = Some((Instant::now(), employees.clone()));
        }

        Ok(Self::filter_by_tenant(pool, &employees, tenant_id).await)
    }

    /// 从 hermes CLI 获取员工列表
    async fn fetch_employees_from_cli() -> Vec<EmployeeInfo> {
        match tokio::task::spawn_blocking(|| {
            // 执行 hermes profile list
            let output = match std::process::Command::new(HERMES_BIN)
                .args(["profile", "list"])
                .output()
            {
                Ok(o) if o.status.success() => o,
                Ok(o) => {
                    tracing::warn!(
                        "hermes profile list 失败: {}",
                        String::from_utf8_lossy(&o.stderr)
                    );
                    return vec![];
                }
                Err(e) => {
                    tracing::warn!("hermes profile list 执行失败: {}", e);
                    return vec![];
                }
            };

            let stdout = String::from_utf8_lossy(&output.stdout);
            let mut employees = Vec::new();

            for line in stdout.lines().skip(2) {
                let trimmed = line.trim();
                if trimmed.is_empty() || trimmed.starts_with('─') {
                    continue;
                }

                // 解析 profile 名称（第一个非空字段，去掉 ◆ 前缀）
                let name = trimmed
                    .split_whitespace()
                    .next()
                    .unwrap_or("")
                    .trim_start_matches('◆')
                    .to_string();

                if name.is_empty() {
                    continue;
                }

                // 默认 profile 不算员工，跳过
                if name == "default" {
                    continue;
                }

                // 从 gateway 列推断状态
                let status = if trimmed.contains("running") {
                    "working"
                } else {
                    "standby"
                };

                // 获取角色描述
                let role = Self::get_profile_description(&name);

                employees.push(EmployeeInfo {
                    name,
                    role: role.unwrap_or_else(|| "员工".to_string()),
                    status: status.to_string(),
                });
            }

            employees
        })
        .await
        {
            Ok(v) => v,
            Err(e) => {
                tracing::warn!("spawn_blocking 失败: {}", e);
                vec![]
            }
        }
    }

    /// 获取 profile 描述（同步 CLI 调用，仅在 spawn_blocking 中使用）
    fn get_profile_description(name: &str) -> Option<String> {
        std::process::Command::new(HERMES_BIN)
            .args(["profile", "describe", name])
            .output()
            .ok()
            .filter(|o| o.status.success())
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .filter(|s| !s.is_empty())
    }

    /// 按 tenant 过滤员工：查询 permissions 表获取该 tenant 允许的员工名
    /// 返回 employees 中 name 在允许列表里的子集
    /// 若 permissions 表无该 tenant 的记录，返回空列表（严格隔离）
    pub async fn filter_by_tenant(
        pool: &DbPool,
        employees: &[EmployeeInfo],
        tenant_id: &str,
    ) -> Vec<EmployeeInfo> {
        let allowed_names: std::collections::HashSet<String> = match sqlx::query_as::<_, (String,)>(
            "SELECT DISTINCT employee FROM permissions WHERE tenant = ? AND allowed = 1",
        )
        .bind(tenant_id)
        .fetch_all(pool)
        .await
        {
            Ok(rows) => rows.into_iter().map(|(name,)| name).collect(),
            Err(e) => {
                tracing::warn!("查询 tenant 权限失败: {}，返回空列表", e);
                return vec![];
            }
        };

        employees
            .iter()
            .filter(|emp| allowed_names.contains(&emp.name))
            .cloned()
            .collect()
    }

    // ==================== KAN-207: 权限模型 ====================

    /// 查询用户拥有的所有 tenant 权限
    pub async fn get_user_tenants(
        pool: &DbPool,
        user_id: &str,
    ) -> Result<Vec<TenantPermission>, AppError> {
        let rows: Vec<TenantPermission> = sqlx::query_as(
            "SELECT id, user_id, tenant_id, created_at FROM user_tenants WHERE user_id = ?",
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?;

        Ok(rows)
    }

    /// 检查用户是否有某 tenant 的访问权限
    pub async fn check_tenant_access(
        pool: &DbPool,
        user_id: &str,
        tenant_id: &str,
    ) -> Result<bool, AppError> {
        let exists: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM user_tenants WHERE user_id = ? AND tenant_id = ? LIMIT 1",
        )
        .bind(user_id)
        .bind(tenant_id)
        .fetch_optional(pool)
        .await?;

        Ok(exists.is_some())
    }

    /// 从 user_tenants 表查询用户的 tenant_id
    pub async fn get_tenant_for_user(pool: &DbPool, user_id: &str) -> Result<String, AppError> {
        let row: Option<(String,)> =
            sqlx::query_as("SELECT tenant_id FROM user_tenants WHERE user_id = ? LIMIT 1")
                .bind(user_id)
                .fetch_optional(pool)
                .await?;

        Ok(row.map(|(t,)| t).unwrap_or_else(|| "default".to_string()))
    }
}
