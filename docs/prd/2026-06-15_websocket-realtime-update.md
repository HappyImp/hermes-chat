# PRD: KAN-304 WebSocket 实时更新

> 日期：2026-06-15
> 优先级：P1
> 前置任务：KAN-301（kanban API 模块）、KAN-303（useEmployeeStatus 改造）

## 1. 背景

当前 `useEmployeeStatus` hook 使用 60s `setInterval` 轮询获取员工状态，存在：
- 状态更新延迟最高 60s
- 浪费带宽和后端资源
- WebSocket 客户端（`KanbanWebSocket`）已实现但未集成

## 2. 目标

- 替代轮询为 WebSocket 事件驱动更新
- 通过 `VITE_USE_KANBAN` feature flag 控制开关
- WebSocket 断线时自动降级为 30s 轮询
- 重连成功后恢复 WebSocket 模式
- 暴露连接状态供 UI 展示

## 3. 功能需求

### 3.1 WebSocket 事件扩展

| 事件类型 | 说明 | 处理方式 |
|----------|------|----------|
| task_created | 新任务创建 | 更新对应员工状态 |
| task_changed | 任务更新（含状态变更、重新分配） | 更新新旧 assignee 状态 |
| task_claimed | 任务被认领 | 更新对应员工状态 |
| task_deleted | 任务删除 | 从缓存移除，更新员工状态 |
| heartbeat | 心跳保活 | 仅更新 lastMessageTime |

### 3.2 连接状态管理

KanbanWebSocket 暴露 `connectionStatus` 属性：
- `connecting` — 正在建立连接
- `connected` — 已连接
- `disconnected` — 已断开（主动或被动）
- `reconnecting` — 自动重连中

提供 `onStatusChange` 回调和 `lastMessageTime` 属性。

### 3.3 Hook 返回值扩展

| 字段 | 类型 | 说明 |
|------|------|------|
| wsStatus | `'connecting' \| 'connected' \| 'disconnected' \| 'reconnecting' \| 'polling'` | 当前数据获取模式 |
| lastWsUpdate | `Date \| null` | 最后一次 WS 事件时间 |
| wsError | `string \| null` | WS 错误信息 |

### 3.4 降级策略

```
WS connected → 使用 WS 事件驱动
WS disconnected → 降级为 30s 轮询（非 60s）
WS reconnecting → 继续 30s 轮询
WS reconnected → 停止轮询，恢复 WS 模式
```

### 3.5 Feature Flag

```
VITE_USE_KANBAN=true  → WS 模式 + 降级轮询
VITE_USE_KANBAN≠true  → 保持现有 60s 轮询（行为不变）
```

## 4. 非功能需求

- TypeScript 类型安全
- 单测覆盖新逻辑
- ESLint + Prettier 格式化

## 5. 验收标准

- [ ] `task_claimed`、`task_deleted` 和 `heartbeat` 事件正确解析
- [ ] 连接状态变化触发 `onStatusChange` 回调
- [ ] `lastMessageTime` 在收到消息时更新
- [ ] Feature flag 关闭时行为与现有逻辑完全一致
- [ ] Feature flag 开启时 WS 断线自动降级为 30s 轮询
- [ ] 重连成功后停止轮询恢复 WS 模式
- [ ] 所有现有测试通过，新逻辑有对应测试
