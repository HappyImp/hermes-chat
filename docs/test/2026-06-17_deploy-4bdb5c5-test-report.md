# 测试报告 — 404修复部署验收测试 (commit 4bdb5c5)

项目：hermes-chat
测试时间：2026-06-17
测试人：Ditto (测试工程师)
测试环境：本地 http://127.0.0.1:5244/chat/

---

## 📋 测试概览

| 指标 | 数量 |
|------|------|
| 测试用例 | 16 条 |
| ✅ 通过 | 10 条 |
| ❌ 失败 | 3 条 |
| ⚠️ 已知问题 | 3 条 |

---

## 部署内容验证

| 项目 | 预期 | 实际 | 状态 |
|------|------|------|------|
| ttenant typo 修复 | 注释中 ttenant→tenant | 注释已修正 | ✅ |
| 废弃文件清理 | cronJobs.ts 等已删除 | 3 个文件已删除 | ✅ |
| PRD/design 索引更新 | README 含文档索引 | 索引正常 | ✅ |
| backlog 文档标记 | 已标记修复 | 已更新 | ✅ |

---

## 测试用例详情

### 1. 前端静态资源

| ID | 用例 | 操作 | 预期 | 实际 | 状态 |
|----|------|------|------|------|------|
| TC-01 | 前端 HTML | GET /chat/ | HTTP 200 | HTTP 200, Hermes Chat | ✅ |
| TC-02 | JS Bundle | GET /chat/assets/index-DhcpKx8i.js | HTTP 200 | HTTP 200 | ✅ |
| TC-03 | CSS Bundle | GET /chat/assets/index-DvdatZXZ.css | HTTP 200 | HTTP 200 | ✅ |
| TC-04 | 像素办公室素材 | 16 个 office/*.png | 全部 200 | 16/16 返回 200 | ✅ |

### 2. 后端 API 基础

| ID | 用例 | 操作 | 预期 | 实际 | 状态 |
|----|------|------|------|------|------|
| TC-05 | Health check | GET /chat/v1/health | 200 + JSON | 200 {"status":"ok"} | ✅ |
| TC-06 | 404 处理 | GET /chat/api/nonexistent | JSON 错误 | {"error":"请求的接口不存在"} | ✅ |
| TC-07 | 管理员登录 | POST /chat/api/auth/login | 200 + token | 200 + token + expires_in:86400 | ✅ |
| TC-08 | 无 token 访问 | GET /chat/api/sessions (no auth) | 401 | 401 "缺少认证令牌" | ✅ |
| TC-09 | 错误密码 | POST /chat/api/auth/login | 401 | 401 "密码错误" | ✅ |
| TC-10 | 无效 token | GET /chat/api/sessions (bad token) | 401 | 401 "无效的认证令牌" | ✅ |

### 3. Kanban API (受环境影响)

| ID | 用例 | 操作 | 预期 | 实际 | 状态 |
|----|------|------|------|------|------|
| TC-11 | 任务列表 | GET /api/kanban/tasks | 200 + 任务数组 | 500 "内部服务器错误" | ❌ NEW |
| TC-12 | 看板统计 | GET /api/kanban/stats | 200 + JSON | 500 "内部服务器错误" | ❌ NEW |
| TC-13 | Kanban 员工 | GET /api/kanban/employees | 200 | 200 (empty array) | ✅ |

### 4. Admin API

| ID | 用例 | 操作 | 预期 | 实际 | 状态 |
|----|------|------|------|------|------|
| TC-14 | Dashboard | GET /api/admin/dashboard | 200 + 统计 | 200 (total_users:2, active_codes:1) | ✅ |
| TC-15 | Tenant 列表 | GET /api/admin/tenants | 200 | 200 ["default"] | ✅ |

---

## 🐛 Bug 列表

### BUG-NEW: [严重] kanban/tasks 和 kanban/stats 返回 500

**复现步骤**:
1. 登录获取 token
2. GET /api/kanban/tasks → 500
3. GET /api/kanban/stats → 500

**根因分析**:
Backend 进程 (PID 693564) 的 HOME 环境变量为 `/root/.hermes/profiles/ops/home`（由 ops 部署任务继承）。
配置文件中 kanban DB 路径为 `~/.hermes/kanban/boards/hermes-chat/kanban.db`，
`~` 展开后变为 `/root/.hermes/profiles/ops/home/.hermes/kanban/...`，该路径不存在。
kanban pool 初始化失败（pool = None），导致 list_tasks/get_stats 返回 AppError::Internal("Kanban 未配置")。

**影响**: Kanban 任务列表和统计功能完全不可用。

**修复建议**:
1. 启动 backend 时设置 `HOME=/root`
2. 或配置文件使用绝对路径: `db_path = "/root/.hermes/kanban/boards/hermes-chat/kanban.db"`
3. 或在 config.rs 中使用 `dirs::home_dir()` 替代 `std::env::var("HOME")`

### BUG-1 (已知): [严重] /api/employees 返回 500

**状态**: 已知问题（上次测试已报告），employee_routes 缺少 tenant_middleware。

### BUG-2 (已知): [严重] WebSocket 通过 nginx 无法连接

**状态**: 已知问题（上次测试已报告），nginx /chat/api/ location 缺少 WS upgrade headers。

---

## 测试覆盖

| 维度 | 状态 | 说明 |
|------|------|------|
| 前端静态资源 | ✅ | HTML/JS/CSS/像素办公室素材全部 200 |
| 认证系统 | ✅ | 登录/无 token/错误密码/无效 token 全部正确 |
| Admin API | ✅ | Dashboard/Tenants 正常 |
| Kanban API | ❌ | 受 HOME 环境变量影响，pool 初始化失败 |
| 员工 API | ❌ | 已知 500 bug（缺 tenant_middleware） |
| WebSocket | ❌ | 已知 nginx 代理 bug |
| 部署变更验证 | ✅ | typo 修复/文件清理/文档更新全部确认 |

---

## 清单

- [x] 无测试数据残留
- [x] 管理员账号正常
- [x] 前端页面正常加载
- [x] 部署变更（4 项）全部验证通过

---

**文档维护人**: Ditto (测试工程师)
**最后更新**: 2026-06-17
