use serde::{Deserialize, Serialize};

/// 权限记录（对应 permissions 表）
///
/// UNIQUE(user_id, employee, tenant) 确保：
/// - 同一用户在同一 tenant 下对同一员工只有一条权限记录
/// - 不同 tenant 下可以有不同权限（tenant 隔离）
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
impl Permission {
    /// 权限是否允许
    pub fn is_allowed(&self) -> bool {
        self.allowed != 0
    }

    /// 是否属于指定 tenant
    pub fn belongs_to_tenant(&self, tenant_id: &str) -> bool {
        self.tenant == tenant_id
    }

    /// 转换为响应结构
    pub fn to_response(&self) -> PermissionResponse {
        PermissionResponse {
            employee: self.employee.clone(),
            tenant: self.tenant.clone(),
            allowed: self.is_allowed(),
        }
    }
}

/// 设置权限请求体
#[allow(dead_code)]
#[derive(Debug, Clone, Deserialize)]
pub struct SetPermission {
    pub user_id: String,
    pub employee: String,
    pub tenant: String,
    pub allowed: bool,
}

#[allow(dead_code)]
impl SetPermission {
    /// 验证请求参数合法性
    pub fn validate(&self) -> Result<(), String> {
        if self.user_id.is_empty() {
            return Err("user_id 不能为空".to_string());
        }
        if self.employee.is_empty() {
            return Err("employee 不能为空".to_string());
        }
        if self.tenant.is_empty() {
            return Err("tenant 不能为空".to_string());
        }
        if self.tenant.len() > 64 {
            return Err("tenant 长度不能超过 64 字符".to_string());
        }
        if !self
            .tenant
            .chars()
            .all(|c| c.is_alphanumeric() || c == '_' || c == '-')
        {
            return Err("tenant 只允许字母、数字、下划线和连字符".to_string());
        }
        Ok(())
    }
}

/// 权限响应体（API 返回用）
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
///
/// 表示用户可访问的 tenant 列表，用于：
/// - tenant 路由中间件验证用户是否有权访问目标 tenant
/// - 用户注册时自动创建默认 tenant 映射
/// - 管理员为用户分配多 tenant 访问权限
#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct TenantPermission {
    pub id: String,
    pub user_id: String,
    pub tenant_id: String,
    pub created_at: String,
}

#[allow(dead_code)]
impl TenantPermission {
    /// 是否是默认 tenant
    pub fn is_default(&self) -> bool {
        self.tenant_id == "default"
    }
}

/// 批量设置权限请求体（管理员用）
#[allow(dead_code)]
#[derive(Debug, Clone, Deserialize)]
pub struct BatchSetPermissions {
    pub user_id: String,
    pub tenant: String,
    pub allowed_employees: Vec<String>,
}

#[allow(dead_code)]
impl BatchSetPermissions {
    /// 验证请求参数
    pub fn validate(&self) -> Result<(), String> {
        if self.user_id.is_empty() {
            return Err("user_id 不能为空".to_string());
        }
        if self.tenant.is_empty() {
            return Err("tenant 不能为空".to_string());
        }
        if self.allowed_employees.is_empty() {
            return Err("allowed_employees 不能为空".to_string());
        }
        for emp in &self.allowed_employees {
            if emp.is_empty() {
                return Err("员工名不能为空".to_string());
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_permission_is_allowed() {
        let perm = Permission {
            id: "1".to_string(),
            user_id: "u1".to_string(),
            employee: "404".to_string(),
            tenant: "default".to_string(),
            allowed: 1,
            created_at: "2026-01-01".to_string(),
        };
        assert!(perm.is_allowed());

        let perm_denied = Permission {
            allowed: 0,
            ..perm
        };
        assert!(!perm_denied.is_allowed());
    }

    #[test]
    fn test_permission_belongs_to_tenant() {
        let perm = Permission {
            id: "1".to_string(),
            user_id: "u1".to_string(),
            employee: "404".to_string(),
            tenant: "tenant-a".to_string(),
            allowed: 1,
            created_at: "2026-01-01".to_string(),
        };
        assert!(perm.belongs_to_tenant("tenant-a"));
        assert!(!perm.belongs_to_tenant("tenant-b"));
        assert!(!perm.belongs_to_tenant("default"));
    }

    #[test]
    fn test_permission_to_response() {
        let perm = Permission {
            id: "1".to_string(),
            user_id: "u1".to_string(),
            employee: "404".to_string(),
            tenant: "default".to_string(),
            allowed: 1,
            created_at: "2026-01-01".to_string(),
        };
        let resp = perm.to_response();
        assert_eq!(resp.employee, "404");
        assert_eq!(resp.tenant, "default");
        assert!(resp.allowed);
    }

    #[test]
    fn test_set_permission_validate() {
        let valid = SetPermission {
            user_id: "u1".to_string(),
            employee: "404".to_string(),
            tenant: "default".to_string(),
            allowed: true,
        };
        assert!(valid.validate().is_ok());

        let empty_user = SetPermission {
            user_id: "".to_string(),
            ..valid.clone()
        };
        assert!(empty_user.validate().is_err());

        let empty_tenant = SetPermission {
            tenant: "".to_string(),
            ..valid.clone()
        };
        assert!(empty_tenant.validate().is_err());

        let invalid_tenant = SetPermission {
            tenant: "tenant with spaces".to_string(),
            ..valid
        };
        assert!(invalid_tenant.validate().is_err());
    }

    #[test]
    fn test_tenant_permission_is_default() {
        let tp = TenantPermission {
            id: "1".to_string(),
            user_id: "u1".to_string(),
            tenant_id: "default".to_string(),
            created_at: "2026-01-01".to_string(),
        };
        assert!(tp.is_default());

        let tp_other = TenantPermission {
            tenant_id: "other".to_string(),
            ..tp
        };
        assert!(!tp_other.is_default());
    }

    #[test]
    fn test_batch_set_permissions_validate() {
        let valid = BatchSetPermissions {
            user_id: "u1".to_string(),
            tenant: "default".to_string(),
            allowed_employees: vec!["404".to_string(), "iron".to_string()],
        };
        assert!(valid.validate().is_ok());

        let empty_employees = BatchSetPermissions {
            allowed_employees: vec![],
            ..valid.clone()
        };
        assert!(empty_employees.validate().is_err());

        let empty_emp_name = BatchSetPermissions {
            allowed_employees: vec!["".to_string()],
            ..valid
        };
        assert!(empty_emp_name.validate().is_err());
    }
}
