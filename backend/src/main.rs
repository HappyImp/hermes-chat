mod config;
mod db;
mod errors;
mod handlers;
mod middleware;
mod models;
mod services;
mod utils;

use axum::{
    middleware as axum_middleware,
    routing::{delete, get, post},
    Router,
};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use config::AppConfig;
use db::DbPool;
use middleware::auth::auth_middleware;
use middleware::cors::cors_layer;
use services::auth::AuthService;
use services::hermes::HermesClient;

#[derive(Clone)]
struct AppState {
    pool: DbPool,
    auth_service: AuthService,
    hermes_client: HermesClient,
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
    let auth_service = AuthService::new(
        config.jwt.secret.clone(),
        config.jwt.expires_in_hours,
    );

    let hermes_client = HermesClient::new(config.hermes.gateway_url.clone());

    let state = AppState {
        pool,
        auth_service,
        hermes_client,
    };

    // 创建路由
    let auth_routes = Router::new()
        .route("/register", post(handlers::auth::register))
        .route("/login", post(handlers::auth::login));

    let session_routes = Router::new()
        .route("/", get(handlers::session::list))
        .route("/", post(handlers::session::create))
        .route("/{id}", delete(handlers::session::delete));

    let chat_routes = Router::new()
        .route("/completions", post(handlers::chat::completions));

    let employee_routes = Router::new()
        .route("/", get(handlers::employee::list));

    let admin_routes = Router::new()
        .route("/users", get(handlers::admin::list_users))
        .route("/permissions", post(handlers::admin::set_permission));

    let app = Router::new()
        .nest("/api/auth", auth_routes)
        .nest("/api/sessions", session_routes.route_layer(axum_middleware::from_fn(auth_middleware)))
        .nest("/api/chat", chat_routes.route_layer(axum_middleware::from_fn(auth_middleware)))
        .nest("/api/employees", employee_routes.route_layer(axum_middleware::from_fn(auth_middleware)))
        .nest("/api/admin", admin_routes.route_layer(axum_middleware::from_fn(auth_middleware)))
        .layer(cors_layer(&config.security.allowed_origins))
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    // 启动服务器
    let addr = config.bind_addr();
    tracing::info!("服务器启动在 {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("绑定地址失败");

    axum::serve(listener, app)
        .await
        .expect("服务器启动失败");
}