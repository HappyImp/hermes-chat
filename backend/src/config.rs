use config::Config;
use serde::Deserialize;

#[derive(Debug, Deserialize, Clone)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub jwt: JwtConfig,
    pub hermes: HermesConfig,
    #[allow(dead_code)]
    pub rate_limit: RateLimitConfig,
    pub security: SecurityConfig,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Deserialize, Clone)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct JwtConfig {
    pub secret: String,
    pub expires_in_hours: i64,
}

#[derive(Debug, Deserialize, Clone)]
pub struct HermesConfig {
    pub gateway_url: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct RateLimitConfig {
    #[allow(dead_code)]
    pub max_requests_per_minute: usize,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SecurityConfig {
    #[allow(dead_code)]
    pub max_message_length: usize,
    pub allowed_origins: Vec<String>,
}

impl AppConfig {
    pub fn load() -> Result<Self, config::ConfigError> {
        let config = Config::builder()
            .add_source(config::File::with_name("config/default"))
            .add_source(config::Environment::with_prefix("APP").separator("__"))
            .build()?;

        config.try_deserialize()
    }

    pub fn bind_addr(&self) -> String {
        format!("{}:{}", self.server.host, self.server.port)
    }
}
