use axum::{extract::State, Json};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::AppState;
use crate::errors::AppError;
use crate::middleware::auth::AdminUser;

/// 用于 list_users 的查询结构体，不含 password_hash
#[derive(Debug, Deserialize, sqlx::FromRow)]
struct UserListItem {
    pub id: String,
    pub username: String,
    pub role: String,
    pub created_at: String,
}

pub async fn list_users(
    State(state): State<AppState>,
    _admin: AdminUser,
) -> Result<Json<Value>, AppError> {
    let users = sqlx::query_as::<_, UserListItem>(
        "SELECT id, username, role, created_at FROM users"
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

#[derive(Debug, Deserialize)]
pub struct SetPermission {
    pub user_id: String,
    pub employee: String,
    pub allowed: bool,
}

pub async fn set_permission(
    State(state): State<AppState>,
    _admin: AdminUser,
    Json(input): Json<SetPermission>,
) -> Result<Json<Value>, AppError> {
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
