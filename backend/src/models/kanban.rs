use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserTenant {
    pub id: String,
    pub user_id: String,
    pub tenant_id: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct KanbanTask {
    pub id: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assignee: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tenant: Option<String>,
    pub priority: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_by: Option<String>,
    pub created_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KanbanStats {
    pub total: i64,
    pub todo: i64,
    pub doing: i64,
    pub done: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KanbanEvent {
    pub event_type: String,
    pub task_id: String,
    pub data: serde_json::Value,
}

/// 员工信息（从 hermes profile + kanban assignees 推导）
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EmployeeInfo {
    /// profile 名称
    pub name: String,
    /// 角色描述（来自 profile describe）
    pub role: String,
    /// 状态：working / standby / off
    pub status: String,
}
