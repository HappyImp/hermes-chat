# F6: 员工异步任务设计文档

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (React)                         │
├─────────────────────────────────────────────────────────────┤
│  ChatArea → 命令解析 → TaskDispatcher → TaskCard            │
│                        ↓                                    │
│              useEmployeeTask (Hook)                         │
│                ↓                    ↓                       │
│     dispatchTask()          pollTaskStatus()                │
│         ↓                       ↓                           │
│  POST /chat/api/tasks    GET /chat/data/employees-active.json
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                     后端 (Hermes API)                       │
├─────────────────────────────────────────────────────────────┤
│  /api/tasks/dispatch → hermes -z 执行任务                   │
│       ↓                                                     │
│  Shell Hooks → /tmp/employees-active.json                   │
└─────────────────────────────────────────────────────────────┘
```

## 组件设计

### 1. 命令解析器 (commandParser.ts)

```typescript
interface ParsedCommand {
  type: 'dispatch' | 'unknown';
  employee?: string;
  task?: string;
  error?: string;
}

function parseCommand(input: string): ParsedCommand {
  const dispatchMatch = input.match(/^\/dispatch\s+(\S+)\s+(.+)$/);
  if (!dispatchMatch) {
    return { type: 'unknown', error: '不是 dispatch 命令' };
  }
  
  const [, employee, task] = dispatchMatch;
  const validEmployees = ['老财', '铁壳', '小K', '404', '裁判君', 'Ditto'];
  
  if (!validEmployees.includes(employee)) {
    return { type: 'unknown', error: `未知员工: ${employee}` };
  }
  
  return { type: 'dispatch', employee, task };
}
```

### 2. 任务调度 Hook (useEmployeeTask.ts)

```typescript
interface UseEmployeeTaskReturn {
  dispatchTask: (employee: string, task: string) => Promise<TaskInfo>;
  getTaskStatus: (taskId: string) => TaskStatus | null;
  activeTasks: Map<string, TaskInfo>;
}

interface TaskInfo {
  id: string;
  employee: string;
  task: string;
  status: 'pending' | 'working' | 'completed' | 'failed';
  startedAt: Date;
  result?: string;
  error?: string;
}

function useEmployeeTask(): UseEmployeeTaskReturn {
  const [activeTasks, setActiveTasks] = useState<Map<string, TaskInfo>>(new Map());
  
  const dispatchTask = useCallback(async (employee: string, task: string) => {
    const response = await fetch('/chat/api/tasks/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee, task }),
    });
    
    if (!response.ok) throw new Error('任务启动失败');
    
    const data = await response.json();
    const taskInfo: TaskInfo = {
      id: data.task_id,
      employee,
      task,
      status: 'working',
      startedAt: new Date(),
    };
    
    setActiveTasks(prev => new Map(prev).set(taskInfo.id, taskInfo));
    return taskInfo;
  }, []);
  
  // 轮询逻辑
  useEffect(() => {
    if (activeTasks.size === 0) return;
    
    const interval = setInterval(async () => {
      const response = await fetch('/chat/data/employees-active.json');
      const active = await response.json();
      
      setActiveTasks(prev => {
        const updated = new Map(prev);
        for (const [taskId, taskInfo] of prev) {
          const status = active[taskInfo.employee];
          if (status?.status === 'completed') {
            updated.set(taskId, {
              ...taskInfo,
              status: 'completed',
              result: status.result,
            });
          } else if (status?.status === 'failed') {
            updated.set(taskId, {
              ...taskInfo,
              status: 'failed',
              error: status.error,
            });
          }
        }
        return updated;
      });
    }, 5000);
    
    return () => clearInterval(interval);
  }, [activeTasks.size]);
  
  return { dispatchTask, getTaskStatus: (id) => activeTasks.get(id) ?? null, activeTasks };
}
```

### 3. 任务卡片组件 (TaskCard.tsx)

```tsx
interface TaskCardProps {
  employee: string;
  task: string;
  status: 'pending' | 'working' | 'completed' | 'failed';
  startedAt: Date;
  result?: string;
  error?: string;
}

