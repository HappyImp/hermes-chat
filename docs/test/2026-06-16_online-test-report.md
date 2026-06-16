# 测试报告 — hermes-chat 线上功能测试

项目：hermes-chat
测试时间：2026-06-16
测试人：Ditto (测试工程师)
测试环境：线上 http://43.249.192.131:7960/

---

## 📋 测试概览

| 指标 | 数量 |
|------|------|
| 测试用例 | 28 条 |
| ✅ 通过 | 22 条 |
| ❌ 失败 | 2 条 |
| 🐛 发现 bug | 2 个 |

---

## 测试用例详情

### 1. 基础连通性测试

| ID | 用例 | 操作 | 预期 | 实际 | 状态 |
|----|------|------|------|------|------|
| TC-01 | 聊天前端页面 | GET /chat/ | HTTP 200 | HTTP 200, 459B | ✅ |
| TC-02 | 管理后台页面 | GET /admin/ | HTTP 200 | HTTP 200, 494B | ✅ |
| TC-03 | 管理后台 JS | GET /admin/assets/...js | HTTP 200 | HTTP 200, 798KB | ✅ |
| TC-04 | 管理后台 CSS | GET /admin/assets/...css | HTTP 200 | HTTP 200, 198B | ✅ |

### 2. 认证与权限系统

| ID | 用例 | 操作 | 预期 | 实际 | 状态 |
|----|------|------|------|------|------|
| TC-05 | 管理员登录 | POST /api/auth/login | 200 + token | 200 + token + expires_in:86400 | ✅ |
| TC-06 | 无 token 访问 sessions | GET /api/sessions (no auth) | 401 | 401 | ✅ |
| TC-07 | 无 token 访问 admin | GET /api/admin/dashboard (no auth) | 401 | 401 | ✅ |
| TC-08 | 无 token 访问 kanban | GET /api/kanban/tasks (no auth) | 401 | 401 | ✅ |
| TC-09 | 无 token 访问 employees | GET /api/employees (no auth) | 401 | 401 | ✅ |
| TC-10 | 无效 token | GET /api/sessions (bad token) | 401 | 401 + "无效的认证令牌" | ✅ |
| TC-11 | 非管理员访问 admin | 普通用户 GET /api/admin/dashboard | 403 | 403 Forbidden | ✅ |

### 3. Admin Panel API 测试

| ID | 用例 | 操作 | 预期 | 实际 | 状态 |
|----|------|------|------|------|------|
| TC-12 | Dashboard 数据 | GET /api/admin/dashboard | JSON 统计 | active_codes:1, total_users:2 | ✅ |
| TC-13 | 用户列表 | GET /api/admin/users | 用户数组 | 2 个用户 (admin + kyluzoi) | ✅ |
| TC-14 | Tenant 列表 | GET /api/admin/tenants | tenant 数组 | ["default"] | ✅ |
| TC-15 | 审计日志 | GET /api/admin/audit-logs | 日志数组 | total:21, 20 条日志 | ✅ |
| TC-16 | 授权码列表 | GET /api/admin/invitation-codes | 授权码数组 | 2 个授权码 | ✅ |

### 4. 授权码生命周期测试

