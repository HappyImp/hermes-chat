# Kanban Phase 2 P1 — 审查 Backlog

> 审查日期：2026-06-15
> 审查人：裁判君
> 审查任务：KAN-203 / KAN-204 / KAN-206 接口实现
> commit: 7f46452 feat(kanban): 实现任务详情/统计/WebSocket事件代理

---

## 🔴 严重问题（必须修复）

### 1. 编译失败 — get_latest_event_id / poll_new_events 未实现

**文件**: `backend/src/handlers/kanban.rs:85,93` + `backend/src/services/kanban.rs`

**问题**: ws_events handler 调用了 `kanban_service.get_latest_event_id()` 和 `kanban_service.poll_new_events()`，但 `KanbanService` 中根本没有这两个方法。`cargo check` 报 2 个 E0599 错误。

**修复建议**: 在 KanbanService 中实现：
```rust
pub async fn get_latest_event_id(&self, tenant_id: &str) -> Result<i64, AppError> {
    // 查询 kanban events 表，SELECT MAX(id) WHERE tenant = ?
}

pub async fn poll_new_events(&self, tenant_id: &str, after_id: i64) -> Result<Vec<Value>, AppError> {
    // 查询 ID > after_id 的事件，按 tenant 过滤
}
```

**优先级**: P0 — 编译不通过，无法部署
**修复记录**: ✅ 已修复 2026-06-15（kanban.rs 改用 CLI poll + HashMap 快照方案，无需这两个方法）

---

### 2. WebSocket 路由完全绕过认证中间件

**文件**: `backend/src/main.rs:196`

**问题**: `kanban_ws_routes` 单独 `.nest("/api/kanban", kanban_ws_routes)`，没有挂载 `auth_middleware` 和 `tenant_middleware`。handler 签名要求 `AuthUser` + `TenantScope` 提取器，这两个都依赖 middleware 注入 extensions。无 middleware = 永远返回 401。注释写的"自带 JWT 验证（从 query param）"—— 代码里完全没有这个逻辑。

**修复建议**: 二选一：
- a) 将 kanban_ws_routes 合并到 kanban_routes 里共享 middleware 层
- b) 在 ws_events handler 里手动从 query param 提取 token 并验证（decode JWT + 黑名单 + tenant 查询）

**优先级**: P0 — 安全漏洞 + 功能不可用
**修复记录**: ✅ 已修复 2026-06-15（ws_events 手动验证 JWT，kanban_ws_routes 合并到主路由）

---

### 3. WebSocket 不检查 token 黑名单

**文件**: `backend/src/handlers/kanban.rs:67-75`

**问题**: 即使修复了认证问题，ws_events 没有 `is_token_blacklisted` 检查。用户 logout 后 token 仍能通过 WebSocket 接收事件。`auth_middleware` (auth.rs:93-99) 有黑名单检查，但 WS 路由不走该 middleware。

**修复建议**: 手动验证方案中必须加入黑名单检查。如果走方案(a)合并路由，则自动继承。

**优先级**: P0 — 安全漏洞
**修复记录**: ✅ 已修复 2026-06-15（ws_events:101-107 手动调用 is_token_blacklisted）

---

### 4. 错误信息泄露内部实现细节

**文件**: `backend/src/services/kanban.rs:57,69,72`

**问题**: "JSON 解析失败: ..." 和 "CLI 执行失败: ..." 直接返回给客户端，暴露后端使用 CLI 代理的架构。

**修复建议**: 服务层返回结构化错误，handler 层统一转换为用户友好消息，原始错误用 tracing::error! 记录。

**优先级**: P0 — 信息泄露
**修复记录**: ✅ 已修复 2026-06-15（原始错误记日志，返回通用消息 "看板服务暂时不可用"）

---

## 🟡 中等问题（建议修复）

### 5. get_stats CLI 未传 --tenant 参数

**文件**: `backend/src/services/kanban.rs:105-106`

**问题**: `hermes kanban stats --json` 未传 `--tenant`，可能返回全局统计。

**修复建议**: 添加 `--tenant` 参数。

**优先级**: P1
**修复记录**: 待修复

---

### 6. get_task tenant 检查 — null 时放行

**文件**: `backend/src/services/kanban.rs:87-97`

**问题**: task.tenant 为 null 时直接放行，未确认是否为预期行为。

**修复建议**: 确认业务逻辑。若所有任务都应有 tenant，null 应视为异常。

**优先级**: P1
**修复记录**: 待修复

---

### 7. 文档索引持续未更新（上轮已指出）

**文件**: `docs/prd/README.md`, `docs/design/README.md`, `docs/README.md`

**问题**: kanban 迁移方案未在 prd/ 和 design/ 索引中收录。

**优先级**: P1
**修复记录**: 待修复

---

### 8. README 未更新 kanban API 端点

**文件**: `README.md`

**问题**: 新增端点未文档化。

**优先级**: P1
**修复记录**: 待修复

---

## 🟢 轻微问题（可选优化）

### 9. spawn_blocking 无超时

**文件**: `backend/src/services/kanban.rs:47`

**优先级**: P3
**修复记录**: 待修复

---

### 10. poll 间隔硬编码

**文件**: `backend/src/handlers/kanban.rs:81`

**优先级**: P3
**修复记录**: 待修复

---

### 11. WebSocket 连接无并发限制

**文件**: `backend/src/handlers/kanban.rs:78-127`

**优先级**: P3
**修复记录**: 待修复

---

## 审查结论

**代码质量**: ⭐⭐☆☆☆ (2/5)
**可合并性**: ❌ 需要重写

**原因**: 代码无法编译（2 个方法未实现）+ WebSocket 路由无认证 = 核心功能半成品。

**修复优先级**:
1. 🔴 实现缺失方法（编译通过）— P0
2. 🔴 补全 WebSocket 认证 + 黑名单 — P0
3. 🔴 错误信息脱敏 — P0
4. 🟡 文档索引 + README 更新 — P1
5. 🟢 性能优化（超时、连接限制）— P3
