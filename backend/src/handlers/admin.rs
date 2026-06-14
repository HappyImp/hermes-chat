use axum::{
    extract::State,
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::AppState;
use crate::errors::AppError;
use crate::middleware::auth::AuthUser;
use crate::models::permission::SetPermission;
use crate::models::user::User;

pub async fn list_users(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Value>, AppError> {
    if auth.role != "admin" {
        return Err(AppError::Forbidden("需要管理员权限".to_string()));
    }

    let users = sqlx::query_as::<_, User>(
        "SELECT id, username, password_hash, role, created_at, updated_at FROM users"
    )
    .fetch_all(&state.pool)
    .await?;

    let user_list: Vec<Value> = users
        .into_iter()
        .map(|u| {
            json!({
                "id": u.id,
                "username": u.username,
                "role": u.role,
                "created_at": u.created_at
            })
        })
        .collect();

    Ok(Json(json!({ "users": user_list })))
}

pub async fn set_permission(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<SetPermission>,
) -> Result<Json<Value>, AppError> {
    if auth.role != "admin" {
        return Err(AppError::Forbidden("需要管理员权限".to_string()));
    }

    let id = Uuid::new_v4().to_string();
    let allowed = if input.allowed { 1 } else { 0 };

    sqlx::query(
        "INSERT OR REPLACE INTO permissions (id, user_id, employee, allowed) VALUES (?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&input.user_id)
    .bind(&input.employee)
    .bind(allowed)
    .execute(&state.pool)
    .await?;

    Ok(Json(json!({ "message": "权限已更新" })))
}