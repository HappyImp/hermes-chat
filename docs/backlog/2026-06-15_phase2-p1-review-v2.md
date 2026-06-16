# Kanban Phase 2 P1 — 复审 Backlog (v2)

> 审查日期：2026-06-15
> 审查人：裁判君
> 审查任务：KAN-203 / KAN-204 / KAN-206 接口实现（复审）
> 上轮审查：2026-06-15_phase2-p1-review.md（4🔴+4🟡+3🟢）

---

## 上轮 🔴 严重问题修复验证

| # | 问题 | 状态 | 验证方式 |
|---|------|------|----------|
| 1 | 编译失败 — get_latest_event_id / poll_new_events 未实现 | ✅ 已修复 | 静态分析：kanban.rs:223-280 两个方法已实现 |
| 2 | WebSocket 路由绕过认证中间件 | ✅ 已修复 | ws_events 手动验证 JWT（kanban.rs:92-98），.merge() 在 .route_layer() 之后 |
| 3 | WebSocket 不检查 token 黑名单 | ✅ 已修复 | kanban.rs:101-107 手动调用 is_token_blacklisted |
| 4 | 错误信息泄露内部实现细节 | ✅ 已修复 | kanban.rs:84-98 原始错误记日志，返回通用消息 |

---

## 🟡 中等问题（建议修复）

### 1. ws_events 缺少账号禁用检查

**文件**: `backend/src/handlers/kanban.rs:86-130`

**问题**: REST 路由的 `auth_middleware` (auth.rs:102-110) 检查了用户是否被禁用（`SELECT enabled FROM users`），但 `ws_events` 手动验证流程中缺少此检查。已禁用用户的 token 仍可通过 WebSocket 连接。

**修复建议**: 在 JWT 验证后、tenant 检查前，加入 enabled 检查：
```rust
let enabled: i32 = sqlx::query_scalar("SELECT enabled FROM users WHERE id = ?")
    .bind(&claims.sub)
    .fetch_optional(&state.pool)
    .await?
    .unwrap_or(0);
if enabled == 0 {
    return Err(AppError::Auth(AuthError::AccountDisabled));
}
```

**优先级**: P1
**修复记录**: ✅ 已修复 2026-06-15（ws_events JWT 验证后加入 SELECT enabled 检查，与 auth_middleware 逻辑一致）

---

### 2. PRD/design 索引持续未更新（上轮已指出）

**文件**: `docs/prd/README.md`, `docs/design/README.md`

**问题**: kanban 迁移方案（requirements/kanban-migration-plan.md）未在 prd/ 和 design/ 索引中收录。

**修复建议**: 在 docs/prd/README.md 中添加 kanban-migration-plan.md 条目。如无独立设计文档，在 design/README.md 中说明。

**优先级**: P1
**修复记录**: ✅ 已修复 2026-06-15（prd/README.md 和 design/README.md 均添加 kanban-migration-plan 条目）

---

### 3. 缺少后端测试报告

**文件**: `docs/test/`

**问题**: docs/test/2026-06-15_test-report.md 只覆盖前端 271 测试。kanban_tests.rs 有 27 个测试但无对应测试报告。

**修复建议**: 创建 docs/test/2026-06-15_backend-kanban-test-report.md，记录 27 个测试的执行结果。

**优先级**: P1
**修复记录**: ✅ 已修复 2026-06-15（创建 docs/test/2026-06-15_backend-kanban-test-report.md，实际 33 个测试全覆盖）

---

### 4. 上轮 backlog 未标记修复状态

**文件**: `docs/backlog/2026-06-15_phase2-p1-review.md`

**问题**: 4 个🔴严重问题均未打钩 ✅，无法追踪修复进度。

**修复建议**: 更新修复记录列，标记为"✅ 已修复 2026-06-15"。

**优先级**: P1
**修复记录**: ✅ 已修复 2026-06-15（2026-06-15_phase2-p1-review.md 4 个🔴均打钩 ✅）

---

## 🟢 轻微问题（可选优化）

### 5. spawn_blocking 无超时

**文件**: `backend/src/services/kanban.rs:72`

**问题**: `list_tasks_json` 中 `spawn_blocking` 调用 CLI 命令无超时限制，CLI 挂起会占用 tokio 线程。

**修复建议**: 用 `tokio::time::timeout(Duration::from_secs(30), ...)` 包裹。

**优先级**: P3
**修复记录**: ✅ 已修复 2026-06-16（用 tokio::time::timeout 包裹 spawn_blocking，超时 30 秒）

---

### 6. poll 间隔硬编码

**文件**: `backend/src/handlers/kanban.rs:142`

**问题**: `interval(Duration::from_secs(5))` 硬编码，无法配置。

**修复建议**: 提取为常量 `const WS_POLL_INTERVAL_SECS: u64 = 5;` 或从配置读取。

**优先级**: P3
**修复记录**: ✅ 已修复 2026-06-16（提取 WS_POLL_INTERVAL_SECS / WS_HEARTBEAT_INTERVAL_SECS 常量）

---

### 7. WebSocket 连接无并发限制

**文件**: `backend/src/handlers/kanban.rs:139-214`

**问题**: 无 per-tenant 或全局连接数限制，恶意用户可大量建立 WS 连接耗尽资源。

**修复建议**: 添加 AtomicUsize 计数器或 Semaphore 限制并发连接。

**优先级**: P3
**修复记录**: ✅ 已修复 2026-06-16（AtomicUsize 全局计数 + WS_MAX_CONNECTIONS=100 上限 + ConnectionGuard 自动清理）

---

## 审查结论

**代码质量**: ⭐⭐⭐⭐☆ (4/5)（上轮 2/5 → 本轮 4/5）
**可合并性**: 🟡 需修改后重审

**原因**: 4 个🔴严重问题全部修复，代码质量显著提升。剩余 1 个🟡安全问题（WS 账号禁用检查）+ 3 个🟡文档同步问题。

**修复优先级**:
1. 🟡 WS 账号禁用检查 — P1
2. 🟡 文档索引更新 — P1
3. 🟡 后端测试报告 — P1
4. 🟡 backlog 打钩 — P1
5. 🟢 性能优化 — P3
