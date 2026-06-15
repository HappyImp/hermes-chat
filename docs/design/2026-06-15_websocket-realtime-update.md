# Design: KAN-304 WebSocket 实时更新

> 日期：2026-06-15
> 对应 PRD：[prd/2026-06-15_websocket-realtime-update.md](../prd/2026-06-15_websocket-realtime-update.md)

## 1. 架构概览

```
┌─────────────────────────────────────────────────┐
│              useEmployeeStatus Hook              │
│                                                  │
│  VITE_USE_KANBAN === 'true' ?                   │
│    YES → KanbanWebSocket 模式                    │
│           ├─ connected: 事件驱动更新              │
│           └─ disconnected: 降级 30s 轮询          │
│    NO  → 保持 60s setInterval 轮询               │
└─────────────────────────────────────────────────┘
```

## 2. KanbanWebSocket 类改造

### 2.1 新增类型

```typescript
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
type StatusChangeHandler = (status: ConnectionStatus) => void;
```

### 2.2 新增属性

| 属性 | 类型 | 说明 |
|------|------|------|
| connectionStatus | `ConnectionStatus` | 当前连接状态（只读 getter） |
| lastMessageTime | `Date \| null` | 最后收到消息的时间 |

### 2.3 新增方法

| 方法 | 说明 |
|------|------|
| onStatusChange(handler) | 注册状态变化回调，返回取消注册函数 |

### 2.4 状态流转

```
connect() → status='connecting'
onopen    → status='connected', 重置 reconnectDelay
onclose   → stopped ? status='disconnected'
                   : status='reconnecting' → scheduleReconnect()
reconnect → status='connecting' → tryConnect()
```

## 3. useEmployeeStatus Hook 改造

### 3.1 WS 模式数据流

```
mount → fetchKanbanTasks() 初始化
     → KanbanWebSocket.connect()
     → 监听事件:
        task.created/updated/claimed/completed/deleted
          → fetchKanbanTasks() 重新拉取 → 更新 employees
        heartbeat → 更新 lastMessageTime
     → 断线 → 降级 30s 轮询
     → 重连 → 停止轮询，恢复 WS 事件驱动
```

### 3.2 返回值

```typescript
{
  employees: Employee[];
  lastUpdated: Date;
  refresh: () => Promise<void>;
  wsStatus: 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'polling';
  lastWsUpdate: Date | null;
  wsError: string | null;
}
```

## 4. 文件改动清单

| 文件 | 改动 |
|------|------|
| `src/api/kanban.ts` | 扩展 KanbanEventType、改造 KanbanWebSocket 类 |
| `src/hooks/useEmployeeStatus.ts` | WS 模式集成 + 降级逻辑 |
| `src/api/__tests__/kanban.test.ts` | 新增事件类型 + 连接状态测试 |
| `src/hooks/__tests__/useEmployeeStatus.test.ts` | WS 模式 + 降级测试 |

## 5. 关键决策

1. **WS 断线降级为 30s 而非 60s** — 30s 是合理平衡点，比 60s 更实时但不会过于频繁
2. **heartbeat 只更新 lastMessageTime** — 不触发状态刷新，减少不必要的 API 调用
3. **task 事件触发完整刷新** — 简单可靠，避免复杂的增量更新逻辑
4. **Feature flag 为环境变量** — 与 kanban-migration-plan 一致，支持运行时切换
