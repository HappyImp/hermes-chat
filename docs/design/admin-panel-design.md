# 后台管理面板 — 技术设计文档

- 版本：v1.0
- 创建时间：2026-06-15
- 作者：404
- 状态：已实现

---

## 一、架构概览

```
┌─────────────────────────────────────────────────┐
│  Nginx (前端静态)                                │
│  /admin/ → /var/www/hermes-chat-admin/          │
│  /api/   → proxy_pass http://127.0.0.1:3000     │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│  Rust Backend (Axum + SQLite + JWT)             │
│  端口 3000                                       │
│                                                  │
│  /api/auth/*        认证（登录/注册/登出）         │
│  /api/admin/*       后台管理（需 admin 权限）      │
│  /api/sessions/*    会话管理                      │
│  /api/chat/*        聊天代理                      │
│  /api/employees/*   员工列表                      │
└──────────────────────────────────────────────────┘
```

## 二、数据库设计

### 2.1 新增表

**invitation_codes（授权码）**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| code | TEXT UNIQUE | HC-XXXX-XXXX 格式 |
| allowed_employees | TEXT | JSON 数组 |
| max_uses | INTEGER | 最大使用次数，默认 1 |
| used_count | INTEGER | 已使用次数 |
| status | TEXT | active/used/disabled |
| created_by | TEXT FK | 创建者 user_id |
| used_by | TEXT FK | 使用者 user_id |
| created_at | TEXT | 创建时间 |
| expires_at | TEXT | 过期时间（可选）|
| note | TEXT | 备注 |

**audit_logs（审计日志）**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| operator_id | TEXT FK | 操作者 |
| action | TEXT | create_code/disable_code/delete_code/modify_permission/disable_user/enable_user/delete_user |
| target_type | TEXT | invitation_code/user |
| target_id | TEXT | 目标 ID |
| detail | TEXT | 操作详情 JSON |
| created_at | TEXT | 操作时间 |

### 2.2 表变更

- users 表新增 `enabled` 字段（INTEGER, 默认 1）
- 预置管理员账号：13459730010 / 123456 (role=admin)

## 三、API 设计

### 3.1 认证

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /api/auth/login | 登录（管理员+普通用户） | 公开 |
| POST | /api/auth/register | 注册（需邀请码） | 公开 |

### 3.2 后台管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/dashboard | 仪表盘统计 |
| POST | /api/admin/invitation-codes | 生成授权码 |
| GET | /api/admin/invitation-codes | 授权码列表 |
| POST | /api/admin/invitation-codes/:id/disable | 禁用授权码 |
| DELETE | /api/admin/invitation-codes/:id | 删除授权码 |
| GET | /api/admin/users | 用户列表 |
| GET | /api/admin/users/:id | 用户详情 |
| PUT | /api/admin/users/:id/permissions | 修改用户权限 |
| POST | /api/admin/users/:id/toggle-status | 禁用/启用用户 |
| DELETE | /api/admin/users/:id | 删除用户 |

## 四、前端设计

- 框架：Vue 3 + Vite + Element Plus
- 状态管理：Pinia
- 路由：Vue Router 4
- HTTP 客户端：Axios
- 部署路径：/admin/

### 页面

1. **登录页** — 管理员账号密码登录
2. **仪表盘** — 5 个统计卡片，10 秒自动刷新
3. **授权码管理** — 表格 + 生成弹窗 + 禁用/删除
4. **用户管理** — 表格 + 搜索 + 权限编辑弹窗 + 禁用/删除

## 五、安全设计

- 所有 /api/admin/* 路由需要 AdminUser 中间件（验证 role=admin）
- 禁用用户后 token 立即失效（auth_middleware 检查 enabled 字段）
- 授权码一次性使用，用后自动标记
- 删除用户级联清理：会话、消息、权限、token 黑名单
- 所有管理员操作写入审计日志
