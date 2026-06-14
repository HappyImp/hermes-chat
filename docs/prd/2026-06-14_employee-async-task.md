# F6: 员工异步任务功能 PRD

## 概述
允许用户在聊天界面触发员工执行异步任务，实时显示任务进度，并在完成后将结果写入聊天记录。

## 功能范围

### F6.1 任务触发
- **入口**：聊天输入框支持 `/dispatch <员工名> <任务描述>` 命令
- **触发方式**：用户在任意会话中输入命令，系统调用后端 API 启动任务
- **支持的员工**：老财、铁壳、小K、404、裁判君、Ditto
- **命令格式**：`/dispatch 404 修复登录bug` 或 `/dispatch 老财 分析600519`

### F6.2 任务状态追踪
- **状态存储**：`/tmp/employees-active.json`（复用现有 shell hooks 机制）
- **前端轮询**：每 5 秒轮询一次状态文件，更新 UI
- **状态类型**：`working`（执行中）、`completed`（已完成）、`failed`（失败）

### F6.3 进度展示
- **聊天消息卡片**：任务启动后，在聊天中插入一条任务卡片消息
- **进度更新**：任务执行中，卡片实时显示当前进度（如"正在分析..."）
- **结果展示**：任务完成后，卡片自动显示结果或标记完成

## 用户体验流程

```
用户输入: /dispatch 404 修复登录bug
    ↓
系统响应: 
┌─────────────────────────────────────┐
│ 🚀 员工任务已启动                      │
│ 员工: 404 (AI开发工程师)               │
│ 任务: 修复登录bug                      │
│ 状态: ⏳ 执行中...                     │
└─────────────────────────────────────┘
    ↓
（5秒后自动刷新）
┌─────────────────────────────────────┐
│ 🚀 员工任务                            │
│ 员工: 404 (AI开发工程师)               │
│ 任务: 修复登录bug                      │
│ 状态: ✅ 已完成                        │
│ 结果: 已修复，PR已提交                  │
└─────────────────────────────────────┘
```

## 技术约束

### 后端依赖
- Hermes API Server (端口 8642) 提供任务启动接口
- Shell hooks 写入 `/tmp/employees-active.json` 追踪状态
- `hermes -z` 命令执行异步任务（隔离会话）

### 前端约束
- 复用现有的 `useEmployeeStatus` hook 获取状态
- 复用现有的 `sessionStore` 存储聊天消息
- 状态轮询间隔：5 秒（可配置）

### API 端点设计
| 端点 | 方法 | 说明 |
|------|------|------|
| `/chat/api/tasks/dispatch` | POST | 启动员工任务 |
| `/chat/data/employees-active.json` | GET | 获取任务状态（复用现有） |

### 请求/响应格式
```json
// POST /chat/api/tasks/dispatch
{
  "employee": "404",
  "task": "修复登录bug",
  "session_id": "xxx"  // 可选，关联会话
}

// 响应
{
  "success": true,
  "task_id": "task_xxx",
  "employee": "404",
  "started_at": "2026-06-14T10:00:00Z"
}
```

## 状态轮询机制

### 轮询逻辑
```typescript
// 伪代码
function pollTaskStatus(taskId: string) {
  setInterval(async () => {
    const status = await fetch('/chat/data/employees-active.json');
    const task = status[employeeName];
    
    if (task?.status === 'completed') {
      // 更新卡片为完成状态
      updateMessageCard(taskId, { status: 'completed', result: task.result });
      stopPolling();
    } else if (task?.status === 'failed') {
      // 更新卡片为失败状态
      updateMessageCard(taskId, { status: 'failed', error: task.error });
      stopPolling();
    }
    // 继续轮询...
  }, 5000);
}
```

### 停止条件
- 任务状态变为 `completed` 或 `failed`
- 用户离开当前会话
- 超时（默认 5 分钟）

## 消息卡片设计

### 任务启动卡片
```tsx
<TaskCard
  employee="404"
  task="修复登录bug"
  status="working"
  startedAt="2026-06-14T10:00:00Z"
/>
```

### 卡片属性
| 属性 | 类型 | 说明 |
|------|------|------|
| employee | string | 员工名称 |
| task | string | 任务描述 |
| status | 'working' | 'completed' | 'failed' | 任务状态 |
| startedAt | string | 启动时间 |
| result | string? | 任务结果（完成后） |
| error | string? | 错误信息（失败时） |

## 边界场景

### 场景 1：员工已在执行任务
- **处理**：提示用户"该员工正在执行其他任务，请稍后再试"
- **UI**：Toast 提示

### 场景 2：员工名不存在
- **处理**：提示用户"未知员工，支持的员工：老财、铁壳、小K、404、裁判君、Ditto"
- **UI**：Toast 提示

### 场景 3：任务执行超时
- **处理**：5 分钟后自动标记为"超时"
- **UI**：卡片显示"⏰ 任务超时"

### 场景 4：用户离开会话
- **处理**：停止轮询，但任务继续执行
- **恢复**：用户回到会话时，重新轮询活跃任务

## 测试用例

### 单元测试
1. 命令解析：`/dispatch 404 修复bug` → `{ employee: '404', task: '修复bug' }`
2. 命令解析：`/dispatch 老财 分析600519` → `{ employee: '老财', task: '分析600519' }`
3. 命令解析：`/dispatch 未知员工 任务` → `{ employee: null, error: 'unknown' }`
4. 状态轮询：5 秒间隔触发
5. 状态轮询：任务完成后停止

### 集成测试
1. 完整流程：输入命令 → 启动任务 → 轮询状态 → 显示结果
2. 并发任务：同时启动多个员工任务
3. 会话切换：离开会话后停止轮询

## 文档更新
- [ ] docs/prd/README.md 索引更新
- [ ] docs/design/ 新增设计文档
- [ ] docs/components/ 新增 TaskCard 组件文档
