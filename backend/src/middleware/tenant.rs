use axum::response::Response;
use axum::{async_trait, extract::FromRequestParts, http::request::Parts, middleware::Next};

use crate::errors::AppError;
use crate::middleware::auth::AuthUser;
use crate::services::kanban::KanbanService;
use crate::AppState;

/// 默认 tenant ID，未指定时使用
pub const DEFAULT_TENANT: &str = "default";

/// Tenant 作用域提取器
///
/// KAN-208: 从 extensions 中提取 tenant 上下文（由 tenant_middleware 注入）。
/// **不**直接读取前端 header/query 参数——这些由 middleware 统一处理并验证访问权限后注入。
///
/// 用法：
/// ```ignore
/// async fn handler(tenant: TenantScope, auth: AuthUser) {
///     let tenant_id = tenant.as_str();
///     // ...
/// }
/// ```
#[derive(Clone, Debug)]
pub struct TenantScope {
    tenant_id: String,
}

/// KAN-208: TenantId 提取器（TenantScope 别名，语义更明确）
pub type TenantId = TenantScope;

impl TenantScope {
    pub fn new(tenant_id: String) -> Self {
        Self { tenant_id }
    }

    pub fn as_str(&self) -> &str {
        &self.tenant_id
    }

    pub fn into_inner(self) -> String {
        self.tenant_id
    }
}

impl Default for TenantScope {
    fn default() -> Self {
        Self::new(DEFAULT_TENANT.to_string())
    }
}

#[async_trait]
impl<S> FromRequestParts<S> for TenantScope
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        // KAN-208: 只从 extensions 读取（由 tenant_middleware 注入）
        // 不直接读取前端 header/query 参数，确保 tenant 来源可信赖
        parts
            .extensions
            .get::<TenantScope>()
            .cloned()
            .ok_or_else(|| {
                tracing::warn!("TenantScope 未在 extensions 中找到，tenant_middleware 可能未启用");
                AppError::Internal("缺少 tenant 上下文，请联系管理员".to_string())
            })
    }
}

/// KAN-208: tenant 中间件 — 后端强制注入，不信任前端参数
///
/// 安全流程：
/// 1. 从 header/query 读取前端提供的 tenant ID（作为 hint，非信任源）
/// 2. 若显式指定，验证格式 + 查询 user_tenants 表确认用户有权访问
/// 3. 若未指定，从 user_tenants 表推导（LIMIT 1）
/// 4. 注入 TenantScope 到 extensions — 后续 handler 仅从此处读取
///
/// 关键：TenantScope 提取器不再直接读取前端参数，只信任 middleware 注入的值
pub async fn tenant_middleware(
    axum::extract::State(state): axum::extract::State<AppState>,
    mut req: axum::extract::Request,
    next: Next,
) -> Result<Response, AppError> {
    let tenant_id = {
        // 先尝试 header / query
        let header_tenant = req
            .headers()
            .get("X-Tenant-ID")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty() && is_valid_tenant_id(s));

        let query_tenant = req.uri().query().and_then(|q| {
            q.split('&').find_map(|p| {
                let (k, v) = p.split_once('=')?;
                if k == "tenant" && !v.is_empty() && is_valid_tenant_id(v) {
                    Some(v.to_string())
                } else {
                    None
                }
            })
        });

        if let Some(t) = header_tenant.or(query_tenant) {
            // 显式指定，验证用户有权访问
            let auth = req
                .extensions()
                .get::<AuthUser>()
                .cloned()
                .ok_or(AppError::Auth(crate::errors::AuthError::MissingToken))?;

            if !KanbanService::check_tenant_access(&state.pool, &auth.user_id, &t).await? {
                return Err(AppError::Forbidden(format!("无权访问 tenant: {}", t)));
            }
            t
        } else {
            // 未显式指定，从 user_tenants 推导
            let auth = req
                .extensions()
                .get::<AuthUser>()
                .cloned()
                .ok_or(AppError::Auth(crate::errors::AuthError::MissingToken))?;

            KanbanService::get_tenant_for_user(&state.pool, &auth.user_id).await?
        }
    };

    req.extensions_mut().insert(TenantScope::new(tenant_id));

    Ok(next.run(req).await)
}

