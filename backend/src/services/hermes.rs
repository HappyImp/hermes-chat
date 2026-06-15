use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::errors::AppError;

#[derive(Debug, Serialize)]
pub struct HermesChatRequest {
    pub model: String,
    pub messages: Vec<HermesMessage>,
    pub stream: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HermesMessage {
    pub role: String,
    pub content: String,
}

#[derive(Clone)]
pub struct HermesClient {
    client: Client,
    gateway_url: String,
}

impl HermesClient {
    pub fn new(gateway_url: String) -> Self {
        Self {
            client: Client::new(),
            gateway_url,
        }
    }

    pub async fn chat_completion(
        &self,
        employee: &str,
        messages: Vec<HermesMessage>,
    ) -> Result<reqwest::Response, AppError> {
        let url = format!("{}/v1/chat/completions", self.gateway_url);

        let request = HermesChatRequest {
            model: employee.to_string(),
            messages,
            stream: true,
        };

        let response = self
            .client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| AppError::ServiceUnavailable(format!("Hermes 请求失败: {}", e)))?;

        // 透传上游状态码，返回具体错误
        let status = response.status();
        if !status.is_success() {
            let status_code = status.as_u16();
            let body_text = response.text().await.unwrap_or_default();
            tracing::warn!(
                "Hermes 上游返回错误: status={}, body={}",
                status_code,
                body_text
            );

            return match status_code {
                429 => Err(AppError::ServiceUnavailable(
                    "AI服务繁忙，请稍后再试".to_string(),
                )),
                503 => Err(AppError::ServiceUnavailable("AI服务暂时不可用".to_string())),
                _ => Err(AppError::ServiceUnavailable(format!(
                    "AI服务异常 (HTTP {})",
                    status_code
                ))),
            };
        }

        Ok(response)
    }
}
