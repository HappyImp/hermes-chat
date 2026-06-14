# 技术设计：Rust 后端 + 账户系统

## 1. 架构概览

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Frontend   │────▶│   Rust Backend  │────▶│  Hermes Gateway  │
│  (React/TS)  │◀────│   (axum/sqlx)   │◀────│    (port 8642)   │
└─────────────┘     └─────────────────┘     └──────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   SQLite    │
                    │  (hermes.db)│
                    └─────────────┘
```

### 1.1 数据流

1. **聊天请求**：
   ```
   Frontend → POST /api/chat/completions (JWT)
            → Rust 验证权限
            → 代理到 Hermes /v1/chat/completions
            → SSE 流式返回
   ```

2. **会话管理**：
   ```
   Frontend → GET /api/sessions (JWT)
            → Rust 查询 SQLite（按 user_id 过滤）
            → 返回会话列表
   ```

3. **员工状态**：
   ```
   Frontend → GET /api/employees (JWT)
            → Rust 查询用户权限
            → 代理到 Hermes /api/jobs
            → 按权限过滤返回
   ```

## 2. 技术栈

| 组件 | 选型 | 理由 |
|------|------|------|
| Web 框架 | axum | tokio 团队维护，类型安全，Tower 生态 |
| 数据库 | SQLite | 单机部署简单，无需额外服务 |
| ORM | sqlx | 异步，编译时 SQL 检查 |
| 认证 | JWT + bcrypt | 无状态，安全性高 |
| HTTP 客户端 | reqwest | 异步，支持流式 |
| 序列化 | serde | Rust 生态标准 |
| 日志 | tracing | 结构化日志，支持 tokio |
| 配置 | config | 支持多格式，环境变量覆盖 |

### 2.1 Cargo 依赖

```toml
[dependencies]
axum = { version = "0.7", features = ["macros"] }
tokio = { version = "1", features = ["full"] }
sqlx = { version = "0.8", features = ["runtime-tokio", "sqlite"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
reqwest = { version = "0.12", features = ["stream"] }
jsonwebtoken = "9"
bcrypt = "0.15"
uuid = { version = "1", features = ["v4"] }
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
tower-http = { version = "0.5", features = ["cors", "trace"] }
chrono = { version = "0.4", features = ["serde"] }
config = "0.14"
```

## 3. 数据库设计

### 3.1 ER 图

```
┌─────────────┐       ┌─────────────┐
│   users     │       │  sessions   │
├─────────────┤       ├─────────────┤
│ id (PK)     │◀──┐   │ id (PK)     │
│ username    │   │   │ user_id (FK)│──┐
│ password    │   │   │ title       │  │
│ role        │   │   │ channel     │  │
│ created_at  │   │   │ created_at  │  │
│ updated_at  │   │   │ updated_at  │  │
└─────────────┘   │   └─────────────┘  │
                  │                    │
┌─────────────┐   │   ┌─────────────┐  │
│permissions  │   │   │  messages   │  │
├─────────────┤   │   ├─────────────┤  │
│ id (PK)     │   │   │ id (PK)     │  │
│ user_id (FK)│───┘   │ session_id  │──┘
│ employee    │       │ role        │
│ allowed     │       │ content     │
│ created_at  │       │ metadata    │
└─────────────┘       │ created_at  │
                      └─────────────┘
```

### 3.2 表结构

#### users 表
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_username ON users(username);
```

#### sessions 表
```sql
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '新会话',
    channel TEXT NOT NULL DEFAULT 'default',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_deleted_at ON sessions(deleted_at);
```

#### messages 表
```sql
CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX idx_messages_session_id ON messages(session_id);
```

#### permissions 表
```sql
CREATE TABLE permissions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    employee TEXT NOT NULL,
    allowed INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, employee),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_permissions_user_id ON permissions(user_id);
```

### 3.3 默认数据

```sql
-- 默认管理员账户
INSERT INTO users (id, username, password_hash, role)
VALUES ('admin-001', 'admin', '<bcrypt_hash>', 'admin');

-- 默认员工列表
INSERT INTO permissions (id, user_id, employee, allowed) VALUES
    ('perm-001', 'admin-001', '老财', 1),
    ('perm-002', 'admin-001', '铁壳', 1),
    ('perm-003', 'admin-001', '小K', 1),
    ('perm-004', 'admin-001', '404', 1),
    ('perm-005', 'admin-001', '裁判君', 1),
    ('perm-006', 'admin-001', 'Ditto', 1);
```

## 4. API 设计

### 4.1 认证 API

#### POST /api/auth/register
注册新用户。

**Request**:
```json
{
    "username": "testuser",
    "password": "Test1234"
}
```

**Response (201)**:
```json
{
    "id": "uuid",
    "username": "testuser",
    "role": "user",
    "token": "jwt_token"
}
```

#### POST /api/auth/login
用户登录。

**Request**:
```json
{
    "username": "testuser",
    "password": "Test1234"
}
```

**Response (200)**:
```json
{
    "token": "jwt_token",
    "expires_in": 86400
}
```

#### POST /api/auth/refresh
刷新 token。

**Headers**: `Authorization: Bearer <token>`

**Response (200)**:
```json
{
    "token": "new_jwt_token",
    "expires_in": 86400
}
```

### 4.2 会话 API

#### GET /api/sessions
获取当前用户的会话列表。

**Headers**: `Authorization: Bearer <token>`

**Response (200)**:
```json
{
    "sessions": [
        {
            "id": "uuid",
            "title": "新会话",
            "channel": "default",
            "created_at": "2026-06-14T10:00:00Z",
            "updated_at": "2026-06-14T10:30:00Z"
        }
    ]
}
```

#### POST /api/sessions
创建新会话。

**Headers**: `Authorization: Bearer <token>`

**Request**:
```json
{
    "title": "新会话",
    "channel": "default"
}
```

**Response (201)**:
```json
{
    "id": "uuid",
    "title": "新会话",
    "channel": "default",
    "created_at": "2026-06-14T10:00:00Z"
}
```

#### DELETE /api/sessions/:id
删除会话（软删除）。

**Headers**: `Authorization: Bearer <token>`

**Response (200)**:
```json
{
    "message": "会话已删除"
}
```

### 4.3 消息 API

#### GET /api/sessions/:id/messages
获取会话消息。

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:
- `limit`: 每页数量（默认 50）
- `offset`: 偏移量（默认 0）

**Response (200)**:
```json
{
    "messages": [
        {
            "id": "uuid",
            "role": "user",
            "content": "你好",
            "created_at": "2026-06-14T10:00:00Z"
        }
    ],
    "total": 100
}
```

### 4.4 聊天 API

#### POST /api/chat/completions
发送聊天消息（SSE 流式响应）。

**Headers**: `Authorization: Bearer <token>`

**Request**:
```json
{
    "session_id": "uuid",
    "employee": "404",
    "messages": [
        {"role": "user", "content": "你好"}
    ],
    "stream": true
}
```

**Response (200, SSE)**:
```
data: {"choices":[{"delta":{"content":"你"}}]}

data: {"choices":[{"delta":{"content":"好"}}]}

data: [DONE]
```

### 4.5 员工 API

#### GET /api/employees
获取当前用户可用的员工列表。

**Headers**: `Authorization: Bearer <token>`

**Response (200)**:
```json
{
    "employees": [
        {
            "name": "老财",
            "role": "AI操盘手",
            "avatar": "💰",
            "status": "working",
            "currentTask": "盘前研判"
        }
    ]
}
```

#### GET /api/employees/:name/status
获取指定员工的状态。

**Headers**: `Authorization: Bearer <token>`

**Response (200)**:
```json
{
    "name": "老财",
    "status": "working",
    "currentTask": "盘前研判"
}
```

### 4.6 管理员 API

#### GET /api/admin/users
获取所有用户列表（仅管理员）。

**Headers**: `Authorization: Bearer <admin_token>`

**Response (200)**:
```json
{
    "users": [
        {
            "id": "uuid",
            "username": "testuser",
            "role": "user",
            "created_at": "2026-06-14T10:00:00Z"
        }
    ]
}
```

#### POST /api/admin/permissions
为用户分配员工权限（仅管理员）。

**Headers**: `Authorization: Bearer <admin_token>`

**Request**:
```json
{
    "user_id": "uuid",
    "employee": "老财",
    "allowed": true
}
```

**Response (200)**:
```json
{
    "message": "权限已更新"
}
```

## 5. 项目结构

```
hermes-chat-backend/
├── Cargo.toml
├── config/
│   └── default.toml
├── src/
│   ├── main.rs              # 入口
│   ├── config.rs            # 配置
│   ├── db/
│   │   ├── mod.rs
│   │   ├── migrations.rs    # 数据库迁移
│   │   └── pool.rs          # 连接池
│   ├── models/
│   │   ├── mod.rs
│   │   ├── user.rs
│   │   ├── session.rs
│   │   ├── message.rs
│   │   └── permission.rs
│   ├── handlers/
│   │   ├── mod.rs
│   │   ├── auth.rs
│   │   ├── session.rs
│   │   ├── chat.rs
│   │   ├── employee.rs
│   │   └── admin.rs
│   ├── middleware/
│   │   ├── mod.rs
│   │   ├── auth.rs          # JWT 验证
│   │   ├── rate_limit.rs    # 速率限制
│   │   └── cors.rs
│   ├── services/
│   │   ├── mod.rs
│   │   ├── auth.rs
│   │   ├── session.rs
│   │   ├── chat.rs
│   │   └── hermes.rs        # Hermes API 客户端
│   ├── errors/
│   │   └── mod.rs
│   └── utils/
│       └── mod.rs
├── migrations/
│   └── 001_init.sql
└── tests/
    ├── auth_test.rs
    ├── session_test.rs
    └── chat_test.rs
```

## 6. 关键实现

### 6.1 JWT 认证中间件

```rust
use axum::{
    extract::Request,
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, DecodingKey, Validation};

#[derive(Clone)]
pub struct AuthUser {
    pub user_id: String,
    pub role: String,
}

pub async fn auth_middleware(
    mut req: Request,
    next: Next,
) -> Result<Response, AuthError> {
    let token = req.headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(AuthError::MissingToken)?;

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(JWT_SECRET),
        &Validation::default(),
    )?;

    req.extensions_mut().insert(AuthUser {
        user_id: token_data.claims.sub,
        role: token_data.claims.role,
    });

    Ok(next.run(req).await)
}
```

### 6.2 SSE 流式代理

```rust
use axum::response::sse::{Event, Sse};
use futures::stream::Stream;

pub async fn chat_completions(
    auth: AuthUser,
    Json(req): Json<ChatRequest>,
) -> Sse<impl Stream<Item = Result<Event, Error>>> {
    // 1. 验证用户有权使用该员工
    check_employee_permission(&auth.user_id, &req.employee).await?;

    // 2. 保存用户消息到数据库
    save_message(&req.session_id, "user", &req.messages.last().unwrap().content).await?;

    // 3. 代理到 Hermes Gateway
    let stream = proxy_to_hermes(req).await;

    // 4. 流式返回并保存助手消息
    Sse::new(stream.map(|chunk| {
        // 解析并保存助手消息
        Ok(Event::default().data(chunk))
    }))
}
```

### 6.3 速率限制

```rust
use std::sync::Arc;
use tokio::sync::Mutex;
use std::collections::HashMap;

pub struct RateLimiter {
    requests: Arc<Mutex<HashMap<String, Vec<Instant>>>>,
    max_requests: usize,
    window_secs: u64,
}

impl RateLimiter {
    pub fn check(&self, key: &str) -> bool {
        let now = Instant::now();
        let mut requests = self.requests.lock().unwrap();
        let entries = requests.entry(key.to_string()).or_insert_with(Vec::new);

        // 清理过期记录
        entries.retain(|t| now.duration_since(*t).as_secs() < self.window_secs);

        if entries.len() >= self.max_requests {
            return false;
        }

        entries.push(now);
        true
    }
}
```

## 7. 配置文件

```toml
# config/default.toml
[server]
host = "0.0.0.0"
port = 3000

[database]
url = "sqlite:hermes.db?mode=rwc"
max_connections = 10

[jwt]
secret = "your-secret-key-change-in-production"
expires_in_hours = 24

[hermes]
gateway_url = "http://127.0.0.1:8642"
api_key = "hermes-api-key"

[rate_limit]
max_requests_per_minute = 10
max_requests_per_hour = 100

[security]
max_message_length = 10000
allowed_origins = ["http://localhost:5173", "https://your-domain.com"]
```

## 8. 部署

### 8.1 Docker 部署

```dockerfile
FROM rust:1.79-slim as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y libssl3 ca-certificates
COPY --from=builder /app/target/release/hermes-chat-backend /usr/local/bin/
COPY config/ /etc/hermes-chat/
CMD ["hermes-chat-backend"]
```

### 8.2 systemd 服务

```ini
[Unit]
Description=Hermes Chat Backend
After=network.target

[Service]
Type=simple
User=hermes
WorkingDirectory=/opt/hermes-chat
ExecStart=/opt/hermes-chat/hermes-chat-backend
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## 9. 员工权限与 Hermes Profile 映射

### 9.1 方案对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| **方案A: 后端权限表** | 简单，可控性强 | 与 Hermes 解耦 |
| **方案B: Hermes Profile** | 深度集成，权限精确 | 复杂，需维护多 profile |
| **方案C: 混合方案** | 灵活，渐进式 | 实现复杂度中等 |

### 9.2 推荐方案：后端权限表

**理由**：
1. 实现简单，不依赖 Hermes 内部机制
2. 权限逻辑集中在 Rust 后端
3. 易于扩展和维护

**实现**：
1. 后端维护 `permissions` 表
2. 聊天请求时检查用户是否有权使用该员工
3. 员工状态查询时按权限过滤
4. 管理员通过 API 管理权限

### 9.3 未来扩展：Hermes Profile 集成

如需更细粒度控制（如不同用户使用不同 LLM 模型），可扩展为：

1. 为每个用户创建 Hermes Profile
2. Profile 中配置可用员工和工具
3. 聊天时指定 `--profile <user_id>`
4. 后端代理时传递 profile 参数

## 10. 安全清单

- [x] JWT 认证
- [x] 密码 bcrypt 加密
- [x] SQL 参数化查询
- [x] 输入长度限制
- [x] 速率限制
- [x] CORS 配置
- [x] 日志记录
- [ ] HTTPS（生产环境）
- [ ] CSP 头（生产环境）
