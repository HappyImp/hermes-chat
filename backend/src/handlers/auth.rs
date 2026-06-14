use axum::{extract::State, Json};
use serde_json::{json, Value};

use crate::AppState;
use crate::errors::AppError;
use crate::models::user::{CreateUser, LoginUser};

pub async fn register(
    State(state): State<AppState>,
    Json(input): Json<CreateUser>,
) -> Result<Json<Value>, AppError> {
    let (user, token) = state.auth_service.register(&state.pool, input).await?;

    Ok(Json(json!({
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "token": token
    })))
}

pub async fn login(
    State(state): State<AppState>,
    Json(input): Json<LoginUser>,
) -> Result<Json<Value>, AppError> {
    let token = state.auth_service.login(&state.pool, input).await?;

    Ok(Json(json!({
        "token": token,
        "expires_in": 86400
    })))
}