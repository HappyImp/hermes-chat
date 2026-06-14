use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::Utc;
use jsonwebtoken::{encode, EncodingKey, Header};
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

        // 创建用户
        let id = Uuid::new_v4().to_string();
        let password_hash = hash(&input.password, DEFAULT_COST)
            .map_err(|_| AppError::Auth(AuthError::PasswordHashError))?;
        let now = Utc::now().to_rfc3339();

        sqlx::query(
            "INSERT INTO users (id, username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, 'user', ?, ?)"
        )
        .bind(&id)
        .bind(&input.username)
        .bind(&password_hash)
        .bind(&now)
        .bind(&now)
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

        let valid = verify(&input.password, &user.password_hash)
            .map_err(|_| AppError::Auth(AuthError::PasswordHashError))?;

        if !valid {
            return Err(AppError::Auth(AuthError::WrongPassword));
        }

        let token = self.generate_token(&user.id, &user.role)?;
        Ok(token)
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
}