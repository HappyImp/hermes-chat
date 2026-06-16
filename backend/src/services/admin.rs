use chrono::{Duration, Utc};
use uuid::Uuid;

use crate::db::DbPool;
use crate::errors::AppError;
use crate::models::invitation_code::{
    CreateInvitationCode, InvitationCode, InvitationCodeResponse,
};
use crate::models::permission::TenantPermission;

#[derive(Clone)]
pub struct AdminService;

impl Default for AdminService {
    fn default() -> Self {
        Self
    }
}

impl AdminService {
    pub fn new() -> Self {
        Self
    }

    // ==================== Tenant 管理 ====================

    /// 列出系统中所有 tenant（去重）
    pub async fn list_all_tenants(&self, pool: &DbPool) -> Result<Vec<String>, AppError> {
        let rows: Vec<(String,)> = sqlx::query_as(
            "SELECT DISTINCT tenant_id FROM user_tenants ORDER BY tenant_id",
        )
        .fetch_all(pool)
        .await?;

        let mut tenants: Vec<String> = rows.into_iter().map(|(t,)| t).collect();

        // 确保 default 始终存在
        if !tenants.iter().any(|t| t == "default") {
            tenants.insert(0, "default".to_string());
        }

        Ok(tenants)
    }

    /// 获取用户所属的 tenant 列表
    pub async fn get_user_tenants(
        &self,
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

    /// 更新用户的 tenant 映射（整体替换）
    pub async fn update_user_tenants(
        &self,
        pool: &DbPool,
        operator_id: &str,
        user_id: &str,
        tenant_ids: Vec<String>,
    ) -> Result<(), AppError> {
        if tenant_ids.is_empty() {
            return Err(AppError::BadRequest("至少分配一个 tenant".to_string()));
        }

        let mut tx = pool.begin().await?;

        // 删除旧的 tenant 映射
        sqlx::query("DELETE FROM user_tenants WHERE user_id = ?")
            .bind(user_id)
            .execute(&mut *tx)
            .await?;

        // 插入新的 tenant 映射
        for tenant_id in &tenant_ids {
            let id = Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO user_tenants (id, user_id, tenant_id) VALUES (?, ?, ?)",
            )
            .bind(&id)
            .bind(user_id)
            .bind(tenant_id)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;

        // 审计日志
        self.log_audit(
            pool,
            operator_id,
            "update_user_tenants",
            "user",
            Some(user_id),
            Some(&serde_json::json!({ "tenants": tenant_ids }).to_string()),
        )
        .await?;

        Ok(())
    }

    // ==================== 授权码管理 ====================

    /// 生成授权码
    pub async fn create_invitation_codes(
        &self,
        pool: &DbPool,
        operator_id: &str,
        input: CreateInvitationCode,
    ) -> Result<Vec<InvitationCodeResponse>, AppError> {
        if input.allowed_employees.is_empty() {
            return Err(AppError::BadRequest("至少选择一个可用员工".to_string()));
        }

        let employees_json = serde_json::to_string(&input.allowed_employees)
            .map_err(|_| AppError::Internal("序列化员工列表失败".to_string()))?;

        // KAN-404: tenant 映射
        let tenants = input
            .allowed_tenants
            .unwrap_or_else(|| vec!["default".to_string()]);
        let tenants_json = serde_json::to_string(&tenants)
            .map_err(|_| AppError::Internal("序列化 tenant 列表失败".to_string()))?;

        let expires_at = input
            .expires_in_hours
            .map(|h| (Utc::now() + Duration::hours(h)).to_rfc3339());

        let mut codes = Vec::new();
        let count = input.count.max(1);

        for _ in 0..count {
            let id = Uuid::new_v4().to_string();
            let code = Self::generate_code();

            sqlx::query(
                "INSERT INTO invitation_codes (id, code, allowed_employees, allowed_tenants, max_uses, status, created_by, expires_at, note)
                 VALUES (?, ?, ?, ?, 1, 'active', ?, ?, ?)"
            )
            .bind(&id)
            .bind(&code)
            .bind(&employees_json)
            .bind(&tenants_json)
            .bind(operator_id)
            .bind(&expires_at)
            .bind(&input.note)
            .execute(pool)
            .await?;

            // 审计日志
            self.log_audit(
                pool,
                operator_id,
                "create_code",
                "invitation_code",
                Some(&id),
                Some(
                    &serde_json::json!({
                        "code": code,
                        "allowed_employees": input.allowed_employees,
                        "allowed_tenants": tenants
                    })
                    .to_string(),
                ),
            )
            .await?;

            let ic =
                sqlx::query_as::<_, InvitationCode>("SELECT * FROM invitation_codes WHERE id = ?")
                    .bind(&id)
                    .fetch_one(pool)
                    .await?;

            codes.push(ic.to_response());
        }

        Ok(codes)
    }

    /// 查询授权码列表
    pub async fn list_invitation_codes(
        &self,
        pool: &DbPool,
        status: &str,
        page: i32,
        limit: i32,
    ) -> Result<serde_json::Value, AppError> {
        let offset = (page - 1) * limit;

        let (total, codes) = if status == "all" {
            let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM invitation_codes")
                .fetch_one(pool)
                .await?;
            let codes = sqlx::query_as::<_, InvitationCode>(
                "SELECT * FROM invitation_codes ORDER BY created_at DESC LIMIT ? OFFSET ?",
            )
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await?;
            (total, codes)
        } else {
            let total: i64 =
                sqlx::query_scalar("SELECT COUNT(*) FROM invitation_codes WHERE status = ?")
                    .bind(status)
                    .fetch_one(pool)
                    .await?;
            let codes = sqlx::query_as::<_, InvitationCode>(
                "SELECT * FROM invitation_codes WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
            )
            .bind(status).bind(limit).bind(offset)
            .fetch_all(pool).await?;
            (total, codes)
        };

        let code_list: Vec<serde_json::Value> = codes
            .iter()
            .map(|c| serde_json::to_value(c.to_response()).unwrap_or_default())
            .collect();

        Ok(serde_json::json!({
            "total": total,
            "page": page,
            "limit": limit,
            "codes": code_list
        }))
    }

    /// 禁用授权码
    pub async fn disable_invitation_code(
        &self,
        pool: &DbPool,
        operator_id: &str,
        code_id: &str,
    ) -> Result<(), AppError> {
        let result = sqlx::query(
            "UPDATE invitation_codes SET status = 'disabled' WHERE id = ? AND status = 'active'",
        )
        .bind(code_id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound(
                "授权码不存在或状态不是 active".to_string(),
            ));
        }

        self.log_audit(
            pool,
            operator_id,
            "disable_code",
            "invitation_code",
            Some(code_id),
            None,
        )
        .await?;
        Ok(())
    }

