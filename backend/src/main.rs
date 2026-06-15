use hermes_chat_backend::config::AppConfig;
use hermes_chat_backend::db;
use hermes_chat_backend::handlers;
use hermes_chat_backend::middleware::auth::auth_middleware;
use hermes_chat_backend::middleware::cors::cors_layer;
use hermes_chat_backend::middleware::tenant::tenant_middleware;
use hermes_chat_backend::services::auth::AuthService;
use hermes_chat_backend::services::employee::EmployeeService;
use hermes_chat_backend::services::hermes::HermesClient;
use hermes_chat_backend::services::kanban::KanbanService;
use hermes_chat_backend::services::profile::ProfileService;
use hermes_chat_backend::AppState;

use axum::{
    middleware as axum_middleware,
    response::IntoResponse,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde_json::json;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

/// 全局 404 fallback，返回 JSON 格式
async fn not_found_handler() -> impl IntoResponse {
    (
        axum::http::StatusCode::NOT_FOUND,
        Json(json!({ "error": "请求的接口不存在" })),
    )
}

#[tokio::main]
async fn main() {
    // 初始化日志
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // 加载配置
    let config = AppConfig::load().expect("加载配置失败");
    tracing::info!("配置加载完成");

    // 初始化数据库
    let pool = db::pool::create_pool(&config.database.url, config.database.max_connections)
        .await
        .expect("创建数据库连接池失败");

    db::pool::run_migrations(&pool)
        .await
        .expect("数据库迁移失败");

    tracing::info!("数据库初始化完成");

    // 初始化服务
    let auth_service = AuthService::new(config.jwt.secret.clone(), config.jwt.expires_in_hours);

    let hermes_client = HermesClient::new(config.hermes.gateway_url.clone());

    let state = AppState {
        pool,
        auth_service,
        employee_service: EmployeeService::new(),
        hermes_client,
        kanban_service: KanbanService::new(),
        profile_service: ProfileService::new(None),
        jwt_secret: config.jwt.secret.clone(),
    };

    // 创建路由
    let auth_public_routes = Router::new()
        .route("/register", post(handlers::auth::register))
        .route("/login", post(handlers::auth::login));

    let auth_protected_routes = Router::new()
        .route("/logout", post(handlers::auth::logout))
        .route_layer(axum_middleware::from_fn_with_state(
            state.clone(),
            auth_middleware,
        ));

    let auth_routes = auth_public_routes.merge(auth_protected_routes);

    let session_routes = Router::new()
        .route("/", get(handlers::session::list))
        .route("/", post(handlers::session::create))
        .route("/:id", delete(handlers::session::delete));

    let chat_routes = Router::new().route("/completions", post(handlers::chat::completions));

    let employee_routes = Router::new().route("/", get(handlers::employee::list));

    let admin_routes = Router::new()
        .route("/dashboard", get(handlers::admin::dashboard))
        .route(
            "/invitation-codes",
            post(handlers::admin::create_invitation_codes),
        )
        .route(
            "/invitation-codes",
            get(handlers::admin::list_invitation_codes),
        )
        .route(
            "/invitation-codes/:id/disable",
            post(handlers::admin::disable_invitation_code),
        )
        .route(
            "/invitation-codes/:id",
            delete(handlers::admin::delete_invitation_code),
        )
        .route("/users", get(handlers::admin::list_users))
        .route("/users/:id", get(handlers::admin::get_user_detail))
        .route(
            "/users/:id/permissions",
            put(handlers::admin::update_user_permissions),
        )
        .route(
            "/users/:id/toggle-status",
            post(handlers::admin::toggle_user_status),
        )
        .route("/users/:id", delete(handlers::admin::delete_user))
        .route("/audit-logs", get(handlers::admin::get_audit_logs));

    // KAN-208: kanban 路由加上 tenant_middleware
    let kanban_routes = Router::new()
        .route("/tasks", get(handlers::kanban::list_tasks))
        .route("/tasks/:id", get(handlers::kanban::get_task))
        .route("/stats", get(handlers::kanban::get_stats))
        .route("/employees", get(handlers::kanban::get_employees));

    let cleanup_pool = state.pool.clone();
    let cleanup_auth = state.auth_service.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(3600));
        loop {
            interval.tick().await;
            match cleanup_auth.cleanup_expired_blacklist(&cleanup_pool).await {
                Ok(count) if count > 0 => {
                    tracing::info!("清理过期黑名单记录: {} 条", count);
                }
                Ok(_) => {}
                Err(e) => {
                    tracing::warn!("清理过期黑名单失败: {:?}", e);
                }
            }
        }
    });

    let app = Router::new()
        .nest("/api/auth", auth_routes)
        .nest(
            "/api/sessions",
            session_routes.route_layer(axum_middleware::from_fn_with_state(
                state.clone(),
                auth_middleware,
            )),
        )
        .nest(
            "/api/chat",
            chat_routes.route_layer(axum_middleware::from_fn_with_state(
                state.clone(),
                auth_middleware,
            )),
        )
        .nest(
            "/api/employees",
            employee_routes.route_layer(axum_middleware::from_fn_with_state(
                state.clone(),
                auth_middleware,
            )),
        )
        .nest(
            "/api/admin",
            admin_routes.route_layer(axum_middleware::from_fn_with_state(
                state.clone(),
                auth_middleware,
            )),
        )
        .nest(
            "/api/kanban",
            kanban_routes
                .route_layer(axum_middleware::from_fn_with_state(
                    state.clone(),
                    tenant_middleware,
                ))
                .route_layer(axum_middleware::from_fn_with_state(
                    state.clone(),
                    auth_middleware,
                )),
        )
        .fallback(not_found_handler)
        .layer(cors_layer(&config.security.allowed_origins))
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = config.bind_addr();
    tracing::info!("服务器启动在 {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("绑定地址失败");

    axum::serve(listener, app).await.expect("服务器启动失败");
}
