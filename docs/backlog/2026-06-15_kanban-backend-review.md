# Kanban 后端适配层 — 审查 Backlog

> 审查日期：2026-06-15
> 审查人：裁判君
> 审查任务：KAN-201 代码审查 — kanban 后端适配层
> 代码版本：当前 HEAD

---

## 🔴 严重问题（必须修复）

### 1. `get_task` 未强制 tenant 隔离

**文件**: `backend/src/handlers/kanban.rs:21-32`

**问题**: handler 调用 `get_tenant_for_user` 获取 tenant_id 但赋值给 `_tenant_id`（未使用），然后调用 `get_task(&task_id)` 时不传 tenant。任何已认证用户知道 task_id 即可查看其他用户的任务。

```rust
// 当前代码 — tenant 获取后被忽略
let _tenant_id = KanbanService::get_tenant_for_user(&state.pool, &auth.user_id).await?;
let task = state.kanban_service.get_task(&task_id).await?;
```

**修复建议**:
```rust
let tenant_id = KanbanService::get_tenant_for_user(&state.pool, &auth.user_id).await?;
let task = state.kanban_service.get_task(&task_id, &tenant_id).await?;
// service 层验证 task.tenant == tenant_id，否则返回 403
```

**优先级**: P0 — 安全漏洞
**修复记录**: ✅ 已修复（handler + service 层均已传入 tenant_id）

---

### 2. `get_stats` 未强制 tenant 隔离

**文件**: `backend/src/handlers/kanban.rs:34-45`

**问题**: 同上，`_tenant_id` 未使用。`get_stats()` 不接受 tenant 参数，返回全局统计。不同租户会看到相同的统计数据。

**修复建议**:
```rust
let tenant_id = KanbanService::get_tenant_for_user(&state.pool, &auth.user_id).await?;
let stats = state.kanban_service.get_stats(&tenant_id).await?;
```

**优先级**: P0 — 数据泄露
**修复记录**: ✅ 已修复（handler + service 层均已传入 tenant_id）

---

### 3. kanban 模块无任何测试

**文件**: `backend/src/services/kanban.rs`, `backend/src/handlers/kanban.rs`

**问题**: 整个 kanban 模块（handler + service + model）没有任何单元测试或集成测试。现有测试文件 `tests/permission_tests.rs` 不覆盖 kanban 功能。迁移方案要求"后端 kanban handler — mock CLI 调用，验证权限过滤"，但未实现。

**修复建议**:
- 添加 `tests/kanban_tests.rs`
- 测试 `get_tenant_for_user` 的正常路径和无映射路径
- 测试 handler 的鉴权逻辑
- 测试 tenant 隔离（不同用户看不到彼此任务）

**优先级**: P0 — 核心逻辑无测试
**修复记录**: ✅ 已修复（添加 tests/kanban_tests.rs，12 个测试用例）

---

## 🟡 中等问题（建议修复）

### 4. 文档未正确索引

**文件**: `docs/prd/README.md`, `docs/design/README.md`, `docs/README.md`

**问题**:
- `docs/requirements/kanban-migration-plan.md` 包含完整的 PRD 内容，但 `docs/prd/README.md` 索引未收录
- `docs/requirements/kanban-integration-research.md` 包含设计内容，但 `docs/design/README.md` 索引未收录
- `docs/README.md` 总索引未提及 kanban 迁移相关文档

**修复建议**:
- 在 `docs/prd/README.md` 添加 kanban 迁移方案条目
- 在 `docs/design/README.md` 添加 kanban 集成调研条目
- 在 `docs/README.md` 添加 `docs/requirements/` 分类下的条目

**优先级**: P1
**修复记录**: 待修复

---

### 5. README.md 未更新 kanban API 端点

**文件**: `README.md`

**问题**: 后端新增了 `/api/kanban/*` 路由（tasks、tasks/:id、stats、employees），但 README.md 未记录这些端点。API 状态码、请求参数、响应格式均未文档化。

**修复建议**: 在 README.md 的 API 文档部分添加 kanban 端点说明。

**优先级**: P1
**修复记录**: 待修复

---

### 6. `get_stats` 返回类型不一致

**文件**: `backend/src/services/kanban.rs:34-42`, `backend/src/handlers/kanban.rs:34-45`

**问题**: `get_stats()` service 返回 `KanbanStats`，但 handler 层用 `json!({ "stats": stats })` 包装。其他方法（list_tasks、get_employees）返回 `Vec`，handler 也用 JSON 包装。风格一致，但 `get_stats` 的返回类型是 `Result<KanbanStats, AppError>` 而其他是 `Result<Vec<T>, AppError>` 或 `Result<Value, AppError>`。`get_task` 返回 `Result<Value, AppError>` 但实际永远返回 `Err(AppError::NotFound)`（stub），类型签名暗示可能返回成功值。

**修复建议**: 统一 stub 方法的返回类型签名，或添加注释说明预期返回格式。

**优先级**: P2
**修复记录**: 待修复

---

## 🟢 轻微问题（可选优化）

### 7. `KanbanService` 的 `new()` 和 `Default` 实现冗余

**文件**: `backend/src/services/kanban.rs:6-18`

**问题**: `KanbanService` 是空结构体，同时实现了 `Default` 和 `new()`，两者功能完全相同。

**修复建议**: 保留 `#[derive(Default)]` 即可，移除手动 `impl Default` 和 `new()`。或者保留 `new()` 移除 `Default` impl。

**优先级**: P3
**修复记录**: 待修复

---

### 8. `KanbanEvent` 模型已定义但未使用

**文件**: `backend/src/models/kanban.rs:34-39`

**问题**: `KanbanEvent` 结构体已定义，但当前无任何代码引用。WebSocket 事件代理（KAN-206）尚未实现。

**修复建议**: 保留即可，Phase 2 后续任务会使用。可添加 `#[allow(dead_code)]` 消除编译警告。

**优先级**: P3
**修复记录**: 无需修复

---

## 亮点 ✅

- **路由语法正确** — 使用 `:id` 语法（axum 0.7.x 兼容），避免了 `/{id}` 导致 404 的坑
- **tenant 隔离架构设计合理** — `get_tenant_for_user` 从 user_tenants 表查询，不信任前端参数
- **DB 迁移完整** — `user_tenants` 表 + 索引 + 数据迁移 SQL 都在 `pool.rs` 中，`INSERT OR IGNORE` 保证幂等
- **模块声明完整** — `handlers/mod.rs`、`services/mod.rs`、`models/mod.rs` 都正确添加了 `pub mod kanban`
- **auth middleware 正确应用** — kanban 路由通过 `route_layer` 绑定了 `auth_middleware`，未登录用户返回 401
- **代码风格整洁** — 函数长度均 ≤ 20 行，命名规范，注释到位

---

## 审查结论

**代码质量**: ⭐⭐⭐⭐☆ (4/5)

**可合并性**: ❌ 需修改后重审

**原因**: 3 个严重问题（2 个安全漏洞 + 无测试）必须修复。

**修复优先级**:
1. 🔴 tenant 隔离漏洞（get_task、get_stats）— P0
2. 🔴 添加 kanban 模块测试 — P0
3. 🟡 文档索引更新 — P1
4. 🟡 README 更新 — P1

**预计修复时间**: 1-2 天
