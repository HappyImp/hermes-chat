# 审查待优化清单 — task_claimed 旧 assignee 重算修复

> 审查日期：2026-06-16
> 任务：t_8a76d1b6
> 审查人：裁判君
> 代码提交：useEmployeeStatus.ts +3行，useEmployeeStatus.test.ts +59行

---

## 🔴 严重问题（必须修复）

无。

---

## 🟡 中等问题（建议修复）

### 1. 测试断言过弱 — 未验证重算行为

**文件**: `src/hooks/__tests__/useEmployeeStatus.test.ts:577-634`
**问题**: 2 个新测试（`task_claimed with reassignment` 和 `task_claimed for new task`）只断言 `lastWsUpdate` 是 Date，未验证核心逻辑：旧员工状态是否被重算。

`task_claimed` 重分配场景（任务从 404 → 裁判君）：
- 应验证 404 的 taskCount 从 1 减为 0
- 应验证 裁判君 的 taskCount 从 0 增为 1

**修复建议**:
- 在 act() 前后 mock `deriveKanbanTaskStatus` 返回不同值
- act() 后断言具体员工的 taskCount/kanbanStatus 变化
- 当前断言 `expect(lastWsUpdate).toBeInstanceOf(Date)` 只证明事件被处理，不能证明重算正确

**优先级**: 🟡 中等
**修复记录**:

| 日期 | 状态 | 说明 |
|------|------|------|
| 2026-06-16 | ⏳ 待修复 | 首次审查发现 |

---

### 2. backlog 🟡#1 未打钩 ✅

**文件**: `docs/backlog/2026-06-16_kan-304-review-v2.md:38-56`
**问题**: 二审报告中 🟡#1（`task_claimed` 处理未重算旧 assignee 状态）已修复，但文档标题未标记 ✅。

**修复**: 在条目标题后添加 `✅ 已修复`。

**优先级**: 🟡 中等
**修复记录**:

| 日期 | 状态 | 说明 |
|------|------|------|
| 2026-06-16 | ⏳ 待修复 | 首次审查发现 |

---

### 3. docs/README.md 索引过期

**文件**: `docs/README.md:62` 和测试文档区域
**问题**:
- 测试报告描述仍为 "33 文件 / 271 测试"，实际已为 37/359
- `docs/test/2026-06-16_admin-panel-e2e-test-report.md` 存在但未在索引列出

**优先级**: 🟡 中等
**修复记录**:

| 日期 | 状态 | 说明 |
|------|------|------|
| 2026-06-16 | ⏳ 待修复 | 首次审查发现 |

---

## 🟢 轻微问题（可选优化）

### 4. mock 未按场景区分

**文件**: `src/hooks/__tests__/useEmployeeStatus.test.ts:583-589`
**问题**: 2 个测试用同一个 `deriveKanbanTaskStatus` mock 返回值。事件前后 mock 相同，无法区分"重算成功"和"未重算"。

**建议**: act() 前后使用不同 mock 返回值。

---

## 总结

代码逻辑正确，+3 行零冗余修复。测试断言需加强以验证重算行为，文档需同步更新。编译/测试未验证（Terminal 被拦截），需手动运行：
```bash
cd /root/hermes-chat && npx tsc --noEmit
cd /root/hermes-chat && npx vitest run src/hooks/__tests__/useEmployeeStatus.test.ts
```
