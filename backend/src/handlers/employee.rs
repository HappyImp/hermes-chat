use axum::{extract::State, Json};
use serde_json::{json, Value};

use crate::AppState;
use crate::errors::AppError;
use crate::middleware::auth::AuthUser;
use crate::models::permission::Permission;

pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Value>, AppError> {
    let permissions = sqlx::query_as::<_, Permission>(
        "SELECT * FROM permissions WHERE user_id = ? AND allowed = 1"
    )
    .bind(&auth.user_id)
    .fetch_all(&state.pool)
    .await?;

    let employees: Vec<Value> = permissions
        .into_iter()
        .map(|p| {
            json!({
                "name": p.employee,
                "allowed": true
            })
        })
        .collect();

    Ok(Json(json!({ "employees": employees })))
}