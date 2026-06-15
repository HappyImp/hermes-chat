use axum::{
    extract::State,
    response::sse::{Event, Sse},
    Json,
};
use futures::stream::Stream;
use serde::{Deserialize, Serialize};
use std::convert::Infallible;

use crate::errors::AppError;
use crate::middleware::auth::AuthUser;
use crate::services::hermes::HermesMessage;
use crate::AppState;

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    #[allow(dead_code)]
    pub session_id: String,
    pub employee: String,
    pub messages: Vec<ChatMessage>,
    #[allow(dead_code)]
    pub stream: Option<bool>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

pub async fn completions(
    State(state): State<AppState>,
    _auth: AuthUser,
    Json(req): Json<ChatRequest>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, AppError> {
    // 转换消息格式
    let hermes_messages: Vec<HermesMessage> = req
        .messages
        .into_iter()
        .map(|m| HermesMessage {
            role: m.role,
            content: m.content,
        })
        .collect();

    // 请求 Hermes
    let response = state
        .hermes_client
        .chat_completion(&req.employee, hermes_messages)
        .await?;

    // 创建 SSE 流
    let stream = async_stream::stream! {
        let mut stream = response.bytes_stream();

        while let Some(chunk) = futures::StreamExt::next(&mut stream).await {
            match chunk {
                Ok(bytes) => {
                    let text = String::from_utf8_lossy(&bytes);
                    for line in text.lines() {
                        if let Some(data) = line.strip_prefix("data: ") {
                            if data == "[DONE]" {
                                yield Ok(Event::default().data("[DONE]"));
                            } else {
                                yield Ok(Event::default().data(data));
                            }
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!("SSE 流读取错误: {}", e);
                    yield Ok(Event::default().event("error").data("数据流异常，请重试"));
                    break;
                }
            }
        }
    };

    Ok(Sse::new(stream))
}