    /// 删除授权码
    pub async fn delete_invitation_code(
        &self,
        pool: &DbPool,
        operator_id: &str,
        code_id: &str,
    ) -> Result<(), AppError> {
        let result = sqlx::query("DELETE FROM invitation_codes WHERE id = ?")
            .bind(code_id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound("授权码不存在".to_string()));
        }

        self.log_audit(
            pool,
            operator_id,
            "delete_code",
            "invitation_code",
            Some(code_id),
            None,
        )
        .await?;
        Ok(())
    }

    /// 验证并使用授权码（注册时调用）
    #[allow(dead_code)]
    pub async fn validate_and_use_code(
        &self,
        pool: &DbPool,
        code: &str,
        user_id: &str,
    ) -> Result<Vec<String>, AppError> {
        let ic =
            sqlx::query_as::<_, InvitationCode>("SELECT * FROM invitation_codes WHERE code = ?")
                .bind(code)
                .fetch_optional(pool)
                .await?
                .ok_or(AppError::BadRequest("授权码无效或已过期".to_string()))?;

        if !ic.is_valid() {
            return Err(AppError::BadRequest("授权码无效或已过期".to_string()));
        }

        // 更新授权码状态
        let new_status = if ic.used_count + 1 >= ic.max_uses {
            "used"
        } else {
            "active"
        };
        sqlx::query(
            "UPDATE invitation_codes SET used_count = used_count + 1, used_by = ?, status = ? WHERE id = ?"
        )
        .bind(user_id)
        .bind(new_status)
        .bind(&ic.id)
        .execute(pool)
        .await?;

        // 解析员工列表
        let employees: Vec<String> =
            serde_json::from_str(&ic.allowed_employees).unwrap_or_default();

        Ok(employees)
    }

    // ==================== 用户管理 ====================

    /// 用户列表（支持搜索和分页）— 返回 tenant 映射而非员工权限
    pub async fn list_users(
        &self,
        pool: &DbPool,
        search: &str,
        page: i32,
        limit: i32,
    ) -> Result<serde_json::Value, AppError> {
        let offset = (page - 1) * limit;
        let search_pattern = format!("%{}%", search);

        let total: i64 = if search.is_empty() {
            sqlx::query_scalar("SELECT COUNT(*) FROM users")
                .fetch_one(pool)
                .await?
        } else {
            sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE username LIKE ?")
                .bind(&search_pattern)
                .fetch_one(pool)
                .await?
        };

        // 主查询：基本信息
        #[derive(sqlx::FromRow)]
        struct UserRow {
            id: String,
            username: String,
            role: String,
            enabled: i32,
            created_at: String,
            invitation_code: Option<String>,
        }

        let users: Vec<UserRow> = if search.is_empty() {
            sqlx::query_as(r#"
                SELECT u.id, u.username, u.role, u.enabled, u.created_at,
                    (SELECT ic.code FROM invitation_codes ic WHERE ic.used_by = u.id LIMIT 1) AS invitation_code
                FROM users u
                ORDER BY u.created_at DESC LIMIT ? OFFSET ?
            "#)
            .bind(limit).bind(offset)
            .fetch_all(pool).await?
        } else {
            sqlx::query_as(r#"
                SELECT u.id, u.username, u.role, u.enabled, u.created_at,
                    (SELECT ic.code FROM invitation_codes ic WHERE ic.used_by = u.id LIMIT 1) AS invitation_code
                FROM users u
                WHERE u.username LIKE ?
                ORDER BY u.created_at DESC LIMIT ? OFFSET ?
            "#)
            .bind(&search_pattern).bind(limit).bind(offset)
            .fetch_all(pool).await?
        };

        // 批量查询每个用户的 tenants（避免 N+1）
        let user_ids: Vec<&str> = users.iter().map(|u| u.id.as_str()).collect();
        let all_tenants: Vec<(String, String)> = if user_ids.is_empty() {
            vec![]
        } else {
            let placeholders = user_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
            let sql = format!(
                "SELECT user_id, tenant_id FROM user_tenants WHERE user_id IN ({})",
                placeholders
            );
            let mut query = sqlx::query_as::<_, (String, String)>(&sql);
            for uid in &user_ids {
                query = query.bind(uid);
            }
            query.fetch_all(pool).await?
        };

        // 按 user_id 分组
        let mut tenant_map: std::collections::HashMap<String, Vec<String>> =
            std::collections::HashMap::new();
        for (uid, tid) in all_tenants {
            tenant_map.entry(uid).or_default().push(tid);
        }

        let user_list: Vec<serde_json::Value> = users
            .iter()
            .map(|u| {
                let tenants = tenant_map.get(&u.id).cloned().unwrap_or_default();
                serde_json::json!({
                    "id": u.id,
                    "username": u.username,
                    "role": u.role,
                    "enabled": u.enabled == 1,
                    "created_at": u.created_at,
                    "invitation_code": u.invitation_code,
                    "tenants": tenants
                })
            })
            .collect();

        Ok(serde_json::json!({
            "total": total,
            "page": page,
            "limit": limit,
            "users": user_list
        }))
    }

    /// 用户详情
    pub async fn get_user_detail(
        &self,
        pool: &DbPool,
        user_id: &str,
    ) -> Result<serde_json::Value, AppError> {
        #[derive(sqlx::FromRow)]
        struct UserRow {
            id: String,
            username: String,
            role: String,
            enabled: i32,
            created_at: String,
        }

        let user = sqlx::query_as::<_, UserRow>(
            "SELECT id, username, role, enabled, created_at FROM users WHERE id = ?",
        )
        .bind(user_id)
        .fetch_optional(pool)
        .await?
        .ok_or(AppError::NotFound("用户不存在".to_string()))?;

        let invitation_code: Option<String> =
            sqlx::query_scalar("SELECT code FROM invitation_codes WHERE used_by = ? LIMIT 1")
                .bind(user_id)
                .fetch_optional(pool)
                .await?;

        // 查询用户所属 tenants
        let tenants: Vec<String> = sqlx::query_as::<_, (String,)>(
            "SELECT tenant_id FROM user_tenants WHERE user_id = ? ORDER BY tenant_id",
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?
        .into_iter()
        .map(|(t,)| t)
        .collect();

        let session_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM sessions WHERE user_id = ? AND deleted_at IS NULL",
        )
        .bind(user_id)
        .fetch_one(pool)
        .await?;

        let last_active: Option<String> = sqlx::query_scalar(
            "SELECT MAX(created_at) FROM messages WHERE session_id IN (SELECT id FROM sessions WHERE user_id = ?)"
        )
        .bind(user_id)
        .fetch_one(pool)
        .await?;

        Ok(serde_json::json!({
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "enabled": user.enabled == 1,
            "created_at": user.created_at,
            "invitation_code": invitation_code,
            "tenants": tenants,
            "session_count": session_count,
            "last_active": last_active
        }))
    }

    /// 修改用户权限（默认 tenant，向后兼容）
    pub async fn update_user_permissions(
        &self,
        pool: &DbPool,
        operator_id: &str,
        user_id: &str,
        employees: Vec<String>,
    ) -> Result<(), AppError> {
        self.update_user_permissions_for_tenant(pool, operator_id, user_id, employees, "default")
            .await
    }

    /// 修改用户权限（指定 tenant）
    pub async fn update_user_permissions_for_tenant(
        &self,
        pool: &DbPool,
        operator_id: &str,
        user_id: &str,
        employees: Vec<String>,
        tenant: &str,
    ) -> Result<(), AppError> {
        // 删除指定 tenant 的旧权限
        sqlx::query("DELETE FROM permissions WHERE user_id = ? AND tenant = ?")
            .bind(user_id)
            .bind(tenant)
            .execute(pool)
            .await?;

        // 写入新权限
        for emp in &employees {
            let id = Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO permissions (id, user_id, employee, tenant, allowed) VALUES (?, ?, ?, ?, 1)",
            )
            .bind(&id)
            .bind(user_id)
            .bind(emp)
            .bind(tenant)
            .execute(pool)
            .await?;
        }

        // 同步 user_tenants 映射
        sqlx::query("INSERT OR IGNORE INTO user_tenants (id, user_id, tenant_id) VALUES (?, ?, ?)")
            .bind(Uuid::new_v4().to_string())
            .bind(user_id)
            .bind(tenant)
            .execute(pool)
            .await?;

        self.log_audit(
            pool,
            operator_id,
            "modify_permission",
            "user",
            Some(user_id),
            Some(
                &serde_json::json!({
                    "allowed_employees": employees,
                    "tenant": tenant
                })
                .to_string(),
            ),
        )
        .await?;

        Ok(())
    }

    /// 禁用/启用用户
    pub async fn toggle_user_status(
        &self,
        pool: &DbPool,
        operator_id: &str,
        user_id: &str,
        enabled: bool,
    ) -> Result<(), AppError> {
        let enabled_val = if enabled { 1 } else { 0 };
        let result = sqlx::query("UPDATE users SET enabled = ? WHERE id = ?")
            .bind(enabled_val)
            .bind(user_id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound("用户不存在".to_string()));
        }

        let action = if enabled {
            "enable_user"
        } else {
            "disable_user"
        };
        self.log_audit(pool, operator_id, action, "user", Some(user_id), None)
            .await?;
        Ok(())
    }

    /// 删除用户（级联删除会话、消息、权限、授权码使用记录）— 事务保护
    pub async fn delete_user(
        &self,
        pool: &DbPool,
        operator_id: &str,
        user_id: &str,
    ) -> Result<(), AppError> {
        // 检查用户存在
        let exists: bool = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE id = ?")
            .bind(user_id)
            .fetch_one(pool)
            .await?;

        if !exists {
            return Err(AppError::NotFound("用户不存在".to_string()));
        }

        // 事务：级联删除（原子操作，失败全部回滚）
        let mut tx = pool.begin().await?;

        sqlx::query(
            "DELETE FROM messages WHERE session_id IN (SELECT id FROM sessions WHERE user_id = ?)",
        )
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
        sqlx::query("DELETE FROM sessions WHERE user_id = ?")
            .bind(user_id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM permissions WHERE user_id = ?")
            .bind(user_id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM user_tenants WHERE user_id = ?")
            .bind(user_id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("UPDATE invitation_codes SET used_by = NULL WHERE used_by = ?")
            .bind(user_id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM token_blacklist WHERE user_id = ?")
            .bind(user_id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM users WHERE id = ?")
            .bind(user_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;

        // 审计日志（事务外：operator_id 是管理员，不受删除影响）
        self.log_audit(
            pool,
            operator_id,
            "delete_user",
            "user",
            Some(user_id),
            None,
        )
        .await?;
        Ok(())
    }

    // ==================== 仪表盘 ====================

    pub async fn dashboard_stats(&self, pool: &DbPool) -> Result<serde_json::Value, AppError> {
        let total_users: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
            .fetch_one(pool)
            .await?;

        // 统一用 RFC3339 格式比较（与 created_at 存储格式一致）
        let today_start = Utc::now()
            .date_naive()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc()
            .to_rfc3339();
        let today_new: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE created_at >= ?")
            .bind(&today_start)
            .fetch_one(pool)
            .await?;

        let active_codes: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM invitation_codes WHERE status = 'active'")
                .fetch_one(pool)
                .await?;

        let used_codes: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM invitation_codes WHERE status = 'used'")
                .fetch_one(pool)
                .await?;

        let yesterday = (Utc::now() - Duration::hours(24)).to_rfc3339();
        let active_sessions: i64 = sqlx::query_scalar(
            "SELECT COUNT(DISTINCT session_id) FROM messages WHERE created_at >= ?",
        )
        .bind(&yesterday)
        .fetch_one(pool)
        .await?;

        Ok(serde_json::json!({
            "total_users": total_users,
            "today_new": today_new,
            "active_codes": active_codes,
            "used_codes": used_codes,
            "active_sessions": active_sessions
        }))
    }

    // ==================== 审计日志 ====================

    async fn log_audit(
        &self,
        pool: &DbPool,
        operator_id: &str,
        action: &str,
        target_type: &str,
        target_id: Option<&str>,
        detail: Option<&str>,
    ) -> Result<(), AppError> {
        let id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO audit_logs (id, operator_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(operator_id)
        .bind(action)
        .bind(target_type)
        .bind(target_id)
        .bind(detail)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// 查询审计日志（分页 + 筛选）
    #[allow(clippy::too_many_arguments)]
    pub async fn get_audit_logs(
        &self,
        pool: &DbPool,
        user_id: Option<&str>,
        action: Option<&str>,
        start_date: Option<&str>,
        end_date: Option<&str>,
        page: i32,
        per_page: i32,
    ) -> Result<serde_json::Value, AppError> {
        let offset = (page - 1) * per_page;

        // 动态拼接 WHERE 条件
        let mut conditions: Vec<String> = Vec::new();
        if user_id.is_some() {
            conditions.push("operator_id = ?".into());
        }
        if action.is_some() {
            conditions.push("action = ?".into());
        }
        if start_date.is_some() {
            conditions.push("created_at >= ?".into());
        }
        if end_date.is_some() {
            conditions.push("created_at <= ?".into());
        }

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        let count_sql = format!("SELECT COUNT(*) FROM audit_logs {}", where_clause);
        let query_sql = format!(
            "SELECT id, operator_id, action, target_type, target_id, detail, created_at FROM audit_logs {} ORDER BY created_at DESC LIMIT ? OFFSET ?",
            where_clause
        );

        // 绑定参数的闭包
        let mut count_query = sqlx::query_scalar::<_, i64>(&count_sql);
        if let Some(uid) = user_id {
            count_query = count_query.bind(uid);
        }
        if let Some(act) = action {
            count_query = count_query.bind(act);
        }
        if let Some(sd) = start_date {
            count_query = count_query.bind(sd);
        }
        if let Some(ed) = end_date {
            count_query = count_query.bind(ed);
        }

        let total: i64 = count_query.fetch_one(pool).await?;

        let mut data_query = sqlx::query_as::<_, crate::models::audit_log::AuditLog>(&query_sql);
        if let Some(uid) = user_id {
            data_query = data_query.bind(uid);
        }
        if let Some(act) = action {
            data_query = data_query.bind(act);
        }
        if let Some(sd) = start_date {
            data_query = data_query.bind(sd);
        }
        if let Some(ed) = end_date {
            data_query = data_query.bind(ed);
        }
        data_query = data_query.bind(per_page).bind(offset);

        let logs = data_query.fetch_all(pool).await?;

        let log_list: Vec<serde_json::Value> = logs
            .into_iter()
            .map(|l| {
                serde_json::json!({
                    "id": l.id,
                    "operator_id": l.operator_id,
                    "action": l.action,
                    "target_type": l.target_type,
                    "target_id": l.target_id,
                    "detail": l.detail,
                    "created_at": l.created_at,
                })
            })
            .collect();

        Ok(serde_json::json!({
            "total": total,
            "page": page,
            "per_page": per_page,
            "logs": log_list
        }))
    }

    // ==================== 授权码生成 ====================

    fn generate_code() -> String {
        // 字符集: 大写字母 + 数字（排除易混淆字符 O/0/I/1/L）
        let chars: Vec<char> = "ABCDEFGHJKMNPQRSTUVWXYZ23456789".chars().collect();
        use rand::Rng;
        let mut rng = rand::thread_rng();
        let part1: String = (0..4)
            .map(|_| chars[rng.gen_range(0..chars.len())])
            .collect();
        let part2: String = (0..4)
            .map(|_| chars[rng.gen_range(0..chars.len())])
            .collect();
        format!("HC-{}-{}", part1, part2)
    }
}
