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
    ServiceUnavailable(String),
}

#[derive(Debug)]
pub enum AuthError {
    MissingToken,
    InvalidToken,
    #[allow(dead_code)]
    ExpiredToken,
    WrongPassword,
    UserNotFound,
    AccountDisabled,
    UserExists,
    PasswordHashError,
    TokenGenerationFailed,
}

/// 检查 SQLite 错误是否为 UNIQUE 约束冲突
fn is_unique_constraint_error(e: &sqlx::Error) -> bool {
    match e {
        sqlx::Error::Database(db_err) => {
            // SQLite UNIQUE constraint 错误码为 19 (SQLITE_CONSTRAINT)
            db_err.code().is_some_and(|code| code == "2067")
                || db_err.message().contains("UNIQUE constraint failed")
        }
        _ => false,
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::Database(e) => {
                tracing::error!("数据库错误: {}", e);
                let msg = if is_unique_constraint_error(&e) {
                    "数据已存在，不能重复创建"
                } else {
                    "数据库错误"
                };
                (StatusCode::INTERNAL_SERVER_ERROR, msg.to_string())
            }
            AppError::Auth(e) => match e {
                AuthError::MissingToken => (StatusCode::UNAUTHORIZED, "缺少认证令牌".to_string()),
                AuthError::InvalidToken => (StatusCode::UNAUTHORIZED, "无效的认证令牌".to_string()),
                AuthError::ExpiredToken => (StatusCode::UNAUTHORIZED, "令牌已过期".to_string()),
                AuthError::WrongPassword => (StatusCode::UNAUTHORIZED, "密码错误".to_string()),
                AuthError::UserNotFound => (StatusCode::UNAUTHORIZED, "用户不存在".to_string()),
                AuthError::AccountDisabled => (
                    StatusCode::FORBIDDEN,
                    "账户已被禁用，请联系管理员".to_string(),
                ),
                AuthError::UserExists => (StatusCode::CONFLICT, "用户名已存在".to_string()),
                AuthError::PasswordHashError => {
                    tracing::error!("密码哈希处理失败");
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        "密码处理错误".to_string(),
                    )
                }
                AuthError::TokenGenerationFailed => {
                    tracing::error!("JWT Token 生成失败");
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        "认证服务异常".to_string(),
                    )
                }
            },
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::Forbidden(msg) => {
                tracing::warn!("访问被拒绝: {}", msg);
                (StatusCode::FORBIDDEN, "访问被拒绝".to_string())
            }
            AppError::ServiceUnavailable(detail) => {
                tracing::error!("上游服务不可用: {}", detail);
                (
                    StatusCode::SERVICE_UNAVAILABLE,
                    "AI服务暂时不可用".to_string(),
                )
            }
            AppError::Internal(msg) => {
                tracing::error!("内部错误: {}", msg);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "内部服务器错误".to_string(),
                )
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
