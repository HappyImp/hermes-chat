use uuid::Uuid;
use chrono::Utc;

use crate::db::DbPool;
use crate::errors::AppError;
use crate::models::session::{CreateSession, Session, SessionResponse};

pub struct SessionService;

impl SessionService {
    pub async fn list(pool: &DbPool, user_id: &str) -> Result<Vec<SessionResponse>, AppError> {
        let sessions = sqlx::query_as::<_, Session>(
            "SELECT * FROM sessions WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC"
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?;

        Ok(sessions.into_iter().map(Into::into).collect())
    }

    pub async fn create(
        pool: &DbPool,
        user_id: &str,
        input: CreateSession,
    ) -> Result<SessionResponse, AppError> {
        let id = Uuid::new_v4().to_string();
        let title = input.title.unwrap_or_else(|| "新会话".to_string());
        let channel = input.channel.unwrap_or_else(|| "default".to_string());
        let now = Utc::now().to_rfc3339();

        sqlx::query(
            "INSERT INTO sessions (id, user_id, title, channel, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(user_id)
        .bind(&title)
        .bind(&channel)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(SessionResponse {
            id,
            title,
            channel,
            created_at: now.clone(),
            updated_at: now,
        })
    }

    pub async fn delete(pool: &DbPool, user_id: &str, session_id: &str) -> Result<(), AppError> {
        let now = Utc::now().to_rfc3339();

        let result = sqlx::query(
            "UPDATE sessions SET deleted_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL"
        )
        .bind(&now)
        .bind(session_id)
        .bind(user_id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound("会话不存在".to_string()));
        }

        Ok(())
    }

    #[allow(dead_code)]
    pub async fn get_by_id(pool: &DbPool, session_id: &str) -> Result<Session, AppError> {
        let session = sqlx::query_as::<_, Session>(
            "SELECT * FROM sessions WHERE id = ? AND deleted_at IS NULL"
        )
        .bind(session_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("会话不存在".to_string()))?;

        Ok(session)
    }
}
