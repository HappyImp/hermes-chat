use serde::{Deserialize, Serialize};

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Permission {
    pub id: String,
    pub user_id: String,
    pub employee: String,
    pub tenant: String,
    pub allowed: i32,
    pub created_at: String,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct SetPermission {
    pub user_id: String,
    pub employee: String,
    pub tenant: String,
    pub allowed: bool,
}

#[allow(dead_code)]
#[derive(Debug, Serialize)]
pub struct PermissionResponse {
    pub employee: String,
    pub tenant: String,
    pub allowed: bool,
}

impl From<Permission> for PermissionResponse {
    fn from(perm: Permission) -> Self {
        Self {
            employee: perm.employee,
            tenant: perm.tenant,
            allowed: perm.allowed != 0,
        }
    }
}

/// Tenant 权限映射（对应 user_tenants 表）
#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct TenantPermission {
    pub id: String,
    pub user_id: String,
    pub tenant_id: String,
    pub created_at: String,
}
