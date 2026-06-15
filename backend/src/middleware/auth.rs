use axum::{
    async_trait, extract::FromRequestParts, http::request::Parts, middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};

use crate::errors::{AppError, AuthError};
use crate::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub role: String,
    pub exp: usize,
}

#[derive(Clone)]
pub struct AuthUser {
    pub user_id: String,
    pub role: String,
}

/// AuthUser 从 extensions 中提取（由 auth_middleware 注入）
#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<AuthUser>()
            .cloned()
            .ok_or(AppError::Auth(AuthError::MissingToken))
    }
}

/// 管理员提取器 — 从 extensions 提取 AuthUser 并验证 admin 角色
#[derive(Clone)]
pub struct AdminUser {
    #[allow(dead_code)]
    pub user_id: String,
}

#[async_trait]
impl<S> FromRequestParts<S> for AdminUser
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let auth = AuthUser::from_request_parts(parts, state).await?;

        if auth.role != "admin" {
            return Err(AppError::Forbidden("需要管理员权限".to_string()));
        }

        Ok(AdminUser {
            user_id: auth.user_id,
        })
    }
}

pub async fn auth_middleware(
    axum::extract::State(state): axum::extract::State<AppState>,
    mut req: axum::extract::Request,
    next: Next,
) -> Result<Response, AppError> {
    let (token, claims) = {
        let token = req
            .headers()
            .get("Authorization")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .ok_or(AppError::Auth(AuthError::MissingToken))?;

        let claims = decode::<Claims>(
            token,
            &DecodingKey::from_secret(state.jwt_secret.as_bytes()),
            &Validation::new(Algorithm::HS256),
        )
        .map_err(|_| AppError::Auth(AuthError::InvalidToken))?
        .claims;

        (token.to_string(), claims)
    };

    // 检查 token 是否在黑名单中（已登出）
    if state
        .auth_service
        .is_token_blacklisted(&state.pool, &token)
        .await?
    {
        return Err(AppError::Auth(AuthError::InvalidToken));
    }

    // 检查用户是否被禁用
    let enabled: i32 = sqlx::query_scalar("SELECT enabled FROM users WHERE id = ?")
        .bind(&claims.sub)
        .fetch_optional(&state.pool)
        .await?
        .unwrap_or(0);

    if enabled == 0 {
        return Err(AppError::Auth(AuthError::AccountDisabled));
    }

    req.extensions_mut().insert(AuthUser {
        user_id: claims.sub,
        role: claims.role,
    });

    Ok(next.run(req).await)
}
