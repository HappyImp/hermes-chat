use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Session {
    pub id: String,
    pub user_id: String,
    pub title: String,
    pub channel: String,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSession {
    pub title: Option<String>,
    pub channel: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SessionResponse {
    pub id: String,
    pub title: String,
    pub channel: String,
    pub created_at: String,
    pub updated_at: String,
}

impl From<Session> for SessionResponse {
    fn from(session: Session) -> Self {
        Self {
            id: session.id,
            title: session.title,
            channel: session.channel,
            created_at: session.created_at,
            updated_at: session.updated_at,
        }
    }
}
