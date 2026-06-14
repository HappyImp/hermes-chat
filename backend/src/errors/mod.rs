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
                tracing::error!("数据库错误: {}", e);
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
                    (StatusCode::INTERNAL_SERVER_ERROR, "密码处理错误".to_string())
                }
            },
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::Forbidden(msg) => (StatusCode::FORBIDDEN, msg),
            AppError::Internal(msg) => {
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