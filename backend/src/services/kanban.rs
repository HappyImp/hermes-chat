use serde_json::Value;

use crate::errors::AppError;
use crate::models::kanban::{KanbanStats, KanbanTask};

#[derive(Clone)]
pub struct KanbanService;

impl Default for KanbanService {
    fn default() -> Self {
        Self
    }
}

impl KanbanService {
    pub fn new() -> Self {
        Self
    }

    /// 查询看板任务列表
    /// 先返回 stub 数据，后续对接 hermes kanban CLI
    pub async fn list_tasks(&self, _tenant_id: &str) -> Result<Vec<KanbanTask>, AppError> {
        // TODO: 对接 hermes kanban list --tenant <tenant_id> --json
        Ok(vec![])
    }

    /// 查询单个任务详情
    pub async fn get_task(&self, _task_id: &str) -> Result<Value, AppError> {
        // TODO: 对接 hermes kanban show <task_id> --json
        Err(AppError::NotFound("任务不存在".to_string()))
    }

    /// 查询看板统计
    pub async fn get_stats(&self) -> Result<KanbanStats, AppError> {
        // TODO: 对接 hermes kanban stats --json
        Ok(KanbanStats {
            total: 0,
            todo: 0,
            doing: 0,
            done: 0,
        })
    }

    /// 查询员工列表（从 kanban profiles 推导）
    pub async fn get_employees(&self, _tenant_id: &str) -> Result<Vec<Value>, AppError> {
        // TODO: 对接 hermes kanban profiles + assignees
        Ok(vec![])
    }

    /// 从 user_tenants 表查询用户的 tenant_id
    pub async fn get_tenant_for_user(
        pool: &crate::db::DbPool,
        user_id: &str,
    ) -> Result<String, AppError> {
        let row: Option<(String,)> =
            sqlx::query_as("SELECT tenant_id FROM user_tenants WHERE user_id = ? LIMIT 1")
                .bind(user_id)
                .fetch_optional(pool)
                .await?;

        Ok(row.map(|(t,)| t).unwrap_or_else(|| "default".to_string()))
    }
}
