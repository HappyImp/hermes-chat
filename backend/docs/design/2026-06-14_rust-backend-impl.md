# 设计文档: Hermes Chat Rust 后端实现

> 日期：2026-06-14 | 作者：404 | 状态：已实现

## 1. 技术栈选型

| 组件 | 选型 | 理由 |
|------|------|------|
| Web 框架 | axum 0.7 | tokio 生态，类型安全的 extractor，tower 中间件兼容 |
| 数据库 | SQLite + sqlx 0.8 | 单机部署简单，编译期查询检查，异步支持 |
| HTTP 客户端 | reqwest 0.12 | 支持 stream feature，SSE 流式读取 |
| 认证 | jsonwebtoken 9 | HS256 JWT 签发/验证 |
| 密码哈希 | bcrypt 0.15 | 行业标准，自动加盐 |
| 序列化 | serde + serde_json | Rust 生态标准 |
| 日志 | tracing + tracing-subscriber | 结构化日志，env-filter 支持 |
| CORS | tower-http | 与 axum 原生集成 |
| SSE | axum::response::sse + async-stream | axum 内置 SSE 支持，async-stream 简化流构造 |
| UUID | uuid v4 | 随机 ID 生成 |
| 配置 | config crate | 支持文件 + 环境变量分层配置 |

## 2. 项目结构

```
backend/src/
├── main.rs              # 入口：初始化 + 路由组装 + 启动
├── config.rs            # 配置结构体（Server/Database/JWT/Hermes/RateLimit/Security）
├── db/
│   ├── mod.rs           # 导出 DbPool 类型
│   └── pool.rs          # 连接池创建 + 建表迁移
├── errors/
│   └── mod.rs           # AppError 枚举 + IntoResponse 实现
├── models/
│   ├── user.rs          # User/CreateUser/LoginUser/UserResponse
│   ├── session.rs       # Session/CreateSession/SessionResponse
│   ├── message.rs       # Message/CreateMessage/MessageResponse（预备）
│   └── permission.rs    # Permission/SetPermission/PermissionResponse（预备）
├── handlers/
│   ├── auth.rs          # register/login 处理器
│   ├── session.rs       # 会话 CRUD 处理器
│   ├── chat.rs          # SSE 聊天代理处理器
│   ├── employee.rs      # 员工列表处理器
│   └── admin.rs         # 管理接口处理器
├── services/
│   ├── auth.rs          # AuthService：注册/登录/token 生成
│   ├── session.rs       # SessionService：会话 CRUD
│   ├── chat.rs          # ChatService：消息持久化（预备）
│   ├── hermes.rs        # HermesClient：gateway HTTP 客户端
│   └── employee.rs      # EmployeeService：权限查询
├── middleware/
│   ├── auth.rs          # JWT 中间件 + AuthUser/AdminUser 提取器
│   ├── cors.rs          # CORS 配置
│   └── rate_limit.rs    # 速率限制器（预备）
└── utils/
    └── validation.rs    # 用户名/密码格式校验
```

## 3. 数据库 Schema

### 3.1 users 表

```sql
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 3.2 sessions 表

```sql
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '新会话',
    channel TEXT NOT NULL DEFAULT 'default',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 3.3 messages 表

```sql
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

### 3.4 permissions 表

```sql
CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    employee TEXT NOT NULL,
    allowed INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, employee),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## 4. 认证流程

### 4.1 注册

1. 前端 POST /api/auth/register { username, password }
2. 校验用户名格式（3-32 字符，字母数字下划线）
3. 校验密码格式（8-128 字符，大小写+数字）
4. 查询用户名是否已存在
5. bcrypt 哈希密码（DEFAULT_COST=12）
6. INSERT 用户记录，role='user'
7. 生成 JWT token，返回 { id, username, role, token }

### 4.2 登录

1. 前端 POST /api/auth/login { username, password }
2. 查询用户记录
3. bcrypt::verify 验证密码
4. 生成 JWT token，返回 { token, expires_in: 86400 }

### 4.3 JWT 结构

```json
{
  "sub": "user_id",
  "role": "user|admin",
  "exp": 1718400000
}
```

- 算法：HS256
- 密钥：环境变量 JWT_SECRET
- 有效期：24 小时（配置项 jwt.expires_in_hours）

### 4.4 中间件认证

1. 从 Authorization: Bearer <token> 提取 token
2. decode JWT，验证签名和过期时间
3. 提取 Claims，注入 AuthUser { user_id, role } 到请求扩展
4. AdminUser 提取器额外检查 role == "admin"

## 5. 权限模型

### 5.1 两级角色

| 角色 | 能力 |
|------|------|
| admin | 管理所有用户、分配员工权限、查看用户列表 |
| user | 管理自己的会话、使用被授权的员工聊天 |

### 5.2 权限控制流程

1. admin 调用 POST /api/admin/permissions 设置权限
2. 权限写入 permissions 表，UNIQUE(user_id, employee) 保证唯一
3. 用户查询员工列表时，JOIN permissions 过滤
4. 用户发起聊天时，employee 字段由前端从已授权列表中选择

### 5.3 路由保护

```
/api/auth/*          → 无需认证
/api/sessions/*      → auth_middleware（JWT 验证）
/api/chat/*          → auth_middleware（JWT 验证）
/api/employees/*     → auth_middleware（JWT 验证）
/api/admin/*         → auth_middleware + AdminUser（JWT + admin 角色）
```

## 6. 安全措施

| 措施 | 实现方式 |
|------|----------|
| 密码存储 | bcrypt（自动加盐，cost=12） |
| SQL 注入 | sqlx 参数化查询，零字符串拼接 |
| 认证 | JWT HS256，24h 过期 |
| 输入验证 | 用户名/密码格式校验，长度限制 |
| CORS | 配置化白名单（allowed_origins） |
| 错误处理 | 统一 AppError 枚举，内部错误不暴露细节 |
| 日志 | tracing 结构化日志，敏感信息不写日志 |

## 7. 设计决策记录

| 决策 | 选择 | 备选 | 理由 |
|------|------|------|------|
| 数据库 | SQLite | PostgreSQL | 单机部署简单，无需额外服务 |
| ID 生成 | UUID v4 | 自增 ID | 分布式友好，无冲突 |
| 密码哈希 | bcrypt | argon2 | 生态成熟，crate 维护活跃 |
| 时间格式 | RFC3339 字符串 | timestamp 整数 | SQLite 无原生时间类型，字符串可读性好 |
| 软删除 | deleted_at 字段 | 物理删除 | 可恢复，审计友好 |
| SSE 代理 | 逐行解析 data: 前缀 | 全量转发 | 可控，便于后续添加拦截逻辑 |
