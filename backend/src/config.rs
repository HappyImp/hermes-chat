use config::Config;
use serde::Deserialize;

#[derive(Debug, Deserialize, Clone)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub jwt: JwtConfig,
    pub hermes: HermesConfig,
    pub kanban: KanbanConfig,
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
    pub api_key: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct KanbanConfig {
    /// kanban SQLite 数据库路径
    pub db_path: String,
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

    /// 解析 kanban 数据库路径（展开 ~ 为 home 目录）
    /// HOME 不存在或展开后路径无效时回退 /root（防止 ops 部署任务继承错误 HOME）
    pub fn kanban_db_url(&self) -> String {
        let path = if self.kanban.db_path.starts_with("~/") {
            let home = match std::env::var("HOME") {
                Ok(h) if !h.is_empty() => h,
                _ => "/root".to_string(),
            };
            let expanded = format!("{}{}", home, &self.kanban.db_path[1..]);
            // 如果展开后路径的父目录不存在，回退到 /root
            if std::path::Path::new(&expanded)
                .parent()
                .map_or(false, |p| p.exists())
            {
                expanded
            } else {
                format!("/root{}", &self.kanban.db_path[1..])
            }
        } else {
            self.kanban.db_path.clone()
        };
        format!("sqlite:{}?mode=ro", path)
    }
}
