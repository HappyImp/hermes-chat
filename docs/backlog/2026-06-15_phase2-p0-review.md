# Phase 2 P0 审查 — KAN-205/207/208 Backlog

> 审查日期：2026-06-15
> 审查人：裁判君
> 审查任务：Phase 2 P0 — KAN-205 员工列表接口 / KAN-207 TenantPermission 模型 / KAN-208 TenantScope 中间件

---

## 🔴 严重问题（必须修复）

### 1. `filter_by_tenant` 空壳实现，tenant 隔离未生效

**文件**: `backend/src/services/kanban.rs:175-179`

**问题**: 函数接受 `_tenant_id` 参数但完全忽略，返回全量员工列表。KAN-205 的核心需求是"按 tenant 过滤员工"，当前实现等于没有隔离。不同租户的用户会看到完全相同的员工列表。

```rust
// 当前代码 — tenant_id 被忽略
fn filter_by_tenant(employees: &[EmployeeInfo], _tenant_id: &str) -> Vec<EmployeeInfo> {
    employees.to_vec()
}
```

**修复建议**:
- 至少实现基于 user_tenants 表的过滤逻辑
- 或在函数体内返回明确的"未实现"错误而非静默返回全量数据
- 如果确实是 stub，必须在 API 响应中注明

**优先级**: P0 — 核心功能未实现
**修复记录**: 待修复

---

## 🟡 中等问题（建议修复）

### 2. TenantScope::from_request_parts 存在死代码路径

**文件**: `backend/src/middleware/tenant.rs:61-102`

**问题**: tenant_middleware 在 handler 执行前已将 TenantScope 注入 extensions，因此 header/query 回退路径（62-93 行）永远不会执行。这些路径还跳过了 tenant_access 验证，如果未来 middleware 顺序变更，会成为安全漏洞。

**修复建议**: 移除 header/query 回退逻辑，只保留 extensions 读取 + default。或将验证逻辑抽为共享函数，确保所有路径都经过 access check。

**优先级**: P1
**修复记录**: 待修复

### 3. `get_tenant_for_user` LIMIT 1 无 ORDER BY

**文件**: `backend/src/services/kanban.rs:216-224`

**问题**: 多租户用户（如同时属于 board-a 和 board-b）每次请求可能返回不同的 tenant_id，导致数据不一致。

**修复建议**: 添加 `ORDER BY created_at DESC` 确保确定性，或在 user_tenants 表增加 `is_default` 字段标识主 tenant。

**优先级**: P1
**修复记录**: 待修复

### 4. Forbidden 错误消息泄露 tenant ID

**文件**: `backend/src/middleware/tenant.rs:145`

**问题**: `format!("无权访问 tenant: {}", t)` 会把内部 tenant 标识符返回给客户端，可能被用于枚举有效 tenant。

**修复建议**: 日志中记录完整信息（已有 `tracing::warn`），返回给客户端的消息改为通用的"访问被拒绝"。

**优先级**: P1
**修复记录**: 待修复

---

## 🟢 轻微问题（可选优化）

### 5. TenantId 类型别名多余

**文件**: `backend/src/middleware/tenant.rs:31-32`

**问题**: `pub type TenantId = TenantScope` 增加认知负担但无实际价值。

**修复建议**: 统一使用 `TenantScope`，移除别名。

**优先级**: P3
**修复记录**: 待修复

### 6. tenant_middleware 中 AuthUser 提取代码重复

**文件**: `backend/src/middleware/tenant.rs:138-142, 150-154`

**问题**: 两处完全相同的 `.ok_or(AppError::Auth(...))` 代码块。

**修复建议**: 在函数开头一次性提取 AuthUser，后续直接使用。

**优先级**: P3
**修复记录**: 待修复

### 7. CLI 路径硬编码

**文件**: `backend/src/services/kanban.rs:11`

**问题**: `HERMES_BIN` 硬编码为 `/opt/hermes/.venv/bin/hermes`，不同部署环境路径不同。

**修复建议**: 改为环境变量读取，带默认值。

**优先级**: P3
**修复记录**: 待修复

---

## 亮点 ✅

- middleware 层顺序正确（auth → tenant → handler）
- tenant ID 格式验证完善（is_valid_tenant_id）
- 15 个集成测试覆盖 tenant 隔离、权限检查、多用户场景
- DB 迁移幂等设计（INSERT OR IGNORE + ALTER TABLE 容错）
- 函数长度合规（所有函数 ≤ 20 行）
- 缓存设计合理（5 分钟 TTL + RwLock）
- 前次审查 3 个 🔴 全部修复

---

## 审查结论

**代码质量**: ⭐⭐⭐⭐☆ (4/5)
**可合并性**: 🟡 需修改后重审
**原因**: 1 个严重问题（filter_by_tenant 空壳，tenant 隔离未生效）必须修复。
