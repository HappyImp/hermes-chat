use axum::{extract::State, Json};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::errors::AppError;
use crate::middleware::auth::AuthUser;
use crate::middleware::tenant::TenantScope;
use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct EmployeeListParams {
    /// 是否返回所有 tenant 的权限（默认只返回当前 tenant）
    #[serde(default)]
    pub all_tenants: bool,
}

/// GET /api/employees — 员工列表（按 tenant 过滤）
pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    tenant: TenantScope,
    axum::extract::Query(params): axum::extract::Query<EmployeeListParams>,
) -> Result<Json<Value>, AppError> {
    let employees = if params.all_tenants {
        state
            .employee_service
            .list_all_tenants(&state.pool, &auth.user_id)
            .await?
    } else {
        state
            .employee_service
            .list_allowed_for_tenant(&state.pool, &auth.user_id, tenant.as_str())
            .await?
    };

    Ok(Json(json!({
        "employees": employees,
        "tenant": tenant.as_str(),
    })))
}

/// GET /api/employees/profiles — 从 profiles 推导的员工列表
pub async fn list_profiles(
    State(state): State<AppState>,
    _auth: AuthUser,
    tenant: TenantScope,
) -> Result<Json<Value>, AppError> {
    let employees = state.kanban_service.get_employees(tenant.as_str()).await?;
    Ok(Json(json!({ "employees": employees })))
}
