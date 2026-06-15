use axum::extract::ws::{Message, WebSocket};
use axum::{
    extract::{Query, State},
    response::IntoResponse,
    Json,
};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;

use crate::errors::AppError;
use crate::middleware::auth::{AuthUser, Claims};
use crate::middleware::tenant::TenantScope;
use crate::AppState;

/// GET /api/kanban/tasks — 返回任务列表 JSON
pub async fn list_tasks(
    State(state): State<AppState>,
    _auth: AuthUser,
    tenant: TenantScope,
) -> Result<Json<Value>, AppError> {
    let tasks = state.kanban_service.list_tasks(tenant.as_str()).await?;

    Ok(Json(json!({ "tasks": tasks })))
}

/// GET /api/kanban/tasks/:id — 返回任务详情 JSON
pub async fn get_task(
    State(state): State<AppState>,
    _auth: AuthUser,
    tenant: TenantScope,
    axum::extract::Path(task_id): axum::extract::Path<String>,
) -> Result<Json<Value>, AppError> {
    let task = state
        .kanban_service
        .get_task(&task_id, tenant.as_str())
        .await?;

    Ok(Json(json!({ "task": task })))
}

/// GET /api/kanban/stats — 返回看板统计 JSON
pub async fn get_stats(
    State(state): State<AppState>,
    _auth: AuthUser,
    tenant: TenantScope,
) -> Result<Json<Value>, AppError> {
    let stats = state.kanban_service.get_stats(tenant.as_str()).await?;

    Ok(Json(stats))
}

/// GET /api/kanban/employees — 返回员工列表 JSON
pub async fn get_employees(
    State(state): State<AppState>,
    _auth: AuthUser,
    tenant: TenantScope,
) -> Result<Json<Value>, AppError> {
    let employees = state
        .kanban_service
        .get_employees(&state.pool, tenant.as_str())
        .await?;

    Ok(Json(json!({ "employees": employees })))
}

// ==================== KAN-206: WebSocket 事件代理 ====================

const HERMES_BIN: &str = "/opt/hermes/.venv/bin/hermes";
const WS_POLL_INTERVAL_SECS: u64 = 5;

#[derive(Debug, Deserialize)]
pub struct WsQuery {
    pub token: String,
    pub tenant: Option<String>,
}

/// GET /api/kanban/events?token=<jwt>&tenant=<tenant_id>
///
/// WebSocket 事件代理：认证后每 5 秒轮询任务列表，检测状态变化推送客户端。
/// 因为浏览器 WebSocket API 无法设置 Authorization header，
/// 所以从 query param 获取 token 并手动验证。
pub async fn ws_events(
    State(state): State<AppState>,
    Query(query): Query<WsQuery>,
    ws: axum::extract::WebSocketUpgrade,
) -> impl IntoResponse {
    // 验证 JWT
    let claims = match decode::<Claims>(
        &query.token,
        &DecodingKey::from_secret(state.jwt_secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    ) {
        Ok(token_data) => token_data.claims,
        Err(_) => {
            return Err(AppError::from(crate::errors::AuthError::InvalidToken));
        }
    };

    // 检查 token 是否在黑名单中
    if state
        .auth_service
        .is_token_blacklisted(&state.pool, &query.token)
        .await?
    {
        return Err(AppError::from(crate::errors::AuthError::InvalidToken));
    }

    // 解析 tenant_id
    let tenant_id = if let Some(ref t) = query.tenant {
        if !crate::middleware::tenant::is_valid_tenant_id(t) {
            return Err(AppError::BadRequest("无效的 tenant ID".to_string()));
        }
        // 验证用户有权访问该 tenant
        if !crate::services::kanban::KanbanService::check_tenant_access(&state.pool, &claims.sub, t)
            .await?
        {
            return Err(AppError::Forbidden(format!("无权访问 tenant: {}", t)));
        }
        t.clone()
    } else {
        crate::services::kanban::KanbanService::get_tenant_for_user(&state.pool, &claims.sub)
            .await?
    };

    Ok(ws.on_upgrade(move |socket| handle_ws_connection(socket, state, tenant_id)))
}

/// WebSocket 连接处理：轮询任务列表，检测变化推送
async fn handle_ws_connection(mut socket: WebSocket, _state: AppState, tenant_id: String) {
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(WS_POLL_INTERVAL_SECS));
    // 上一次快照：task_id -> status
    let mut prev_snapshot: HashMap<String, String> = HashMap::new();

    loop {
        tokio::select! {
            // 检查客户端是否断开
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Close(_))) | None => {
                        tracing::debug!("WebSocket 客户端断开");
                        break;
                    }
                    _ => {} // 忽略客户端发来的其他消息
                }
            }
            // 定时轮询
            _ = interval.tick() => {
                let tasks_json = match tokio::task::spawn_blocking({
                    let bin = HERMES_BIN.to_string();
                    let tid = tenant_id.clone();
                    move || {
                        std::process::Command::new(&bin)
                            .args(["kanban", "list", "--json", "--tenant", &tid])
                            .output()
                    }
                }).await {
                    Ok(Ok(o)) if o.status.success() => {
                        String::from_utf8_lossy(&o.stdout).to_string()
                    }
                    Ok(Ok(o)) => {
                        tracing::warn!("kanban list 失败: {}", String::from_utf8_lossy(&o.stderr));
                        continue;
                    }
                    Ok(Err(e)) => {
                        tracing::warn!("kanban list 执行失败: {}", e);
                        continue;
                    }
                    Err(e) => {
                        tracing::warn!("spawn_blocking 失败: {}", e);
                        continue;
                    }
                };

                // 解析任务列表
                let tasks: Vec<Value> = match serde_json::from_str::<Value>(&tasks_json) {
                    Ok(v) => {
                        if let Some(arr) = v.as_array() {
                            arr.clone()
                        } else if let Some(arr) = v.get("tasks").and_then(|t| t.as_array()) {
                            arr.clone()
                        } else {
                            vec![]
                        }
                    }
                    Err(e) => {
                        tracing::warn!("kanban list JSON 解析失败: {}", e);
                        continue;
                    }
                };

                // 构建当前快照
                let mut curr_snapshot: HashMap<String, String> = HashMap::new();
                for task in &tasks {
                    if let (Some(id), Some(status)) = (
                        task.get("id").and_then(|v| v.as_str()),
                        task.get("status").and_then(|v| v.as_str()),
                    ) {
                        curr_snapshot.insert(id.to_string(), status.to_string());
                    }
                }

                // 检测变化
                for (task_id, new_status) in &curr_snapshot {
                    if let Some(old_status) = prev_snapshot.get(task_id) {
                        if old_status != new_status {
                            let event = json!({
                                "event": "task_changed",
                                "task_id": task_id,
                                "old_status": old_status,
                                "new_status": new_status,
                            });
                            if socket.send(Message::Text(event.to_string())).await.is_err() {
                                return; // 客户端已断开
                            }
                        }
                    }
                }

                // 检测新增任务
                for (task_id, status) in &curr_snapshot {
                    if !prev_snapshot.contains_key(task_id) {
                        let event = json!({
                            "event": "task_created",
                            "task_id": task_id,
                            "status": status,
                        });
                        if socket.send(Message::Text(event.to_string())).await.is_err() {
                            return;
                        }
                    }
                }

                prev_snapshot = curr_snapshot;
            }
        }
    }
}
