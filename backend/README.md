# Hermes Chat Backend

Rust 后端服务 — 账户系统 + 会话管理 + 权限控制 + SSE 流式代理

## 技术栈

- **Web 框架**: axum 0.7
- **数据库**: SQLite (sqlx)
- **认证**: JWT (HS256) + bcrypt
- **HTTP 客户端**: reqwest (支持流式)
- **日志**: tracing

## 快速开始

### 1. 环境准备

```bash
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装依赖 (Ubuntu/Debian)
sudo apt-get install libssl-dev pkg-config

# CentOS/RHEL
sudo yum install gcc openssl-devel
```

### 2. 配置

**必须设置环境变量**（JWT_SECRET 无默认值，未设置会 panic）：

```bash
export DATABASE_URL="sqlite:hermes.db?mode=rwc"
export JWT_SECRET="your-secret-key-change-in-production"
export HERMES_GATEWAY_URL="http://127.0.0.1:8642"
```

或编辑 `config/default.toml`（但 JWT_SECRET 建议用环境变量）。

### 3. 构建运行

```bash
# 开发模式
cargo run

# 生产构建
cargo build --release
./target/release/hermes-chat-backend
```

服务默认监听 `0.0.0.0:3000`

## 部署（systemd）

```bash
# 构建
cargo build --release

# 创建 service 文件
sudo tee /etc/systemd/system/hermes-chat-backend.service <<EOF
[Unit]
Description=Hermes Chat Backend
After=network.target

[Service]
Type=simple
ExecStart=/root/hermes-chat/backend/target/release/hermes-chat-backend
WorkingDirectory=/root/hermes-chat/backend
Environment=JWT_SECRET=your-secret-key
Environment=DATABASE_URL=sqlite:hermes.db?mode=rwc
Environment=RUST_LOG=info
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 启动
sudo systemctl daemon-reload
sudo systemctl enable hermes-chat-backend
sudo systemctl start hermes-chat-backend

# 查看状态
sudo systemctl status hermes-chat-backend
sudo journalctl -u hermes-chat-backend -f
```

## API 接口

### 认证（无需 token）

| 方法 | 路径 | 说明 | 状态码 |
|------|------|------|--------|
| POST | /api/auth/register | 注册 | 201 |
| POST | /api/auth/login | 登录 | 200 |

### 认证（需 JWT）

| 方法 | 路径 | 说明 | 状态码 |
|------|------|------|--------|
| POST | /api/auth/logout | 登出（token 加入黑名单） | 200 |

### 会话（需 JWT）

| 方法 | 路径 | 说明 | 状态码 |
|------|------|------|--------|
| GET | /api/sessions | 获取会话列表 | 200 |
| POST | /api/sessions | 创建会话 | 201 |
| DELETE | /api/sessions/:id | 删除会话 | 200 |

### 聊天（需 JWT）

| 方法 | 路径 | 说明 | 状态码 |
|------|------|------|--------|
| POST | /api/chat/completions | SSE 流式聊天 | 200 (SSE) |

### 员工（需 JWT）

| 方法 | 路径 | 说明 | 状态码 |
|------|------|------|--------|
| GET | /api/employees | 获取可用员工列表 | 200 |

### 管理员（需 admin JWT）

| 方法 | 路径 | 说明 | 状态码 |
|------|------|------|--------|
| GET | /api/admin/users | 获取用户列表 | 200 |
| POST | /api/admin/permissions | 设置员工权限 | 200 |

## 数据库

数据库自动创建，首次运行时执行迁移脚本。

表结构:
- `users` — 用户表（id, username, password_hash, role）
- `sessions` — 会话表（关联 user_id，软删除）
- `messages` — 消息表（关联 session_id）
- `permissions` — 员工权限表（user_id + employee 唯一约束）
- `token_blacklist` — Token 黑名单（登出后 token 失效）

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| DATABASE_URL | 否 | 数据库连接（默认 sqlite:hermes.db?mode=rwc） |
| JWT_SECRET | **是** | JWT 密钥（未设置会 panic） |
| HERMES_GATEWAY_URL | 否 | Hermes 网关地址（默认 http://127.0.0.1:8642） |
| RUST_LOG | 否 | 日志级别（默认 info） |

## Nginx 配置

```nginx
location /chat/api/ {
    proxy_pass http://127.0.0.1:3000/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Authorization $http_authorization;
}
```

## 文档

- [后端文档索引](docs/README.md)
- [功能 PRD](docs/prd/2026-06-14_rust-backend.md)
- [实现设计](docs/design/2026-06-14_rust-backend-impl.md)
- [审查记录](docs/backlog/2026-06-14_review-backlog.md)
