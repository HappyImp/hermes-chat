# 测试报告 — 2026-06-16

## 概要

| 指标 | 数值 |
|------|------|
| 测试文件 | 37 passed |
| 测试用例 | 359 passed |
| 失败 | 0 |
| 耗时 | ~8s |

## 新增测试（本次 WebSocket 功能，4 个文件 / 88 个用例）

### useKanbanWebSocket（8 个）
1. 连接时调用 KanbanWebSocket.connect
2. 断开时调用 disconnect
3. 状态变化更新 wsStatus
4. 事件触发 onEvent 回调
5. 手动 reconnect 重新连接
6. 卸载时断开连接
7. 错误事件更新 wsError
8. 连接成功时清除 wsError

### kanban.ts — KanbanWebSocket（18 个）
1. 初始状态为 disconnected
2. connect 后状态变为 connecting → connected
3. disconnect 后状态变为 disconnected
4. 收到消息触发 handler
5. 消息解析失败静默忽略
6. 断线后自动重连（指数退避）
7. 重连延迟上限 30s
8. 主动断开不触发重连
9. onerror 触发错误回调
10. connectionStatus 别名一致性
11. lastMessageTime 更新
12-18. 其他边界场景

### useEmployeeStatus WS 相关（3 个）
1. wsStatus 为 connected（VITE_USE_KANBAN=true）
2. lastWsUpdate 和 wsError 初始值为 null
3. reconnect 函数可调用

### useEmployeeStatus 增量更新（新增，本次修复）
1. task_deleted 从缓存移除任务
2. task_changed 重新分配时重算旧 assignee
3. ref 数组不可变更新验证
4. wsError 从 WS 错误事件中赋值

## 之前已有测试（29 个文件 / 271 个用例）

详见 git log 历史。
