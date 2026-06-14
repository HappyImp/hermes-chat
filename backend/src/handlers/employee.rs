use axum::{extract::State, Json};
use serde_json::{json, Value};

use crate::AppState;
use crate::errors::AppError;
use crate::middleware::auth::AuthUser;

pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Value>, AppError> {
    let employees = state.employee_service
        .list_allowed(&state.pool, &auth.user_id)
        .await?;

    Ok(Json(json!({ "employees": employees })))
}