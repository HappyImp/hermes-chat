use serde::Deserialize;
use serde_json::{json, Value};

use crate::db::DbPool;
use crate::errors::AppError;

#[derive(Clone)]
pub struct EmployeeService;

impl Default for EmployeeService {
    fn default() -> Self {
        Self
    }
}

impl EmployeeService {
    pub fn new() -> Self {
        Self
    }

    /// 查询用户有权访问的员工列表（默认 tenant）
    pub async fn list_allowed(&self, pool: &DbPool, user_id: &str) -> Result<Vec<Value>, AppError> {
        self.list_allowed_for_tenant(pool, user_id, "default").await
    }

    /// 查询用户在指定 tenant 下有权访问的员工列表
    ///
    /// # Arguments
    /// * `pool` — 数据库连接池
    /// * `user_id` — 用户 ID
    /// * `tenant` — tenant ID
    pub async fn list_allowed_for_tenant(
        &self,
        pool: &DbPool,
        user_id: &str,
        tenant: &str,
    ) -> Result<Vec<Value>, AppError> {
        let permissions = sqlx::query_as::<_, PermissionRow>(
            "SELECT employee, allowed, tenant FROM permissions WHERE user_id = ? AND tenant = ? AND allowed = 1",
        )
        .bind(user_id)
        .bind(tenant)
        .fetch_all(pool)
        .await?;

        let employees: Vec<Value> = permissions
            .into_iter()
            .map(|p| {
                json!({
                    "name": p.employee,
                    "tenant": p.tenant,
                    "allowed": true
                })
            })
            .collect();

        Ok(employees)
    }

    /// 查询用户在所有 tenant 下的权限
    pub async fn list_all_tenants(
        &self,
        pool: &DbPool,
        user_id: &str,
    ) -> Result<Vec<Value>, AppError> {
        let permissions = sqlx::query_as::<_, PermissionRow>(
            "SELECT employee, allowed, tenant FROM permissions WHERE user_id = ? AND allowed = 1",
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?;

        let employees: Vec<Value> = permissions
            .into_iter()
            .map(|p| {
                json!({
                    "name": p.employee,
                    "tenant": p.tenant,
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
    #[allow(dead_code)]
    pub allowed: i32,
    pub tenant: String,
}
