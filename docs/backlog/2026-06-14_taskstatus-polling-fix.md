# 审查待优化清单 — 2026-06-14 TaskStatus 轮询修复

**审查来源**：裁判君审查 commit `35f6fe4`
**修复人**：404
**修复时间**：2026-06-14

---

## 🔴 严重问题

| # | 问题 | 状态 | 修复说明 |
|---|------|------|----------|
| 1 | `ActiveEmployeeEntry.status` 类型声明太窄（只支持 `working|completed`），导致 `failed` 状态永远不会匹配，失败任务永远轮询不停 | ✅ 已修复 | 扩展类型支持 `working|completed|failed|timeout` |
| 2 | 轮询逻辑未处理 `timeout` 状态 | ✅ 已修复 | 增加 `timeout` 状态处理，与 `failed` 同等对待 |

---

## 🟡 中等问题

| # | 问题 | 状态 | 修复说明 |
|---|------|------|----------|
| 1 | `TaskStatus` 类型在 `useEmployeeTask.ts` 和 `types/index.ts` 重复定义 | ✅ 已修复 | 统一抽取到 `types/index.ts` 共用 |
| 2 | `TaskInfo` 接口在 `useEmployeeTask.ts` 和 `types/index.ts` 重复定义 | ✅ 已修复 | 统一到 `types/index.ts`，其他文件从 `@/types` 导入 |
| 3 | dispatch 后同时 sendMessage | ✅ 设计意图 | 用户发送 dispatch 命令时，同时显示任务卡片和 AI 回复，是合理设计 |
| 4 | XSS 防护 — 确认 `renderMarkdown()` 内部有 DOMPurify | ✅ 已确认 | `renderMarkdown()` 使用 `DOMPurify.sanitize()` 清理 HTML |
| 5 | 缺少 timeout 测试 | ✅ 已修复 | 新增 3 个测试：failed 状态轮询停止、timeout 状态轮询停止、maxRetries 超时 |

---

## 修复详情

### 类型统一

**修改文件**：
- `src/types/index.ts` — 新增 `TaskStatus` 类型导出，`TaskInfo` 使用统一类型
- `src/api/cronJobs.ts` — `ActiveEmployeeEntry.status` 扩展支持 `failed|timeout`
- `src/hooks/useEmployeeTask.ts` — 移除重复类型定义，从 `@/types` 导入
- `src/components/Chat/TaskCard.tsx` — 导入路径改为 `@/types`
- `src/components/__tests__/TaskCard.test.tsx` — 导入路径改为 `@/types`

### 轮询逻辑修复

**核心改动**：
```typescript
// 任务已结束的状态：completed / failed / timeout
if (entry?.status === 'completed') {
  updateTaskStatus(taskId, { status: 'completed', result: entry.task });
  stopPolling(taskId);
} else if (entry?.status === 'failed' || entry?.status === 'timeout') {
  updateTaskStatus(taskId, { status: entry.status, error: entry.task });
  stopPolling(taskId);
}
```

**新增辅助函数**：
```typescript
const stopPolling = useCallback((taskId: string) => {
  const timer = pollingTimers.current.get(taskId);
  if (timer) {
    clearTimeout(timer);
    pollingTimers.current.delete(taskId);
  }
}, []);
```

### 新增测试

1. `polling stops when task status becomes failed` — 验证 failed 状态正确停止轮询
2. `polling stops when task status becomes timeout` — 验证 timeout 状态正确停止轮询
3. `polling stops when maxRetries is reached` — 验证 60 次重试后自动设置 timeout

---

## 测试结果

- **修复前**：30 文件 / 246 测试
- **修复后**：30 文件 / 249 测试（+3）
- **状态**：✅ 全部通过

---

## 交活检查清单

- [x] `npm test` 全部通过（249 tests）
- [x] TypeScript 类型检查通过（`npx tsc --noEmit`）
- [x] 新增测试覆盖 timeout 和 failed 状态
- [x] 未删除任何已有测试
- [x] 文档已更新（本文档）