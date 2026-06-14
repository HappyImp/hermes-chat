use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Permission {
    pub id: String,
    pub user_id: String,
    pub employee: String,
    pub allowed: i32,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct SetPermission {
    pub user_id: String,
    pub employee: String,
    pub allowed: bool,
}

#[derive(Debug, Serialize)]
pub struct PermissionResponse {
    pub employee: String,
    pub allowed: bool,
}

impl From<Permission> for PermissionResponse {
    fn from(perm: Permission) -> Self {
        Self {
            employee: perm.employee,
            allowed: perm.allowed != 0,
        }
    }
}