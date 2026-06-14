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
            .map_err(|e| AppError::Internal(format!("Hermes 请求失败: {}", e)))?;

        Ok(response)
    }
}
