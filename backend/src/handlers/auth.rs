use axum::{extract::State, http::StatusCode, Json};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde_json::{json, Value};

use crate::AppState;
use crate::errors::{AppError, AuthError};
use crate::middleware::auth::{AuthUser, Claims};
use crate::models::user::{CreateUser, LoginUser};
use crate::utils::validation::{validate_username, validate_password};

pub async fn register(
    State(state): State<AppState>,
    Json(input): Json<CreateUser>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    validate_username(&input.username)
        .map_err(|msg| AppError::BadRequest(msg))?;
    validate_password(&input.password)
        .map_err(|msg| AppError::BadRequest(msg))?;

    let (user, token) = state.auth_service.register(&state.pool, input).await?;

    Ok((StatusCode::CREATED, Json(json!({
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "token": token
    }))))
}

pub async fn login(
    State(state): State<AppState>,
    Json(input): Json<LoginUser>,
) -> Result<Json<Value>, AppError> {
    validate_username(&input.username)
        .map_err(|msg| AppError::BadRequest(msg))?;

    let token = state.auth_service.login(&state.pool, input).await?;

    Ok(Json(json!({
        "token": token,
        "expires_in": 86400
    })))
}

pub async fn logout(
    State(state): State<AppState>,
    auth_user: AuthUser,
    headers: axum::http::HeaderMap,
) -> Result<Json<Value>, AppError> {
    // 从 Authorization header 提取原始 token
    let token = headers
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(AppError::Auth(AuthError::MissingToken))?;

    // 解码获取过期时间
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(state.jwt_secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )
    .map_err(|_| AppError::Auth(AuthError::InvalidToken))?;

    // 加入黑名单
    state.auth_service.logout(
        &state.pool,
        token,
        &auth_user.user_id,
        token_data.claims.exp,
    ).await?;

    Ok(Json(json!({
        "message": "登出成功"
    })))
}
