use axum::{extract::State, http::StatusCode, Json};
use serde_json::{json, Value};

use crate::AppState;
use crate::errors::AppError;
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