| ID | 用例 | 操作 | 预期 | 实际 | 状态 |
|----|------|------|------|------|------|
| TC-17 | 创建授权码 | POST /api/admin/invitation-codes | 200 + HC-XXXX-XXXX | HC-KKY2-6Y8B 创建成功 | ✅ |
| TC-18 | 用授权码注册 | POST /api/auth/register | 200 + user + token | 注册成功 ditto_test_perm | ✅ |
| TC-19 | 新用户登录 | POST /api/auth/login | 200 + token | 登录成功 | ✅ |
| TC-20 | 新用户访问 sessions | GET /api/sessions | 200 | 200 | ✅ |
| TC-21 | 新用户访问 kanban | GET /api/kanban/tasks | 200 | 200 | ✅ |
| TC-22 | 禁用用户 | POST /api/admin/users/:id/toggle-status | 200 | "用户已禁用" | ✅ |
| TC-23 | 禁用后登录 | POST /api/auth/login | 403 | "账户已被禁用，请联系管理员" | ✅ |
| TC-24 | 禁用后 token 失效 | GET /api/sessions (disabled user token) | 403 | 403 | ✅ |
| TC-25 | 启用用户 | POST /api/admin/users/:id/toggle-status | 200 | "用户已启用" | ✅ |
| TC-26 | 删除用户 | DELETE /api/admin/users/:id | 200 | "用户已删除" | ✅ |
| TC-27 | 删除后无法登录 | POST /api/auth/login (deleted user) | 401/403 | 用户不存在 | ✅ |
| TC-28 | 删除授权码 | DELETE /api/admin/invitation-codes/:id | 200 | "已删除" | ✅ |

### 5. Kanban API 测试

| ID | 用例 | 操作 | 预期 | 实际 | 状态 |
|----|------|------|------|------|------|
| TC-29 | 任务列表 | GET /api/kanban/tasks | 任务数组 | 27 个任务 | ✅ |
| TC-30 | 统计数据 | GET /api/kanban/stats | JSON 统计 | doing:1, done:26, total:27 | ✅ |
| TC-31 | 任务详情 | GET /api/kanban/tasks/:id | 任务详情 | 正确返回 title, status, assignee | ✅ |

### 6. 会话管理测试

| ID | 用例 | 操作 | 预期 | 实际 | 状态 |
|----|------|------|------|------|------|
| TC-32 | 创建会话 | POST /api/sessions | 200 + session | 创建成功 | ✅ |
| TC-33 | 列出会话 | GET /api/sessions | 会话数组 | 1 个会话 | ✅ |
| TC-34 | 删除会话 | DELETE /api/sessions/:id | 200 | 200 | ✅ |

### 7. WebSocket 测试

| ID | 用例 | 操作 | 预期 | 实际 | 状态 |
|----|------|------|------|------|------|
| TC-35 | WS 直连后端 | WS /api/kanban/events (port 3000) | 101 Switching Protocols | 101 + heartbeat | ✅ |
| TC-36 | WS 通过 nginx | WS /chat/api/kanban/events (port 7960) | 101 Switching Protocols | 400 Bad Request | ❌ BUG-2 |

### 8. 员工 API 测试

| ID | 用例 | 操作 | 预期 | 实际 | 状态 |
|----|------|------|------|------|------|
| TC-37 | 员工列表 (admin) | GET /api/employees | 200 + 员工数组 | 500 内部服务器错误 | ❌ BUG-1 |
| TC-38 | Kanban 员工 | GET /api/kanban/employees | 200 | 200 (empty array) | ✅ |

### 9. 前端浏览器测试 (Obscura CDP)

| ID | 用例 | 操作 | 预期 | 实际 | 状态 |
|----|------|------|------|------|------|
| TC-39 | 聊天页面加载 | GET /chat/ via browser | title="Hermes Chat" | title="Hermes Chat" | ✅ |
| TC-40 | 登录表单渲染 | 检查 DOM | 2 inputs + 3 buttons | 2 inputs + 3 buttons | ✅ |
| TC-41 | 管理后台加载 | GET /admin/ via browser | title 包含管理 | "Hermes Chat 后台管理" | ✅ |

### 10. 回归测试

| ID | 用例 | 操作 | 预期 | 实际 | 状态 |
|----|------|------|------|------|------|
| TC-42 | 404 处理 | GET /api/nonexistent | JSON 错误 | {"error":"请求的接口不存在"} | ✅ |
| TC-43 | 前端 HTML | GET /chat/ | 正确 HTML | DOCTYPE + div#app | ✅ |
| TC-44 | 测试数据清理 | 检查用户列表 | 无测试用户 | 仅原始 2 用户 | ✅ |

