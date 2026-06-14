use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

#[derive(Debug)]
pub enum AppError {
    Database(sqlx::Error),
    Auth(AuthError),
    NotFound(String),
    BadRequest(String),
    Forbidden(String),
    Internal(String),
}

#[derive(Debug)]
pub enum AuthError {
    MissingToken,
    InvalidToken,
    ExpiredToken,
    WrongPassword,
    UserNotFound,
    UserExists,
    PasswordHashError,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::Database(e) => {
                // 内部日志：记录完整错误上下文
                tracing::error!("数据库错误: {}", e);
                // 用户可见：通用消息，不暴露内部细节
                (StatusCode::INTERNAL_SERVER_ERROR, "数据库错误".to_string())
            }
            AppError::Auth(e) => match e {
                AuthError::MissingToken => (StatusCode::UNAUTHORIZED, "缺少认证令牌".to_string()),
                AuthError::InvalidToken => (StatusCode::UNAUTHORIZED, "无效的认证令牌".to_string()),
                AuthError::ExpiredToken => (StatusCode::UNAUTHORIZED, "令牌已过期".to_string()),
                AuthError::WrongPassword => (StatusCode::UNAUTHORIZED, "密码错误".to_string()),
                AuthError::UserNotFound => (StatusCode::UNAUTHORIZED, "用户不存在".to_string()),
                AuthError::UserExists => (StatusCode::CONFLICT, "用户名已存在".to_string()),
                AuthError::PasswordHashError => {
                    // 密码哈希失败属于服务端异常，需记录日志
                    tracing::error!("密码哈希处理失败");
                    (StatusCode::INTERNAL_SERVER_ERROR, "密码处理错误".to_string())
                }
            },
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::Forbidden(msg) => {
                // 禁止访问记录 warn 级别日志（可能是权限配置问题或异常访问）
                tracing::warn!("访问被拒绝: {}", msg);
                (StatusCode::FORBIDDEN, msg)
            }
            AppError::Internal(msg) => {
                // 内部错误：日志记录完整信息，用户只看到通用消息
                tracing::error!("内部错误: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, "内部服务器错误".to_string())
            }
        };

        (status, Json(json!({ "error": message }))).into_response()
    }
}

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        AppError::Database(e)
    }
}

impl From<AuthError> for AppError {
    fn from(e: AuthError) -> Self {
        AppError::Auth(e)
    }
}