/// 验证 tenant ID 格式
pub fn is_valid_tenant_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .chars()
            .all(|c| c.is_alphanumeric() || c == '_' || c == '-')
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http;

    fn make_parts() -> http::request::Parts {
        http::Request::builder()
            .body(())
            .unwrap()
            .into_parts()
            .0
    }

    #[test]
    fn test_default_tenant() {
        let scope = TenantScope::default();
        assert_eq!(scope.as_str(), "default");
    }

    #[test]
    fn test_valid_tenant_ids() {
        assert!(is_valid_tenant_id("default"));
        assert!(is_valid_tenant_id("tenant-1"));
        assert!(is_valid_tenant_id("my_tenant"));
        assert!(is_valid_tenant_id("abc123"));
    }

    #[test]
    fn test_invalid_tenant_ids() {
        assert!(!is_valid_tenant_id(""));
        assert!(is_valid_tenant_id("tenant with spaces") == false);
        assert!(!is_valid_tenant_id("tenant@special"));
        assert!(!is_valid_tenant_id(&"a".repeat(65))); // 超长
    }

    #[test]
    fn test_tenant_scope_new() {
        let scope = TenantScope::new("custom".to_string());
        assert_eq!(scope.as_str(), "custom");
        assert_eq!(scope.into_inner(), "custom");
    }

    // ==================== KAN-208: 安全测试 ====================

    /// KAN-208: 验证 TenantScope 提取器不接受无 middleware 注入的请求
    /// 旧实现会从 header/query 直读并返回 "default"，新实现必须返回错误
    #[tokio::test]
    async fn test_kan208_extractor_rejects_no_middleware_injection() {
        let mut parts = make_parts();
        // 不注入 TenantScope 到 extensions

        let result = TenantScope::from_request_parts(&mut parts, &()).await;
        assert!(
            result.is_err(),
            "KAN-208: 无 middleware 注入时应返回错误，不应回退到默认值"
        );
    }

    /// KAN-208: 验证 TenantScope 提取器忽略 X-Tenant-ID header（不信任前端参数）
    /// 旧实现会从 header 直读，新实现只信任 middleware 注入的值
    #[tokio::test]
    async fn test_kan208_extractor_ignores_header_when_no_injection() {
        let mut parts = make_parts();
        parts
            .headers
            .insert("X-Tenant-ID", "attacker-tenant".parse().unwrap());
        // 不注入 TenantScope

        let result = TenantScope::from_request_parts(&mut parts, &()).await;
        assert!(
            result.is_err(),
            "KAN-208: 不应从 header 直接读取 tenant，即使 header 存在也应返回错误"
        );
    }

    /// KAN-208: 验证 TenantScope 提取器忽略 query 参数（不信任前端参数）
    #[tokio::test]
    async fn test_kan208_extractor_ignores_query_when_no_injection() {
        let mut parts = make_parts();
        parts.uri = "http://localhost/api/kanban/tasks?tenant=attacker".parse().unwrap();
        // 不注入 TenantScope

        let result = TenantScope::from_request_parts(&mut parts, &()).await;
        assert!(
            result.is_err(),
            "KAN-208: 不应从 query 参数直接读取 tenant，即使参数存在也应返回错误"
        );
    }

    /// KAN-208: 验证 TenantScope 提取器接受 middleware 注入的值
    #[tokio::test]
    async fn test_kan208_extractor_accepts_middleware_injection() {
        let mut parts = make_parts();
        parts
            .extensions
            .insert(TenantScope::new("injected-tenant".to_string()));

        let result = TenantScope::from_request_parts(&mut parts, &()).await;
        assert!(result.is_ok(), "middleware 注入的值应被接受");
        assert_eq!(result.unwrap().as_str(), "injected-tenant");
    }

    /// KAN-208: 验证 middleware 注入的值优先级高于 header（header 被忽略）
    #[tokio::test]
    async fn test_kan208_injection_overrides_header() {
        let mut parts = make_parts();
        parts
            .headers
            .insert("X-Tenant-ID", "header-tenant".parse().unwrap());
        parts
            .extensions
            .insert(TenantScope::new("middleware-tenant".to_string()));

        let result = TenantScope::from_request_parts(&mut parts, &()).await;
        assert!(result.is_ok());
        assert_eq!(
            result.unwrap().as_str(),
            "middleware-tenant",
            "middleware 注入值应优先于 header"
        );
    }
}
