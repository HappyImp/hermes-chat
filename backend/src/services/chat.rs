use uuid::Uuid;
use chrono::Utc;

use crate::db::DbPool;
use crate::errors::AppError;
use crate::models::message::{Message, MessageResponse, MessageListResponse};

#[allow(dead_code)]
pub struct ChatService;

impl ChatService {
    #[allow(dead_code)]
    pub async fn get_messages(
        pool: &DbPool,
        session_id: &str,
        limit: i64,
        offset: i64,
    ) -> Result<MessageListResponse, AppError> {
        let messages = sqlx::query_as::<_, Message>(
            "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?"
        )
        .bind(session_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        let total: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM messages WHERE session_id = ?"
        )
        .bind(session_id)
        .fetch_one(pool)
        .await?;

        Ok(MessageListResponse {
            messages: messages.into_iter().map(Into::into).collect(),
            total: total.0,
        })
    }

    #[allow(dead_code)]
    pub async fn save_message(
        pool: &DbPool,
        session_id: &str,
        role: &str,
        content: &str,
    ) -> Result<MessageResponse, AppError> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        sqlx::query(
            "INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(session_id)
        .bind(role)
        .bind(content)
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(MessageResponse {
            id,
            role: role.to_string(),
            content: content.to_string(),
            created_at: now,
        })
    }
}
