# PRD: Hermes Chat Rust 后端

> 日期：2026-06-14 | 作者：404 | 状态：已实现

## 1. 背景

原 hermes-chat 前端直连 Hermes Gateway（端口 8642），存在以下问题：

- 无账户系统，所有用户共享会话
- 会话数据存 localStorage，换设备丢失
- 无法区分用户权限，任何用户可访问所有员工
- 无安全防护，聊天请求可直接攻击 gateway

需要引入 Rust 后端作为代理层，前端 → Rust 后端 → Hermes Gateway，实现账户隔离、权限控制、安全防护。

## 2. 功能概述

### 2.1 账户系统

| 功能 | 描述 |
|------|------|
| 注册 | 用户名 3-32 字符（字母数字下划线），密码 8-128 字符（大小写+数字），bcrypt 哈希存储 |
| 登录 | 用户名+密码验证，返回 JWT token（HS256，24h 有效期） |
| 角色 | admin（全部权限）、user（受控权限） |

### 2.2 会话管理

| 功能 | 描述 |
|------|------|
| 创建会话 | 关联 user_id，支持自定义标题和 channel |
| 查询列表 | 按 user_id 过滤，软删除不可见 |
| 删除会话 | 软删除（设置 deleted_at） |

### 2.3 员工权限控制

| 功能 | 描述 |
|------|------|
| 权限分配 | admin 通过 API 为用户分配可用员工（permissions 表） |
| 权限查询 | 用户只能看到和使用被授权的员工 |
| 权限存储 | UNIQUE(user_id, employee) 约束，INSERT OR REPLACE 更新 |

### 2.4 SSE 流式聊天代理

| 功能 | 描述 |
|------|------|
| 代理转发 | 前端 POST /api/chat/completions → 后端转发到 Hermes Gateway /v1/chat/completions |
| 流式响应 | SSE（Server-Sent Events）透传，逐行解析 data: 前缀 |
| 完成标记 | 识别 [DONE] 标记，发送结束事件 |

### 2.5 管理接口

| 功能 | 描述 |
|------|------|
| 用户列表 | admin 查看所有用户（不含密码哈希） |
| 权限设置 | admin 为用户设置员工访问权限 |

## 3. API 端点列表

### 认证（无需 token）

| 方法 | 路径 | 描述 | 请求体 |
|------|------|------|--------|
| POST | /api/auth/register | 用户注册 | { username, password } |
| POST | /api/auth/login | 用户登录 | { username, password } |

### 会话（需 token）

| 方法 | 路径 | 描述 | 请求体 |
|------|------|------|--------|
| GET | /api/sessions | 查询当前用户会话列表 | — |
| POST | /api/sessions | 创建新会话 | { title?, channel? } |
| DELETE | /api/sessions/{id} | 删除会话（软删除） | — |

### 聊天（需 token）

| 方法 | 路径 | 描述 | 请求体 |
|------|------|------|--------|
| POST | /api/chat/completions | SSE 流式聊天 | { employee, messages: [{role, content}] } |

### 员工（需 token）

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/employees | 查询当前用户可用员工列表 |

### 管理（需 admin token）

| 方法 | 路径 | 描述 | 请求体 |
|------|------|------|--------|
| GET | /api/admin/users | 查询所有用户 | — |
| POST | /api/admin/permissions | 设置员工权限 | { user_id, employee, allowed } |

## 4. 响应格式

### 成功响应
```json
{
  "id": "...",
  "username": "...",
  "token": "eyJ..."
}
```

### 错误响应
```json
{
  "error": "错误描述"
}
```

## 5. 验收标准

- [x] 用户可注册、登录、获取 JWT token
- [x] 会话按 user_id 隔离，跨设备同步
- [x] 管理员可分配员工权限
- [x] 聊天 SSE 流式响应正常透传
- [x] JWT 中间件保护需认证的路由
- [x] 输入验证（用户名/密码格式）
- [x] SQL 注入防护（参数化查询）
