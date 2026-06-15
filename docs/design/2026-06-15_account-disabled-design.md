# 技术设计：账户禁用功能

## 1. 架构概览

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Frontend   │────▶│   Rust Backend  │────▶│  Hermes Gateway  │
│  (Vue/TS)    │◀────│   (axum/sqlx)   │◀────│    (port 8642)   │
└─────────────┘     └─────────────────┘     └──────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   SQLite    │
                    │  (hermes.db)│
                    └─────────────┘
```

### 1.1 数据流

1. **认证流程**：
   ```
   Frontend → POST /api/auth/login (username/password)
            → Rust 验证密码
            → 检查 enabled 字段
            → 如果 enabled=0，返回 403
            → 否则返回 JWT token
   ```

2. **API 访问拦截**：
   ```
   Frontend → GET /api/... (JWT)
            → auth_middleware 验证 JWT
            → 查询 users.enabled
            → 如果 enabled=0，返回 403
            → 否则继续处理请求
   ```

## 2. 错误处理架构

### 2.1 错误枚举设计

```rust
// 后端错误类型层次
AppError
├── Database(sqlx::Error)
├── Auth(AuthError)          ← 账户禁用错误在这里
│   ├── MissingToken
│   ├── InvalidToken
│   ├── ExpiredToken
│   ├── WrongPassword
│   ├── UserNotFound
│   ├── AccountDisabled      ← 唯一的账户禁用枚举
│   ├── UserExists
│   ├── PasswordHashError
│   └── TokenGenerationFailed
├── NotFound(String)
├── BadRequest(String)
├── Forbidden(String)
├── Internal(String)
└── ServiceUnavailable(String)
```

### 2.2 设计原则

1. **单一错误源**：`AccountDisabled` 只在 `AuthError` 中定义，不在 `AppError` 中重复
2. **错误包装**：`AppError::Auth(AuthError::AccountDisabled)` 包装使用
3. **统一响应**：所有错误返回 `{"error": "..."}` 格式

### 2.3 修复说明

**修复前**：
```rust
// 两处重复定义
AppError::AccountDisabled        // 错误：在 AppError 中重复
AuthError::AccountDisabled       // 正确：在 AuthError 中
```

**修复后**：
```rust
// 只保留 AuthError 中的定义
AuthError::AccountDisabled       // 唯一定义

// 使用方式
Err(AppError::Auth(AuthError::AccountDisabled))
```

## 3. 数据库设计

### 3.1 users 表扩展

```sql
ALTER TABLE users ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1;
```

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| enabled | INTEGER | 1 | 1=启用，0=禁用 |

### 3.2 索引

```sql
CREATE INDEX idx_users_enabled ON users(enabled);
```

## 4. 认证中间件实现

### 4.1 账户状态检查

```rust
// middleware/auth.rs
pub async fn auth_middleware(
    State(state): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response, AppError> {
    // 1. 提取和验证 JWT
    let (token, claims) = { ... };

    // 2. 检查 token 黑名单
    if state.auth_service.is_token_blacklisted(&state.pool, &token).await? {
        return Err(AppError::Auth(AuthError::InvalidToken));
    }

    // 3. 检查账户是否被禁用 ← 新增
    let enabled: i32 = sqlx::query_scalar("SELECT enabled FROM users WHERE id = ?")
        .bind(&claims.sub)
        .fetch_optional(&state.pool)
        .await?
        .unwrap_or(0);

    if enabled == 0 {
        return Err(AppError::Auth(AuthError::AccountDisabled));
    }

    // 4. 注入 AuthUser 到请求扩展
    req.extensions_mut().insert(AuthUser {
        user_id: claims.sub,
        role: claims.role,
    });

    Ok(next.run(req).await)
}
```

### 4.2 错误响应

```rust
// errors/mod.rs
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::Auth(e) => match e {
                AuthError::AccountDisabled => (
                    StatusCode::FORBIDDEN,
                    "账户已被禁用，请联系管理员".to_string(),
                ),
                // ...
            },
            // ...
        };

        (status, Json(json!({ "error": message }))).into_response()
    }
}
```

## 5. 前端错误处理

### 5.1 错误提取函数

```typescript
// src/api/auth.ts
interface AuthResponse {
  token?: string;
  error?: string;  // 移除了 message 字段
}

function extractError(data: AuthResponse, fallback: string): string {
  return data.error || fallback;  // 移除了 data.message 的 fallback
}
```

### 5.2 设计原则

1. **统一字段**：后端错误统一用 `error` 字段
2. **无 fallback**：前端不再尝试读取 `message` 字段
3. **简洁明确**：错误来源唯一，减少歧义

## 6. 管理员 API

### 6.1 禁用账户

```
POST /api/admin/users/:id/disable
Authorization: Bearer <admin_token>

Response 200:
{
    "message": "账户已禁用"
}
```

### 6.2 启用账户

```
POST /api/admin/users/:id/enable
Authorization: Bearer <admin_token>

Response 200:
{
    "message": "账户已启用"
}
```

## 7. 测试策略

### 7.1 后端测试

- 测试被禁用用户无法登录
- 测试被禁用用户的 token 被拦截
- 测试管理员可禁用/启用用户
- 测试启用后用户可正常访问

### 7.2 前端测试

- 测试错误响应正确提取 `error` 字段
- 测试禁用错误信息正确展示

## 8. 安全考虑

1. **权限控制**：只有管理员可修改账户状态
2. **审计日志**：记录所有禁用/启用操作
3. **即时生效**：禁用后立即拦截，不等待 token 过期
4. **错误信息**：不泄露敏感信息，只提示"联系管理员"
