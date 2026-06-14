use serde::Deserialize;
use serde_json::{json, Value};

use crate::db::DbPool;
use crate::errors::AppError;

#[derive(Clone)]
pub struct EmployeeService;

impl EmployeeService {
    pub fn new() -> Self {
        Self
    }

    /// 查询用户有权访问的员工列表
    pub async fn list_allowed(&self, pool: &DbPool, user_id: &str) -> Result<Vec<Value>, AppError> {
        let permissions = sqlx::query_as::<_, PermissionRow>(
            "SELECT employee, allowed FROM permissions WHERE user_id = ? AND allowed = 1"
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?;

        let employees: Vec<Value> = permissions
            .into_iter()
            .map(|p| {
                json!({
                    "name": p.employee,
                    "allowed": true
                })
            })
            .collect();

        Ok(employees)
    }
}

/// 用于权限查询的轻量结构体，只映射需要的字段
#[derive(Debug, Deserialize, sqlx::FromRow)]
struct PermissionRow {
    pub employee: String,
    pub allowed: i32,
}