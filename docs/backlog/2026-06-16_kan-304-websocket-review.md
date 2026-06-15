# 审查待优化清单 — KAN-304 WebSocket 实时更新

> 审查日期：2026-06-16
> 提交：592a337
> 审查人：裁判君

---

## 🔴 严重问题（必须修复）

### 1. Nginx 缺少 WebSocket Upgrade 头 — 生产环境 WS 连不进来

**文件**: `/etc/nginx/conf.d/*.conf`（Nginx 配置，非代码提交）
**问题**: `/chat/api/` 和 `/api/` 两个 location 块均未配置 `Upgrade` / `Connection` 头。前端 WS URL 为 `ws://host/chat/api/kanban/events?token=...`，经 Nginx 反代时升级握手被吞，连接降级为普通 HTTP 400。

**影响**: 生产环境 WebSocket 功能完全不可用（开发直连不受影响）。

**修复方案**:
```nginx
location /chat/api/ {
    proxy_pass http://127.0.0.1:3000/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Authorization $http_authorization;
    # 新增 ↓
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
```

**责任人**: 铁壳（运维）

---

### 2. 后端未实现 `task_claimed` / `task_deleted` / `heartbeat` 事件

**文件**: `backend/src/handlers/kanban.rs:149-223`
**问题**: 后端 `handle_ws` 只检测 `task_created` 和 `task_changed`，但 PRD 验收标准要求：
- `task_claimed` — 任务被认领时发送
- `task_deleted` — 任务被删除时发送
- `heartbeat` — 心跳保活

**影响**:
- 前端已实现 `task_claimed` 和 `heartbeat` 的处理逻辑，但永远收不到
- 任务删除后前端缓存不会清除
- 无心跳 → 前端 `lastMessageTime` 永远为 null，无法检测连接假死

**修复方案**:
- `task_claimed`: 在 snapshot diff 中检测 assignee 变更
- `task_deleted`: 检测 snapshot 中存在但本轮消失的 task_id
- `heartbeat`: 在 poll 间歇（如每 30s）发送一次 `{"type":"heartbeat"}`

**责任人**: 404

---

## 🟡 中等问题（建议修复）

### 3. `wsError` 字段声明但从未赋值

**文件**: `src/hooks/useEmployeeStatus.ts:194`
**问题**: PRD 要求暴露 `wsError: string | null`，代码声明了字段并返回，但整个 hook 中只有 `setWsError(null)` 的清除逻辑，从未 `setWsError("...")` 设置错误信息。`KanbanWebSocket.onerror` 回调也是空的。

**建议**: 在 `KanbanWebSocket.onerror` 中记录错误信息，通过 `onStatusChange` 或新增 `onError` 回调传递给 hook。

---

### 4. `handleWsEvent` 直接变异 ref 数组

**文件**: `src/hooks/useEmployeeStatus.ts:274-281`
**问题**: `kanbanTasksRef.current` 是一个数组引用，`tasks.push(task)` 和 `tasks[idx] = task` 直接变异了这个数组。虽然在 ref 场景下不会导致 React 渲染问题，但违反了不可变数据最佳实践，且如果后续有人将此逻辑迁移到 state 中会踩坑。

**建议**: 改为 `kanbanTasksRef.current = [...tasks, task]` 或 `[...tasks.slice(0, idx), task, ...tasks.slice(idx+1)]`。

---

### 5. 任务删除事件前端未处理

**文件**: `src/hooks/useEmployeeStatus.ts:264-281`
**问题**: `handleWsEvent` 没有 `task_deleted` 的处理分支。即使后端补发了 `task_deleted` 事件，前端也不会从缓存中移除已删除的任务。

**建议**: 添加 `if (type === 'task_deleted' && idx !== -1) { tasks.splice(idx, 1); }`。

---

### 6. PRD 事件类型与实现不一致

**文件**: `docs/prd/2026-06-15_websocket-realtime-update.md:26-33`
**问题**: PRD 写 `task.created` / `task.updated` / `task.completed` / `task.deleted`，实际后端发送 `task_created` / `task_changed` / `task_claimed`。设计文档已修正为实际类型，但 PRD 未同步。

**建议**: 更新 PRD 事件类型表格与实际实现一致。

---

### 7. 测试报告过期

**文件**: `docs/test/2026-06-15_test-report.md`
**问题**: 报告记录 33 文件 / 271 测试，但当前实际为 37 文件 / 359 测试。新增 4 个测试文件（`useKanbanWebSocket.test.ts` 等）和 88 个测试用例未更新。

**建议**: 更新测试报告，记录新增的 WebSocket 相关测试。

---

### 8. 增量更新不处理任务重新分配

**文件**: `src/hooks/useEmployeeStatus.ts:264-331`
**问题**: 如果一个任务的 assignee 从 A 改为 B，`handleWsEvent` 只更新 B 的状态，不会重新计算 A 的状态。A 的面板会残留已转移的任务数据直到下次 `refresh()`。

**建议**: 在处理 `task_changed` 事件时，同时重新计算旧 assignee 的员工状态。

---

## 🟢 轻微问题（可选优化）

### 9. `connectionStatus` getter 冗余

**文件**: `src/api/kanban.ts:132-135`
**问题**: `connectionStatus` 和 `status` 两个 getter 返回相同值，注释说"与 PRD 接口一致"，但 `useKanbanWebSocket` 只用了 `onStatusChange`，没用 getter。可以只保留一个。

---

### 10. `useKanbanWebSocket` 每次 reconnect 创建新实例

**文件**: `src/hooks/useKanbanWebSocket.ts:40-69`
**问题**: `connect()` 每次调用都会 `disconnect()` 旧实例并 `new KanbanWebSocket()`。KanbanWebSocket 本身有断线重连机制，如果只是网络闪断，两套重连逻辑会重叠（WS 内部重连 + hook 层 reconnect）。不过当前代码中 `reconnect()` 只由用户手动触发，所以不会冲突。

**建议**: 可以接受，但建议加注释说明 `reconnect` 仅用于手动触发。

---

### 11. 未使用的 import

**文件**: `src/api/kanban.ts:1`
**问题**: `KanbanStats` 和 `Employee` 类型仍然从 `@/types/employee` 导入，但 `KanbanStats` 在本文件中未直接使用（在 `fetchKanbanStats` 的返回类型中用到了，实际有用）。`Employee` 类型在 `fetchKanbanEmployees` 返回类型中用到。确认均在使用。

---

## 亮点

- ✅ 指数退避重连设计合理（1s → 2s → ... → 30s max）
- ✅ WS 断线降级为 30s 轮询，重连后自动恢复 — 降级策略设计优秀
- ✅ Feature flag 控制开关，关闭时行为与现有逻辑完全一致 — 向后兼容
- ✅ 测试覆盖充分：KanbanWebSocket 18 个测试、useKanbanWebSocket 8 个、useEmployeeStatus WS 相关 3 个
- ✅ 文档齐全：PRD + 设计文档 + 索引全部更新
- ✅ 后端 WS 认证完整：JWT 验证 + 黑名单检查 + 账号禁用检查 + tenant 权限
- ✅ `onEventRef` 模式避免回调变化导致重连 — React hooks 最佳实践

---

## 总结

**代码质量**: ⭐⭐⭐⭐☆ (4/5)
**可合并性**: ❌ 需修复后重审

2 个 🔴 严重问题必须修复：
1. Nginx 缺 WebSocket Upgrade 头（铁壳修）
2. 后端缺少 task_claimed / task_deleted / heartbeat 事件实现（404 修）

8 个 🟡 中等问题建议修复但不阻塞合并（修完 🔴 后可一并处理）。
