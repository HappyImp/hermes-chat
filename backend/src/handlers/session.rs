use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde_json::{json, Value};

use crate::errors::AppError;
use crate::middleware::auth::AuthUser;
use crate::models::session::CreateSession;
use crate::services::session::SessionService;
use crate::AppState;

pub async fn list(State(state): State<AppState>, auth: AuthUser) -> Result<Json<Value>, AppError> {
    let sessions = SessionService::list(&state.pool, &auth.user_id).await?;

    Ok(Json(json!({ "sessions": sessions })))
}

pub async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<CreateSession>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    let session = SessionService::create(&state.pool, &auth.user_id, input).await?;

    Ok((StatusCode::CREATED, Json(json!(session))))
}

pub async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(session_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    SessionService::delete(&state.pool, &auth.user_id, &session_id).await?;

    Ok(Json(json!({ "message": "会话已删除" })))
}
