use std::collections::HashMap;

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

/// 🔴1: WebSocket 连接处理 — CLI poll + HashMap 快照
///
/// 每 5 秒执行 `hermes kanban list --json --tenant <tenant_id>`
/// 对比快照检测 task_changed / task_created 事件
async fn handle_ws(mut socket: WebSocket, state: AppState, tenant_id: String) {
    tracing::info!("WebSocket 连接建立, tenant: {}", tenant_id);

    let mut poll_interval = interval(Duration::from_secs(5));
    // 快照：task_id → status，用于检测变更
    let mut snapshot: HashMap<String, String> = HashMap::new();

    loop {
        tokio::select! {
            // 每 5 秒轮询 CLI
            _ = poll_interval.tick() => {
                match state.kanban_service.list_tasks_json(&tenant_id).await {
                    Ok(tasks) => {
                        for task in &tasks {
                            let task_id = match task.get("id").and_then(|v| v.as_str()) {
                                Some(id) if !id.is_empty() => id.to_string(),
                                _ => continue,
                            };
                            let status = task
                                .get("status")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();

                            let event = if let Some(old_status) = snapshot.get(&task_id) {
                                if *old_status != status {
                                    Some(json!({
                                        "type": "task_changed",
                                        "task_id": task_id,
                                        "old_status": old_status,
                                        "new_status": status,
                                        "task": task,
                                    }))
                                } else {
                                    None
                                }
                            } else {
                                Some(json!({
                                    "type": "task_created",
                                    "task_id": task_id,
                                    "task": task,
                                }))
                            };

                            snapshot.insert(task_id, status);

                            if let Some(evt) = event {
                                let payload = serde_json::to_string(&evt).unwrap_or_default();
                                if socket.send(Message::Text(payload)).await.is_err() {
                                    tracing::info!("WebSocket 发送失败，客户端断开");
                                    return;
                                }
                            }
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
