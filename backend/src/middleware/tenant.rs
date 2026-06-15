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
/// 从请求中提取 tenant 上下文（middleware 注入）：
/// 1. 优先读取 `X-Tenant-ID` header
/// 2. 回退到查询参数 `?tenant=xxx`
/// 3. 最终回退到 user_tenants 表查询
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
        // 优先从 header 读取
        if let Some(tenant) = parts
            .headers
            .get("X-Tenant-ID")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
        {
            if !is_valid_tenant_id(&tenant) {
                return Err(AppError::BadRequest(
                    "无效的 tenant ID，只允许字母、数字、下划线和连字符".to_string(),
                ));
            }
            return Ok(TenantScope::new(tenant));
        }

        // 回退到查询参数
        if let Some(query) = parts.uri.query() {
            for pair in query.split('&') {
                if let Some((key, value)) = pair.split_once('=') {
                    if key == "tenant" && !value.is_empty() {
                        let tenant = value.to_string();
                        if !is_valid_tenant_id(&tenant) {
                            return Err(AppError::BadRequest(
                                "无效的 tenant ID，只允许字母、数字、下划线和连字符".to_string(),
                            ));
                        }
                        return Ok(TenantScope::new(tenant));
                    }
                }
            }
        }

        // 从 extensions 获取（middleware 已注入）
        if let Some(scope) = parts.extensions.get::<TenantScope>() {
            return Ok(scope.clone());
        }

        // 默认 tenant
        Ok(TenantScope::default())
    }
}

/// KAN-208: tenant 中间件
///
/// 1. 从 header/query 读取显式 tenant ID
/// 2. 若未指定，从 user_tenants 表推导
/// 3. 验证用户有权访问该 tenant
/// 4. 注入 TenantScope 到 extensions
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
}
