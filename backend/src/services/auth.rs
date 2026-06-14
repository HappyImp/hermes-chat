use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::Utc;
use jsonwebtoken::{encode, EncodingKey, Header};
use sha2::{Sha256, Digest};
use uuid::Uuid;

use crate::db::DbPool;
use crate::errors::{AppError, AuthError};
use crate::middleware::auth::Claims;
use crate::models::user::{CreateUser, LoginUser, User, UserResponse};

#[derive(Clone)]
pub struct AuthService {
    jwt_secret: String,
    expires_in_hours: i64,
}

impl AuthService {
    pub fn new(jwt_secret: String, expires_in_hours: i64) -> Self {
        Self {
            jwt_secret,
            expires_in_hours,
        }
    }

    pub async fn register(&self, pool: &DbPool, input: CreateUser) -> Result<(UserResponse, String), AppError> {
        // 检查用户名是否存在
        let existing = sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE username = ?"
        )
        .bind(&input.username)
        .fetch_optional(pool)
        .await?;

        if existing.is_some() {
            return Err(AppError::Auth(AuthError::UserExists));
        }

        // 验证授权码
        let code_str = input.invitation_code.trim();
        if code_str.is_empty() {
            return Err(AppError::BadRequest("授权码不能为空".to_string()));
        }

        #[derive(sqlx::FromRow)]
        struct CodeRow {
            id: String,
            allowed_employees: String,
            max_uses: i32,
            used_count: i32,
            status: String,
            expires_at: Option<String>,
        }

        let code_row = sqlx::query_as::<_, CodeRow>(
            "SELECT id, allowed_employees, max_uses, used_count, status, expires_at FROM invitation_codes WHERE code = ?"
        )
        .bind(code_str)
        .fetch_optional(pool)
        .await?
        .ok_or(AppError::BadRequest("授权码无效或已过期".to_string()))?;

        // 检查状态
        if code_row.status != "active" {
            return Err(AppError::BadRequest("授权码无效或已过期".to_string()));
        }
        if code_row.used_count >= code_row.max_uses {
            return Err(AppError::BadRequest("授权码无效或已过期".to_string()));
        }
        // 检查过期
        if let Some(ref expires) = code_row.expires_at {
            if let Ok(exp) = chrono::DateTime::parse_from_rfc3339(expires) {
                if exp < chrono::Utc::now() {
                    return Err(AppError::BadRequest("授权码无效或已过期".to_string()));
                }
            }
        }

        // 创建用户
        let id = Uuid::new_v4().to_string();
        let password_hash = hash(&input.password, DEFAULT_COST)
            .map_err(|_| AppError::Auth(AuthError::PasswordHashError))?;
        let now = Utc::now().to_rfc3339();

        sqlx::query(
            "INSERT INTO users (id, username, password_hash, role, enabled, created_at, updated_at) VALUES (?, ?, ?, 'user', 1, ?, ?)"
        )
        .bind(&id)
        .bind(&input.username)
        .bind(&password_hash)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        // 继承授权码的员工权限
        let employees: Vec<String> = serde_json::from_str(&code_row.allowed_employees)
            .unwrap_or_default();

        for emp in &employees {
            let perm_id = Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO permissions (id, user_id, employee, allowed) VALUES (?, ?, ?, 1)"
            )
            .bind(&perm_id)
            .bind(&id)
            .bind(emp)
            .execute(pool)
            .await?;
        }

        // 更新授权码状态
        let new_status = if code_row.used_count + 1 >= code_row.max_uses { "used" } else { "active" };
        sqlx::query(
            "UPDATE invitation_codes SET used_count = used_count + 1, used_by = ?, status = ? WHERE id = ?"
        )
        .bind(&id)
        .bind(new_status)
        .bind(&code_row.id)
        .execute(pool)
        .await?;

        // 生成 token
        let token = self.generate_token(&id, "user")?;

        let user = UserResponse {
            id,
            username: input.username,
            role: "user".to_string(),
            created_at: now,
        };

        Ok((user, token))
    }

    pub async fn login(&self, pool: &DbPool, input: LoginUser) -> Result<String, AppError> {
        let user = sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE username = ?"
        )
        .bind(&input.username)
        .fetch_optional(pool)
        .await?
        .ok_or(AppError::Auth(AuthError::UserNotFound))?;

        // 检查用户是否被禁用
        if user.enabled == 0 {
            return Err(AppError::Auth(AuthError::UserNotFound));
        }

        let valid = verify(&input.password, &user.password_hash)
            .map_err(|_| AppError::Auth(AuthError::PasswordHashError))?;

        if !valid {
            return Err(AppError::Auth(AuthError::WrongPassword));
        }

        let token = self.generate_token(&user.id, &user.role)?;
        Ok(token)
    }

    /// 将 token 加入黑名单，使其服务端失效
    pub async fn logout(&self, pool: &DbPool, token: &str, user_id: &str, exp: usize) -> Result<(), AppError> {
        let token_hash = Self::hash_token(token);
        let expires_at = chrono::DateTime::from_timestamp(exp as i64, 0)
            .map(|dt| dt.to_rfc3339())
            .unwrap_or_else(|| "2099-01-01T00:00:00Z".to_string());

        sqlx::query(
            "INSERT OR IGNORE INTO token_blacklist (token_hash, user_id, expires_at) VALUES (?, ?, ?)"
        )
        .bind(&token_hash)
        .bind(user_id)
        .bind(&expires_at)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// 检查 token 是否在黑名单中
    pub async fn is_token_blacklisted(&self, pool: &DbPool, token: &str) -> Result<bool, AppError> {
        let token_hash = Self::hash_token(token);

        let result = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM token_blacklist WHERE token_hash = ?"
        )
        .bind(&token_hash)
        .fetch_one(pool)
        .await?;

        Ok(result > 0)
    }

    /// 清理过期的黑名单记录（可由定时任务调用）
    #[allow(dead_code)]
    pub async fn cleanup_expired_blacklist(&self, pool: &DbPool) -> Result<u64, AppError> {
        let now = Utc::now().to_rfc3339();
        let result = sqlx::query(
            "DELETE FROM token_blacklist WHERE expires_at < ?"
        )
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(result.rows_affected())
    }

    pub fn generate_token(&self, user_id: &str, role: &str) -> Result<String, AppError> {
        let exp = Utc::now()
            + chrono::Duration::hours(self.expires_in_hours);

        let claims = Claims {
            sub: user_id.to_string(),
            role: role.to_string(),
            exp: exp.timestamp() as usize,
        };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.jwt_secret.as_bytes()),
        )
        .map_err(|_| AppError::Internal("Token 生成失败".to_string()))
    }

    /// SHA-256 哈希 token，不存储原始 token
    fn hash_token(token: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(token.as_bytes());
        format!("{:x}", hasher.finalize())
    }
}