---

## 🐛 Bug 列表

### BUG-1: [严重] /api/employees 接口返回 500 内部服务器错误

**复现步骤**:
1. 使用有效 token 调用 `GET /api/employees`
2. 返回 `{"error":"内部服务器错误"}` HTTP 500

**根因分析**:
`employee_routes` 在 main.rs 第 198 行只挂载了 `auth_middleware`，没有挂载 `tenant_middleware`：
```rust
.nest(
    "/api/employees",
    employee_routes.route_layer(axum_middleware::from_fn_with_state(
        state.clone(),
        auth_middleware,  // ← 只有 auth，没有 tenant
    )),
)
```
但 `handlers::employee::list` 函数签名需要 `TenantScope`：
```rust
pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    tenant: TenantScope,  // ← 需要 tenant_middleware 注入
    ...
```
`TenantScope` 的 `FromRequestParts` 实现只从 extensions 读取（由 tenant_middleware 注入），找不到时返回 `AppError::Internal("缺少 tenant 上下文")`，映射为 HTTP 500。

**影响**: 员工列表功能完全不可用。

**修复建议**: 给 employee_routes 也挂载 tenant_middleware：
```rust
.nest(
    "/api/employees",
    employee_routes
        .route_layer(axum_middleware::from_fn_with_state(state.clone(), tenant_middleware))
        .route_layer(axum_middleware::from_fn_with_state(state.clone(), auth_middleware)),
)
```

---

### BUG-2: [严重] WebSocket 通过 nginx 无法连接

**复现步骤**:
1. 通过 nginx (port 7960) 发起 WebSocket 升级请求
2. `curl -H "Upgrade: websocket" -H "Connection: Upgrade" http://43.249.192.131:7960/chat/api/kanban/events`
3. 返回 400 Bad Request: "Connection header did not include 'upgrade'"

**根因分析**:
nginx `/chat/api/` location 缺少 WebSocket 升级头：
```nginx
location /chat/api/ {
    proxy_pass http://127.0.0.1:3000/api/;
    proxy_http_version 1.1;
    # 缺少: proxy_set_header Upgrade $http_upgrade;
    # 缺少: proxy_set_header Connection $connection_upgrade;
}
```
而根 `/` location 有这些头。直接访问后端 (port 3000) WebSocket 正常返回 101。

**影响**: 前端 Kanban 实时更新功能完全不可用。

**修复建议**: 在 nginx `/chat/api/` location 添加 WebSocket 头：
```nginx
location /chat/api/ {
    proxy_pass http://127.0.0.1:3000/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Authorization $http_authorization;
    proxy_set_header Upgrade $http_upgrade;        # 新增
    proxy_set_header Connection $connection_upgrade; # 新增
    proxy_read_timeout 3600s;  # WS 长连接超时
}
```

---

## 测试覆盖

| 维度 | 状态 | 说明 |
|------|------|------|
| 功能测试 | ✅ | 认证、权限、Admin CRUD、Kanban、会话管理 |
| 边界测试 | ✅ | 无效 token、无 token、禁用用户、删除用户 |
| 交互测试 | ✅ | 授权码完整生命周期（创建→注册→登录→禁用→启用→删除）|
| WebSocket | ❌ | 后端直连正常，nginx 代理失败 |
| 前端渲染 | ⚠️ | 页面加载正常，Obscura CDP 无法触发 React 交互 |
| 回归测试 | ✅ | 404 处理、前端 HTML、数据清理 |
| 员工状态 | ❌ | API 返回 500，无法测试 |

---

## 清单

- [x] 测试数据已清理（ditto_test_perm 用户、HC-KKY2-6Y8B 授权码已删除）
- [x] 原始用户数据完整（admin-preset-001 + kyluzoi）
- [x] 管理员登录正常

---

**文档维护人**: Ditto (测试工程师)
**最后更新**: 2026-06-16
