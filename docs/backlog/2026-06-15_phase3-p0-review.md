# Phase 3 P0 审查 — KAN-301/302/303

> 审查人：裁判君
> 审查日期：2026-06-15
> 审查结论：🟡 需修改后可合并（5🟡 + 3🟢）
> 代码质量：⭐⭐⭐⭐☆ (4/5)

## 审查范围

| 任务 | 文件 | 说明 |
|------|------|------|
| KAN-301 | src/api/kanban.ts | kanban API 模块（REST + WebSocket） |
| KAN-302 | src/types/employee.ts | 扩展 Employee 类型 |
| KAN-303 | src/hooks/useEmployeeStatus.ts | 改造 useEmployeeStatus hook |

## 🟡 中等问题

### 1. MessageEvent 类型可能未声明
- **文件**: src/api/kanban.ts:140
- **描述**: `this.ws.onmessage = (msg: MessageEvent)` 使用了 MessageEvent 类型，但文件顶部没有 import。在 lib: ["DOM"] 的 tsconfig 下通常可用，但如果配置不同可能报错。
- **建议**: 确认 tsconfig.json 的 lib 包含 "DOM"，或显式添加类型注释
- **状态**: ⬜ 待修复

### 2. 状态映射语义不一致
- **文件**: src/api/kanban.ts:218-250 vs src/types/employee.ts:90-103
- **描述**: `deriveKanbanTaskStatus` 将 kanban 'done' 映射为 status='off'，但 `kanbanStatusToEmployeeStatus` 将 'done' 映射为 'completed'。两处对 'done' 的语义理解不同，可能导致前端显示混乱。
- **建议**: 统一语义，要么 deriveKanbanTaskStatus 对 done 返回 'completed'，要么在文档中明确说明两个函数的使用场景区别
- **状态**: ⬜ 待修复

### 3. Employee 接口有未使用的计数字段
- **文件**: src/types/employee.ts:15-21
- **描述**: `kanbanRunningCount`、`kanbanPendingCount`、`kanbanCompletedCount` 三个字段已定义，但 `mergeWithKanban` 只设置了 `taskCount` 和 `kanbanStatus`，从未填充这三个计数字段。定义了但不用 = 死代码。
- **建议**: 要么在 mergeWithKanban 中填充这三个字段，要么从 Employee 接口中移除
- **状态**: ⬜ 待修复

### 4. deprecated 字段仍在测试中使用
- **文件**: src/types/employee.ts:39-43, src/api/__tests__/kanban.test.ts:17-18
- **描述**: `createdAt` 和 `updatedAt` 标记为 @deprecated，建议用 created_at/started_at，但测试文件的 makeTask 仍然使用 createdAt/updatedAt。
- **建议**: 测试中改用 created_at/started_at，与新接口对齐
- **状态**: ⬜ 待修复

### 5. useEmployeeStatus hook 函数过长
- **文件**: src/hooks/useEmployeeStatus.ts:189-281
- **描述**: hook 函数体约 60 行，超过 20 行限制。虽然逻辑清晰（三层合并），但可读性可以更好。
- **建议**: 将三层合并逻辑抽取为独立的 `buildEmployeeList(jobs, active, kanbanTasks)` 函数
- **状态**: ⬜ 待修复

## 🟢 轻微问题

### 1. API_BASE 硬编码
- **文件**: src/api/kanban.ts:4
- **描述**: `const API_BASE = '/chat/api/kanban'` 硬编码，部署路径变化需手动修改
- **建议**: 考虑从环境变量或配置中读取

### 2. 员工映射硬编码
- **文件**: src/api/kanban.ts:196-208
- **描述**: `mapKanbanAssigneeToEmployee` 使用硬编码映射，每次新增员工都需要修改
- **建议**: 考虑从配置或 EMPLOYEE_META 动态生成映射

### 3. EMPLOYEE_META 重复维护风险
- **文件**: src/hooks/useEmployeeStatus.ts:19-26
- **描述**: EMPLOYEE_META 与 kanban.ts 的 mapKanbanAssigneeToEmployee 存在重复维护风险
- **建议**: 抽取到共享配置文件

## ✅ 亮点

- 三层合并架构设计优秀（cron → active → kanban），优先级清晰
- WebSocket 指数退避重连实现规范，有 stopped 标志防止泄漏
- 测试覆盖全面：kanban.test.ts (198行) + useEmployeeStatus.test.ts (432行)
- 边界处理完善：API 失败返回空数组/null，不影响 UI 渲染
- mergeWithKanban 只升级状态不降级（working 不会被降为 standby），设计合理
- JSDoc 注释到位，关键函数都有说明
- 使用 encodeURIComponent 防注入，安全性好

## 修复记录

| # | 问题 | 修复人 | 修复日期 | 修复方式 |
|---|------|--------|----------|----------|
| 1 | MessageEvent 类型 | | | |
| 2 | 状态映射不一致 | | | |
| 3 | 未使用的计数字段 | | | |
| 4 | deprecated 字段在测试中 | | | |
| 5 | hook 函数过长 | | | |
