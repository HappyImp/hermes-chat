use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::AppState;
use crate::errors::AppError;
use crate::middleware::auth::AdminUser;
use crate::models::invitation_code::CreateInvitationCode;
use crate::services::admin::AdminService;

#[derive(Debug, Deserialize)]
pub struct InvitationCodeListParams {
    #[serde(default = "default_status")]
    pub status: String,
    #[serde(default = "default_page")]
    pub page: i32,
    #[serde(default = "default_limit")]
    pub limit: i32,
}

#[derive(Debug, Deserialize)]
pub struct UserListParams {
    #[serde(default)]
    pub search: String,
    #[serde(default = "default_page")]
    pub page: i32,
    #[serde(default = "default_limit")]
    pub limit: i32,
}

#[derive(Debug, Deserialize)]
pub struct ToggleStatusRequest {
    pub enabled: bool,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePermissionsRequest {
    pub allowed_employees: Vec<String>,
}

fn default_page() -> i32 { 1 }
fn default_limit() -> i32 { 20 }
fn default_status() -> String { "all".to_string() }

// ==================== 授权码管理 ====================

/// POST /api/admin/invitation-codes
pub async fn create_invitation_codes(
    State(state): State<AppState>,
    admin: AdminUser,
    Json(input): Json<CreateInvitationCode>,
) -> Result<Json<Value>, AppError> {
    let admin_svc = AdminService::new();
    let codes = admin_svc.create_invitation_codes(&state.pool, &admin.user_id, input).await?;
    Ok(Json(json!({ "codes": codes })))
}

/// GET /api/admin/invitation-codes
pub async fn list_invitation_codes(
    State(state): State<AppState>,
    _admin: AdminUser,
    Query(params): Query<InvitationCodeListParams>,
) -> Result<Json<Value>, AppError> {
    let admin_svc = AdminService::new();
    let result = admin_svc.list_invitation_codes(&state.pool, &params.status, params.page, params.limit).await?;
    Ok(Json(result))
}

/// POST /api/admin/invitation-codes/:id/disable
pub async fn disable_invitation_code(
    State(state): State<AppState>,
    admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let admin_svc = AdminService::new();
    admin_svc.disable_invitation_code(&state.pool, &admin.user_id, &id).await?;
    Ok(Json(json!({ "message": "已禁用" })))
}

/// DELETE /api/admin/invitation-codes/:id
pub async fn delete_invitation_code(
    State(state): State<AppState>,
    admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let admin_svc = AdminService::new();
    admin_svc.delete_invitation_code(&state.pool, &admin.user_id, &id).await?;
    Ok(Json(json!({ "message": "已删除" })))
}

// ==================== 用户管理 ====================

/// GET /api/admin/users
pub async fn list_users(
    State(state): State<AppState>,
    _admin: AdminUser,
    Query(params): Query<UserListParams>,
) -> Result<Json<Value>, AppError> {
    let admin_svc = AdminService::new();
    let result = admin_svc.list_users(&state.pool, &params.search, params.page, params.limit).await?;
    Ok(Json(result))
}

/// GET /api/admin/users/:id
pub async fn get_user_detail(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let admin_svc = AdminService::new();
    let result = admin_svc.get_user_detail(&state.pool, &id).await?;
    Ok(Json(result))
}

/// PUT /api/admin/users/:id/permissions
pub async fn update_user_permissions(
    State(state): State<AppState>,
    admin: AdminUser,
    Path(id): Path<String>,
    Json(input): Json<UpdatePermissionsRequest>,
) -> Result<Json<Value>, AppError> {
    let admin_svc = AdminService::new();
    admin_svc.update_user_permissions(&state.pool, &admin.user_id, &id, input.allowed_employees).await?;
    Ok(Json(json!({ "message": "权限已更新" })))
}

/// POST /api/admin/users/:id/toggle-status
pub async fn toggle_user_status(
    State(state): State<AppState>,
    admin: AdminUser,
    Path(id): Path<String>,
    Json(input): Json<ToggleStatusRequest>,
) -> Result<Json<Value>, AppError> {
    let admin_svc = AdminService::new();
    admin_svc.toggle_user_status(&state.pool, &admin.user_id, &id, input.enabled).await?;
    let msg = if input.enabled { "用户已启用" } else { "用户已禁用" };
    Ok(Json(json!({ "message": msg })))
}

/// DELETE /api/admin/users/:id
pub async fn delete_user(
    State(state): State<AppState>,
    admin: AdminUser,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let admin_svc = AdminService::new();
    admin_svc.delete_user(&state.pool, &admin.user_id, &id).await?;
    Ok(Json(json!({ "message": "用户已删除" })))
}

// ==================== 仪表盘 ====================

/// GET /api/admin/dashboard
pub async fn dashboard(
    State(state): State<AppState>,
    _admin: AdminUser,
) -> Result<Json<Value>, AppError> {
    let admin_svc = AdminService::new();
    let stats = admin_svc.dashboard_stats(&state.pool).await?;
    Ok(Json(stats))
}
