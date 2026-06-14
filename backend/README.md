# Hermes Chat Backend

Rust 后端服务 - 账户系统 + 会话管理 + SSE 流式代理

## 技术栈

- **Web 框架**: axum 0.7
- **数据库**: SQLite (sqlx)
- **认证**: JWT + bcrypt
- **HTTP 客户端**: reqwest (支持流式)
- **日志**: tracing

## 项目结构

```
src/
├── main.rs              # 入口，路由注册
├── config.rs            # 配置管理
├── db/                  # 数据库连接池
├── models/              # 数据模型
├── handlers/            # 路由处理器
├── middleware/          # 中间件 (JWT, CORS)
├── services/            # 业务逻辑
├── errors/              # 错误处理
└── utils/               # 工具函数
```

## 快速开始

### 1. 环境准备

```bash
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装依赖 (Ubuntu/Debian)
sudo apt-get install libssl-dev pkg-config
```

### 2. 配置

编辑 `config/default.toml` 或设置环境变量:

```bash
export DATABASE_URL="sqlite:hermes.db?mode=rwc"
export JWT_SECRET="your-secret-key"
export HERMES_GATEWAY_URL="http://127.0.0.1:8642"
```

### 3. 构建运行

```bash
# 开发模式
cargo run

# 或者构建后运行
cargo build --release
./target/release/hermes-chat-backend
```

服务默认监听 `0.0.0.0:3000`

## API 接口

### 认证

- `POST /api/auth/register` - 注册
- `POST /api/auth/login` - 登录

### 会话

- `GET /api/sessions` - 获取会话列表 (需要 JWT)
- `POST /api/sessions` - 创建会话 (需要 JWT)
- `DELETE /api/sessions/:id` - 删除会话 (需要 JWT)

### 聊天

- `POST /api/chat/completions` - SSE 流式聊天 (需要 JWT)

### 员工

- `GET /api/employees` - 获取可用员工列表 (需要 JWT)

### 管理员

- `GET /api/admin/users` - 获取用户列表 (需要 admin 角色)
- `POST /api/admin/permissions` - 设置员工权限 (需要 admin 角色)

## 数据库

数据库自动创建，首次运行时执行迁移脚本。

表结构:
- `users` - 用户表
- `sessions` - 会话表
- `messages` - 消息表
- `permissions` - 员工权限表

## Docker 部署

```dockerfile
FROM rust:1.79-slim as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y libssl3 ca-certificates
COPY --from=builder /app/target/release/hermes-chat-backend /usr/local/bin/
CMD ["hermes-chat-backend"]
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| DATABASE_URL | sqlite:hermes.db?mode=rwc | 数据库连接 |
| JWT_SECRET | your-secret-key | JWT 密钥 |
| HERMES_GATEWAY_URL | http://127.0.0.1:8642 | Hermes 网关地址 |
| BIND_ADDR | 0.0.0.0:3000 | 监听地址 |
| RUST_LOG | info | 日志级别 |
