use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};

use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    extract::State,
    response::IntoResponse,
    Json,
};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use serde_json::{json, Value};
use tokio::time::{interval, Duration};

use crate::errors::{AppError, AuthError};
use crate::middleware::auth::Claims;
use crate::AppState;

/// 🟢10: WS 轮询间隔（秒），提取为常量方便调优
const WS_POLL_INTERVAL_SECS: u64 = 5;
/// WS 心跳间隔（秒）
const WS_HEARTBEAT_INTERVAL_SECS: u64 = 30;
/// 🟢11: 全局 WebSocket 连接上限
const WS_MAX_CONNECTIONS: usize = 100;

/// 🟢11: 全局 WS 连接计数器
static WS_CONNECTION_COUNT: AtomicUsize = AtomicUsize::new(0);

/// GET /api/kanban/tasks — 返回任务列表 JSON
pub async fn list_tasks(
    State(state): State<AppState>,
    _auth: crate::middleware::auth::AuthUser,
    tenant: crate::middleware::tenant::TenantScope,
) -> Result<Json<Value>, AppError> {
    let tasks = state.kanban_service.list_tasks(tenant.as_str()).await?;

    Ok(Json(json!({ "tasks": tasks })))
}

/// GET /api/kanban/tasks/:id — 返回任务详情 JSON
pub async fn get_task(
    State(state): State<AppState>,
    _auth: crate::middleware::auth::AuthUser,
    tenant: crate::middleware::tenant::TenantScope,
    axum::extract::Path(task_id): axum::extract::Path<String>,
) -> Result<Json<Value>, AppError> {
    let task = state
        .kanban_service
        .get_task(&task_id, tenant.as_str())
        .await?;

    Ok(Json(task))
}

/// GET /api/kanban/stats — 返回看板统计 JSON
pub async fn get_stats(
    State(state): State<AppState>,
    _auth: crate::middleware::auth::AuthUser,
    tenant: crate::middleware::tenant::TenantScope,
) -> Result<Json<Value>, AppError> {
    let stats = state.kanban_service.get_stats(tenant.as_str()).await?;

    Ok(Json(json!({ "stats": stats })))
}

/// GET /api/kanban/employees — 返回员工列表 JSON
pub async fn get_employees(
    State(state): State<AppState>,
    _auth: crate::middleware::auth::AuthUser,
    tenant: crate::middleware::tenant::TenantScope,
) -> Result<Json<Value>, AppError> {
    let employees = state
        .kanban_service
        .get_employees(&state.pool, tenant.as_str())
        .await?;

    Ok(Json(json!({ "employees": employees })))
}

// ==================== 🔴2: WS 认证 query 参数 ====================

#[derive(Deserialize)]
pub struct WsQuery {
    pub token: String,
    pub tenant: Option<String>,
}

