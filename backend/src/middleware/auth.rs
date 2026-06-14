use axum::{
    async_trait,
    extract::FromRequestParts,
    http::request::Parts,
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};

use crate::errors::{AppError, AuthError};

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

/// 读取 JWT_SECRET 环境变量，未设置时 panic
fn get_jwt_secret() -> String {
    std::env::var("JWT_SECRET")
        .expect("JWT_SECRET 环境变量未设置，无法启动服务")
}

/// 从请求中提取并验证 JWT Claims
fn extract_claims(parts: &Parts) -> Result<Claims, AppError> {
    let token = parts
        .headers
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(AppError::Auth(AuthError::MissingToken))?;

    let secret = get_jwt_secret();

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )
    .map_err(|_| AppError::Auth(AuthError::InvalidToken))?;

    Ok(token_data.claims)
}

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let claims = extract_claims(parts)?;

        Ok(AuthUser {
            user_id: claims.sub,
            role: claims.role,
        })
    }
}

/// 管理员提取器 — 同时验证 JWT 和 admin 角色
#[derive(Clone)]
pub struct AdminUser {
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
    mut req: axum::extract::Request,
    next: Next,
) -> Result<Response, AppError> {
    let token = req
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(AppError::Auth(AuthError::MissingToken))?;

    let secret = get_jwt_secret();

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )
    .map_err(|_| AppError::Auth(AuthError::InvalidToken))?;

    req.extensions_mut().insert(AuthUser {
        user_id: token_data.claims.sub,
        role: token_data.claims.role,
    });

    Ok(next.run(req).await)
}