function TaskCard({ employee, task, status, startedAt, result, error }: TaskCardProps) {
  const statusIcon = {
    pending: '⏳',
    working: '🔄',
    completed: '✅',
    failed: '❌',
  }[status];
  
  const statusText = {
    pending: '等待中',
    working: '执行中...',
    completed: '已完成',
    failed: '失败',
  }[status];
  
  return (
    <div className="task-card">
      <div className="task-header">
        <span className="task-icon">{statusIcon}</span>
        <span className="task-employee">{employee}</span>
      </div>
      <div className="task-body">
        <p className="task-description">{task}</p>
        <p className="task-status">{statusText}</p>
        {result && <p className="task-result">结果: {result}</p>}
        {error && <p className="task-error">错误: {error}</p>}
      </div>
      <div className="task-footer">
        <span className="task-time">
          启动时间: {startedAt.toLocaleString('zh-CN')}
        </span>
      </div>
    </div>
  );
}
```

### 4. 聊天集成 (ChatArea.tsx 修改)

```tsx
function ChatArea() {
  const { sendMessage } = useChat();
  const { dispatchTask } = useEmployeeTask();
  const { addMessage } = useSessionStore();
  
  const handleSend = async (text: string) => {
    // 检查是否是 dispatch 命令
    const command = parseCommand(text);
    
    if (command.type === 'dispatch' && command.employee && command.task) {
      try {
        const taskInfo = await dispatchTask(command.employee, command.task);
        
        // 插入任务卡片消息
        addMessage({
          id: generateId(),
          role: 'assistant',
          content: '',  // 空内容，使用 TaskCard 渲染
          metadata: {
            type: 'task',
            taskInfo,
          },
        });
        
        // 发送普通消息（触发 AI 回复）
        await sendMessage(text);
      } catch (error) {
        // 显示错误 Toast
        showToast('任务启动失败: ' + error.message);
      }
    } else {
      // 普通消息
      await sendMessage(text);
    }
  };
  
  return (
    <div className="chat-area">
      {/* 消息列表 */}
      <MessageList onSend={handleSend} />
      
      {/* 输入框 */}
      <MessageInput onSend={handleSend} />
    </div>
  );
}
```

## 状态管理

### Zustand Store 扩展

```typescript
// sessionStore.ts 新增
interface SessionStore {
  // ... 现有字段
  
  // 新增：任务元数据
  taskMetadata: Record<string, TaskInfo>;
  
  // 新增：设置任务元数据
  setTaskMetadata: (messageId: string, metadata: TaskInfo) => void;
}

// Message 类型扩展
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    type: 'task';
    taskInfo: TaskInfo;
  };
}
```

### 状态轮询策略

```typescript
// 轮询配置
const POLL_CONFIG = {
  interval: 5000,      // 5 秒
  maxRetries: 60,      // 最多轮询 5 分钟
  backoff: 1.5,        // 指数退避系数
};

// 轮询逻辑
function useTaskPolling(taskId: string, onStatusChange: (status: TaskStatus) => void) {
  const [retryCount, setRetryCount] = useState(0);
  
  useEffect(() => {
    if (retryCount >= POLL_CONFIG.maxRetries) {
      onStatusChange('timeout');
      return;
    }
    
    const interval = setTimeout(async () => {
      const status = await fetchTaskStatus(taskId);
      if (status === 'completed' || status === 'failed') {
        onStatusChange(status);
      } else {
        setRetryCount(prev => prev + 1);
      }
    }, POLL_CONFIG.interval * Math.pow(POLL_CONFIG.backoff, retryCount));
    
    return () => clearTimeout(interval);
  }, [taskId, retryCount, onStatusChange]);
}
```

## 数据流

### 触发流程
```
用户输入 "/dispatch 404 修复bug"
    ↓
ChatArea.handleSend()
    ↓
parseCommand(text) → { type: 'dispatch', employee: '404', task: '修复bug' }
    ↓
dispatchTask('404', '修复bug')
    ↓
POST /chat/api/tasks/dispatch
    ↓
后端执行: hermes -z "你是404..." --yolo --skills coder-404
    ↓
Shell Hooks 写入 /tmp/employees-active.json
    ↓
前端收到 taskInfo，插入 TaskCard 消息
    ↓
开始轮询 /chat/data/employees-active.json
```

### 状态更新流程
```
轮询 /chat/data/employees-active.json
    ↓
获取 { "404": { "task": "修复bug", "status": "working" } }
    ↓
更新 activeTasks Map
    ↓
TaskCard 组件重新渲染，显示"执行中..."
    ↓
（5秒后）
    ↓
获取 { "404": { "task": "修复bug", "status": "completed", "result": "..." } }
    ↓
更新 activeTasks Map
    ↓
TaskCard 组件重新渲染，显示"已完成"
```

## 边界处理

### 1. 员工忙碌
```typescript
async function dispatchTask(employee: string, task: string) {
  // 检查员工是否在执行任务
  const active = await fetchActiveEmployees();
  if (active[employee]?.status === 'working') {
    throw new Error(`员工 ${employee} 正在执行其他任务`);
  }
  
  // ... 启动任务
}
```

### 2. 会话切换
```typescript
function useEmployeeTask() {
  const currentSession = useSessionStore(state => state.currentSessionId);
  
  useEffect(() => {
    // 切换会话时，停止当前轮询
    // 但保留 activeTasks 状态
  }, [currentSession]);
}
```

### 3. 超时处理
```typescript
function useTaskPolling(taskId: string) {
  useEffect(() => {
    const timeout = setTimeout(() => {
      updateTaskStatus(taskId, 'timeout');
    }, 5 * 60 * 1000); // 5 分钟
    
    return () => clearTimeout(timeout);
  }, [taskId]);
}
```

## 测试策略

### 单元测试
- `commandParser.test.ts`：命令解析逻辑
- `useEmployeeTask.test.ts`：任务调度逻辑
- `TaskCard.test.tsx`：组件渲染逻辑

### 集成测试
- 完整流程：触发 → 轮询 → 完成
- 并发任务：同时启动多个任务
- 错误场景：员工忙、超时、网络错误

### E2E 测试
- 用户输入命令 → 看到任务卡片 → 看到状态更新 → 看到结果
