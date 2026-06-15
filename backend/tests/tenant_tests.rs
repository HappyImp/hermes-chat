#[cfg(test)]
mod tenant_middleware_tests {
    use hermes_chat_backend::middleware::tenant::{
        is_valid_tenant_id, TenantScope, DEFAULT_TENANT,
    };

    #[test]
    fn test_default_tenant_scope() {
        let scope = TenantScope::default();
        assert_eq!(scope.as_str(), DEFAULT_TENANT);
        assert_eq!(scope.as_str(), "default");
    }

    #[test]
    fn test_custom_tenant_scope() {
        let scope = TenantScope::new("acme-corp".to_string());
        assert_eq!(scope.as_str(), "acme-corp");
    }

    #[test]
    fn test_into_inner() {
        let scope = TenantScope::new("test-tenant".to_string());
        assert_eq!(scope.into_inner(), "test-tenant");
    }

    #[test]
    fn test_valid_tenant_ids() {
        assert!(is_valid_tenant_id("default"));
        assert!(is_valid_tenant_id("tenant-1"));
        assert!(is_valid_tenant_id("my_tenant"));
        assert!(is_valid_tenant_id("abc123"));
        assert!(is_valid_tenant_id("A"));
        assert!(is_valid_tenant_id("test-tenant_v2"));
    }

    #[test]
    fn test_invalid_tenant_ids() {
        assert!(!is_valid_tenant_id(""));
        assert!(!is_valid_tenant_id("tenant with spaces"));
        assert!(!is_valid_tenant_id("tenant@special"));
        assert!(!is_valid_tenant_id("tenant/slash"));
        assert!(!is_valid_tenant_id("tenant.dot"));
        assert!(!is_valid_tenant_id(&"a".repeat(65))); // 超过 64 字符
    }

    #[test]
    fn test_max_length_tenant_id() {
        let max_id = "a".repeat(64);
        assert!(is_valid_tenant_id(&max_id));
    }
}