/// WS /api/kanban/events — WebSocket 事件代理
///
/// 通过 query params 认证（WebSocket 无法设置自定义 header）：
/// - token: JWT 令牌（必填）
/// - tenant: tenant ID（可选，未指定从 user_tenants 推导）
///
/// 🔴2: 手动验证 JWT，不走 auth_middleware
/// 🔴3: 验证后检查 token 黑名单
/// 🔴1: 每 5 秒 CLI poll，维护 HashMap 快照检测变更
pub async fn ws_events(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<WsQuery>,
) -> Result<impl IntoResponse, AppError> {
    // 🔴2: 手动验证 JWT
    let claims = decode::<Claims>(
        &query.token,
        &DecodingKey::from_secret(state.jwt_secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )
    .map_err(|_| AppError::Auth(AuthError::InvalidToken))?
    .claims;

    // 🔴3: 检查 token 黑名单
    if state
        .auth_service
        .is_token_blacklisted(&state.pool, &query.token)
        .await?
    {
        return Err(AppError::Auth(AuthError::InvalidToken));
    }

    // 🟡1: 检查账号是否被禁用（与 auth_middleware 逻辑一致）
    let enabled: i32 = sqlx::query_scalar("SELECT enabled FROM users WHERE id = ?")
        .bind(&claims.sub)
        .fetch_optional(&state.pool)
        .await?
        .unwrap_or(0);
    if enabled == 0 {
        return Err(AppError::Auth(AuthError::AccountDisabled));
    }

    // 确定 tenant
    let tenant_id = match query.tenant {
        Some(t) => {
            if !crate::middleware::tenant::is_valid_tenant_id(&t) {
                return Err(AppError::BadRequest("无效的 tenant ID".to_string()));
            }
            if !crate::services::kanban::KanbanService::check_tenant_access(
                &state.pool,
                &claims.sub,
                &t,
            )
            .await?
            {
                return Err(AppError::Forbidden("无权访问该 tenant".to_string()));
            }
            t
        }
        None => {
            crate::services::kanban::KanbanService::get_tenant_for_user(&state.pool, &claims.sub)
                .await?
        }
    };

    Ok(ws.on_upgrade(move |socket| handle_ws(socket, state, tenant_id)))
}

/// 🟢10: 使用常量替代硬编码
/// 🟢11: 全局连接计数 + 上限检查
async fn handle_ws(mut socket: WebSocket, state: AppState, tenant_id: String) {
    // 🟢11: 检查连接上限
    let current = WS_CONNECTION_COUNT.fetch_add(1, Ordering::SeqCst);
    if current >= WS_MAX_CONNECTIONS {
        WS_CONNECTION_COUNT.fetch_sub(1, Ordering::SeqCst);
        tracing::warn!("WebSocket 连接数已达上限 ({}/{}), tenant: {}", current, WS_MAX_CONNECTIONS, tenant_id);
        let _ = socket
            .send(Message::Close(Some(axum::extract::ws::CloseFrame {
                code: 1013, // Try Again Later
                reason: "服务器连接数已满，请稍后重试".into(),
            })))
            .await;
        return;
    }

    tracing::info!("WebSocket 连接建立, tenant: {}, 当前连接数: {}", tenant_id, current + 1);

    // 🟢10: 使用常量定义轮询间隔
    let mut poll_interval = interval(Duration::from_secs(WS_POLL_INTERVAL_SECS));
    let mut heartbeat_interval = interval(Duration::from_secs(WS_HEARTBEAT_INTERVAL_SECS));
    // 快照：task_id → (status, assignee)，用于检测变更和认领
    let mut snapshot: HashMap<String, (String, String)> = HashMap::new();

    // 🟢11: 连接退出时减少计数
    struct ConnectionGuard;
    impl Drop for ConnectionGuard {
        fn drop(&mut self) {
            WS_CONNECTION_COUNT.fetch_sub(1, Ordering::SeqCst);
        }
    }
    let _guard = ConnectionGuard;

    loop {
        tokio::select! {
            // 每 30 秒发送心跳
            _ = heartbeat_interval.tick() => {
                let hb = json!({ "type": "heartbeat" });
                let payload = serde_json::to_string(&hb).unwrap_or_default();
                if socket.send(Message::Text(payload)).await.is_err() {
                    tracing::info!("WebSocket heartbeat 发送失败，客户端断开");
                    return;
                }
            }
            // 每 5 秒轮询 CLI
            _ = poll_interval.tick() => {
                match state.kanban_service.list_tasks_json(&tenant_id).await {
                    Ok(tasks) => {
                        // 本轮出现的 task_id 集合，用于检测删除
                        let mut seen_ids: std::collections::HashSet<String> = std::collections::HashSet::new();

                        for task in &tasks {
                            let task_id = match task.get("id").and_then(|v| v.as_str()) {
                                Some(id) if !id.is_empty() => id.to_string(),
                                _ => continue,
                            };
                            seen_ids.insert(task_id.clone());

                            let status = task
                                .get("status")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();
                            let assignee = task
                                .get("assignee")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();

                            let event = if let Some((old_status, old_assignee)) = snapshot.get(&task_id) {
                                if *old_status != status {
                                    // 状态变更 → task_changed
                                    Some(json!({
                                        "type": "task_changed",
                                        "task_id": task_id,
                                        "old_status": old_status,
                                        "new_status": status,
                                        "task": task,
                                    }))
                                } else if !old_assignee.is_empty() && old_assignee != &assignee && !assignee.is_empty() {
                                    // assignee 变更 → task_claimed
                                    Some(json!({
                                        "type": "task_claimed",
                                        "task_id": task_id,
                                        "old_assignee": old_assignee,
                                        "new_assignee": assignee,
                                        "task": task,
                                    }))
                                } else {
                                    None
                                }
                            } else {
                                // 新任务 → task_created
                                Some(json!({
                                    "type": "task_created",
                                    "task_id": task_id,
                                    "task": task,
                                }))
                            };

                            snapshot.insert(task_id, (status, assignee));

                            if let Some(evt) = event {
                                let payload = serde_json::to_string(&evt).unwrap_or_default();
                                if socket.send(Message::Text(payload)).await.is_err() {
                                    tracing::info!("WebSocket 发送失败，客户端断开");
                                    return;
                                }
                            }
                        }

                        // 检测删除：快照中有但本轮没出现的 task_id
                        let deleted_ids: Vec<String> = snapshot.keys()
                            .filter(|id| !seen_ids.contains(*id))
                            .cloned()
                            .collect();

                        for deleted_id in deleted_ids {
                            let evt = json!({
                                "type": "task_deleted",
                                "task_id": deleted_id,
                            });
                            let payload = serde_json::to_string(&evt).unwrap_or_default();
                            if socket.send(Message::Text(payload)).await.is_err() {
                                tracing::info!("WebSocket 发送失败，客户端断开");
                                return;
                            }
                            snapshot.remove(&deleted_id);
                        }
                    }
                    Err(e) => {
                        tracing::warn!("轮询 kanban 任务失败: {:?}", e);
                    }
                }
            }
            // 接收客户端消息（心跳或关闭）
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Close(_))) | None => {
                        tracing::info!("WebSocket 连接关闭, tenant: {}", tenant_id);
                        return;
                    }
                    Some(Ok(Message::Ping(data))) => {
                        let _ = socket.send(Message::Pong(data)).await;
                    }
                    _ => {}
                }
            }
        }
    }
}
