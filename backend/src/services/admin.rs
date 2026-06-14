use chrono::{Duration, Utc};
use serde::Deserialize;
use uuid::Uuid;

use crate::db::DbPool;
use crate::errors::AppError;
use crate::models::invitation_code::{CreateInvitationCode, InvitationCode, InvitationCodeResponse};

#[derive(Clone)]
pub struct AdminService;

impl AdminService {
    pub fn new() -> Self {
        Self
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

        let expires_at = input.expires_in_hours.map(|h| {
            (Utc::now() + Duration::hours(h)).to_rfc3339()
        });

        let mut codes = Vec::new();
        let count = input.count.max(1);

        for _ in 0..count {
            let id = Uuid::new_v4().to_string();
            let code = Self::generate_code();

            sqlx::query(
                "INSERT INTO invitation_codes (id, code, allowed_employees, max_uses, status, created_by, expires_at, note)
                 VALUES (?, ?, ?, 1, 'active', ?, ?, ?)"
            )
            .bind(&id)
            .bind(&code)
            .bind(&employees_json)
            .bind(operator_id)
            .bind(&expires_at)
            .bind(&input.note)
            .execute(pool)
            .await?;

            // 审计日志
            self.log_audit(pool, operator_id, "create_code", "invitation_code", Some(&id), Some(&serde_json::json!({
                "code": code,
                "allowed_employees": input.allowed_employees
            }).to_string())).await?;

            let ic = sqlx::query_as::<_, InvitationCode>(
                "SELECT * FROM invitation_codes WHERE id = ?"
            )
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
                .fetch_one(pool).await?;
            let codes = sqlx::query_as::<_, InvitationCode>(
                "SELECT * FROM invitation_codes ORDER BY created_at DESC LIMIT ? OFFSET ?"
            )
            .bind(limit).bind(offset)
            .fetch_all(pool).await?;
            (total, codes)
        } else {
            let total: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM invitation_codes WHERE status = ?"
            )
            .bind(status)
            .fetch_one(pool).await?;
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
            "UPDATE invitation_codes SET status = 'disabled' WHERE id = ? AND status = 'active'"
        )
        .bind(code_id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound("授权码不存在或状态不是 active".to_string()));
        }

        self.log_audit(pool, operator_id, "disable_code", "invitation_code", Some(code_id), None).await?;
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

        self.log_audit(pool, operator_id, "delete_code", "invitation_code", Some(code_id), None).await?;
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
        let ic = sqlx::query_as::<_, InvitationCode>(
            "SELECT * FROM invitation_codes WHERE code = ?"
        )
        .bind(code)
        .fetch_optional(pool)
        .await?
        .ok_or(AppError::BadRequest("授权码无效或已过期".to_string()))?;

        if !ic.is_valid() {
            return Err(AppError::BadRequest("授权码无效或已过期".to_string()));
        }

        // 更新授权码状态
        let new_status = if ic.used_count + 1 >= ic.max_uses { "used" } else { "active" };
        sqlx::query(
            "UPDATE invitation_codes SET used_count = used_count + 1, used_by = ?, status = ? WHERE id = ?"
        )
        .bind(user_id)
        .bind(new_status)
        .bind(&ic.id)
        .execute(pool)
        .await?;

        // 解析员工列表
        let employees: Vec<String> = serde_json::from_str(&ic.allowed_employees)
            .unwrap_or_default();

        Ok(employees)
    }

    // ==================== 用户管理 ====================

    /// 用户列表（支持搜索和分页）
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

        #[derive(Deserialize, sqlx::FromRow)]
        struct UserRow {
            id: String,
            username: String,
            role: String,
            enabled: i32,
            created_at: String,
        }

        let users: Vec<UserRow> = if search.is_empty() {
            sqlx::query_as("SELECT id, username, role, enabled, created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?")
                .bind(limit)
                .bind(offset)
                .fetch_all(pool)
                .await?
        } else {
            sqlx::query_as("SELECT id, username, role, enabled, created_at FROM users WHERE username LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?")
                .bind(&search_pattern)
                .bind(limit)
                .bind(offset)
                .fetch_all(pool)
                .await?
        };

        let mut user_list = Vec::new();
        for u in users {
            // 查注册授权码
            let invitation_code: Option<String> = sqlx::query_scalar(
                "SELECT code FROM invitation_codes WHERE used_by = ? LIMIT 1"
            )
            .bind(&u.id)
            .fetch_optional(pool)
            .await?;

            // 查权限列表
            let employees: Vec<String> = sqlx::query_scalar(
                "SELECT employee FROM permissions WHERE user_id = ? AND allowed = 1"
            )
            .bind(&u.id)
            .fetch_all(pool)
            .await?;

            user_list.push(serde_json::json!({
                "id": u.id,
                "username": u.username,
                "role": u.role,
                "enabled": u.enabled == 1,
                "created_at": u.created_at,
                "invitation_code": invitation_code,
                "allowed_employees": employees
            }));
        }

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
            "SELECT id, username, role, enabled, created_at FROM users WHERE id = ?"
        )
        .bind(user_id)
        .fetch_optional(pool)
        .await?
        .ok_or(AppError::NotFound("用户不存在".to_string()))?;

        let invitation_code: Option<String> = sqlx::query_scalar(
            "SELECT code FROM invitation_codes WHERE used_by = ? LIMIT 1"
        )
        .bind(user_id)
        .fetch_optional(pool)
        .await?;

        let employees: Vec<String> = sqlx::query_scalar(
            "SELECT employee FROM permissions WHERE user_id = ? AND allowed = 1"
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?;

        let session_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM sessions WHERE user_id = ? AND deleted_at IS NULL"
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
            "allowed_employees": employees,
            "session_count": session_count,
            "last_active": last_active
        }))
    }

    /// 修改用户权限
    pub async fn update_user_permissions(
        &self,
        pool: &DbPool,
        operator_id: &str,
        user_id: &str,
        employees: Vec<String>,
    ) -> Result<(), AppError> {
        // 删除旧权限
        sqlx::query("DELETE FROM permissions WHERE user_id = ?")
            .bind(user_id)
            .execute(pool)
            .await?;

        // 写入新权限
        for emp in &employees {
            let id = Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO permissions (id, user_id, employee, allowed) VALUES (?, ?, ?, 1)"
            )
            .bind(&id)
            .bind(user_id)
            .bind(emp)
            .execute(pool)
            .await?;
        }

        self.log_audit(pool, operator_id, "modify_permission", "user", Some(user_id), Some(&serde_json::json!({
            "allowed_employees": employees
        }).to_string())).await?;

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

        let action = if enabled { "enable_user" } else { "disable_user" };
        self.log_audit(pool, operator_id, action, "user", Some(user_id), None).await?;
        Ok(())
    }

    /// 删除用户（级联删除会话、消息、权限、授权码使用记录）
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

        // 级联删除
        sqlx::query("DELETE FROM messages WHERE session_id IN (SELECT id FROM sessions WHERE user_id = ?)")
            .bind(user_id).execute(pool).await?;
        sqlx::query("DELETE FROM sessions WHERE user_id = ?")
            .bind(user_id).execute(pool).await?;
        sqlx::query("DELETE FROM permissions WHERE user_id = ?")
            .bind(user_id).execute(pool).await?;
        sqlx::query("UPDATE invitation_codes SET used_by = NULL WHERE used_by = ?")
            .bind(user_id).execute(pool).await?;
        sqlx::query("DELETE FROM token_blacklist WHERE user_id = ?")
            .bind(user_id).execute(pool).await?;
        sqlx::query("DELETE FROM users WHERE id = ?")
            .bind(user_id).execute(pool).await?;

        self.log_audit(pool, operator_id, "delete_user", "user", Some(user_id), None).await?;
        Ok(())
    }

    // ==================== 仪表盘 ====================

    pub async fn dashboard_stats(&self, pool: &DbPool) -> Result<serde_json::Value, AppError> {
        let total_users: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
            .fetch_one(pool).await?;

        let today = Utc::now().format("%Y-%m-%d").to_string();
        let today_new: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM users WHERE created_at >= ?"
        )
        .bind(&today)
        .fetch_one(pool).await?;

        let active_codes: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM invitation_codes WHERE status = 'active'"
        )
        .fetch_one(pool).await?;

        let used_codes: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM invitation_codes WHERE status = 'used'"
        )
        .fetch_one(pool).await?;

        let yesterday = (Utc::now() - Duration::hours(24)).to_rfc3339();
        let active_sessions: i64 = sqlx::query_scalar(
            "SELECT COUNT(DISTINCT session_id) FROM messages WHERE created_at >= ?"
        )
        .bind(&yesterday)
        .fetch_one(pool).await?;

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

    // ==================== 授权码生成 ====================

    fn generate_code() -> String {
        // 字符集: 大写字母 + 数字（排除易混淆字符 O/0/I/1/L）
        let chars: Vec<char> = "ABCDEFGHJKMNPQRSTUVWXYZ23456789".chars().collect();
        use rand::Rng;
        let mut rng = rand::thread_rng();
        let part1: String = (0..4).map(|_| chars[rng.gen_range(0..chars.len())]).collect();
        let part2: String = (0..4).map(|_| chars[rng.gen_range(0..chars.len())]).collect();
        format!("HC-{}-{}", part1, part2)
    }
}
