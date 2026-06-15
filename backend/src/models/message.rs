use serde::{Deserialize, Serialize};

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Message {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub metadata: Option<String>,
    pub created_at: String,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct CreateMessage {
    pub role: String,
    pub content: String,
}

#[allow(dead_code)]
#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub id: String,
    pub role: String,
    pub content: String,
    pub created_at: String,
}

impl From<Message> for MessageResponse {
    fn from(msg: Message) -> Self {
        Self {
            id: msg.id,
            role: msg.role,
            content: msg.content,
            created_at: msg.created_at,
        }
    }
}

#[allow(dead_code)]
#[derive(Debug, Serialize)]
pub struct MessageListResponse {
    pub messages: Vec<MessageResponse>,
    pub total: i64,
}
