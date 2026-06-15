use axum::{extract::State, Json};
use serde_json::{json, Value};

use crate::errors::AppError;
use crate::middleware::auth::AuthUser;
use crate::middleware::tenant::TenantScope;
use crate::AppState;

/// GET /api/kanban/tasks — 返回任务列表 JSON
pub async fn list_tasks(
    State(state): State<AppState>,
    _auth: AuthUser,
    tenant: TenantScope,
) -> Result<Json<Value>, AppError> {
    let tasks = state.kanban_service.list_tasks(tenant.as_str()).await?;

    Ok(Json(json!({ "tasks": tasks })))
}

/// GET /api/kanban/tasks/:id — 返回任务详情 JSON
pub async fn get_task(
    State(state): State<AppState>,
    _auth: AuthUser,
    tenant: TenantScope,
    axum::extract::Path(task_id): axum::extract::Path<String>,
) -> Result<Json<Value>, AppError> {
    let task = state
        .kanban_service
        .get_task(&task_id, tenant.as_str())
        .await?;

    Ok(Json(json!({ "task": task })))
}

/// GET /api/kanban/stats — 返回看板统计 JSON
pub async fn get_stats(
    State(state): State<AppState>,
    _auth: AuthUser,
    tenant: TenantScope,
) -> Result<Json<Value>, AppError> {
    let stats = state.kanban_service.get_stats(tenant.as_str()).await?;

    Ok(Json(json!({ "stats": stats })))
}

/// GET /api/kanban/employees — 返回员工列表 JSON
pub async fn get_employees(
    State(state): State<AppState>,
    _auth: AuthUser,
    tenant: TenantScope,
) -> Result<Json<Value>, AppError> {
    let employees = state.kanban_service.get_employees(tenant.as_str()).await?;

    Ok(Json(json!({ "employees": employees })))
}
