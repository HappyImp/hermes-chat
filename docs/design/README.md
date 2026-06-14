# 设计拆解文档

## 1. 组件拆解

### 1.1 组件树
```
App
├── Sidebar (侧边栏)
│   ├── ChannelList (Channel 列表)
│   └── SessionList (会话列表)
├── ChatArea (聊天区域)
│   ├── Header (顶栏)
│   ├── MessageList (消息列表)
│   │   ├── Welcome (欢迎页)
│   │   ├── MessageBubble (消息气泡)
│   │   │   └── TaskCard (任务卡片)
│   └── MessageInput (输入框)
└── Toast (全局提示)
```

### 1.2 组件职责

| 组件 | 职责 | Props |
|------|------|-------|
| App | 根组件，管理侧边栏状态 | - |
| Sidebar | 侧边栏容器 | isOpen, onClose |
| ChannelList | Channel 的增删切换 | currentChannel, onSelect, onDelete |
| SessionList | 会话的增删切换 | sessions, currentSessionId, onSelect, onDelete, onNew |
| ChatArea | 聊天区域容器 + dispatch 命令拦截 | - |
| MessageBubble | 单条消息展示（含任务卡片分支） | message |
| TaskCard | 员工任务卡片展示 | taskInfo |
| MessageInput | 消息输入框 | onSend, disabled |
| Welcome | 空会话欢迎页 | - |
| CodeBlock | 代码块展示+复制 | html |
| Toast | 全局提示 | message |

## 2. 状态设计

### 2.1 全局状态 (Zustand Store)

```typescript
interface ChatState {
  sessions: Record<string, Session[]>;  // channel -> sessions
  currentChannel: string;
  currentSessionId: string | null;
  isStreaming: boolean;
}
```

### 2.2 状态操作

| 操作 | 描述 |
|------|------|
| setChannel | 切换 Channel，自动创建不存在的 |
| createSession | 创建新会话 |
| deleteSession | 删除指定会话 |
| setCurrentSession | 切换当前会话 |
| addMessage | 添加消息到当前会话（支持 metadata） |
| updateLastMessage | 更新最后一条消息（流式） |
| clearCurrentMessages | 清空当前会话消息 |
| deleteChannel | 删除 Channel 及其会话 |

### 2.3 持久化策略

- 使用 Zustand `persist` 中间件
- 存储 Key: `hermes_chat_sessions`
- 存储位置: localStorage
- 自动序列化/反序列化

## 3. 数据流

### 3.1 普通聊天流程
```
用户输入 → MessageInput.onSend
         → ChatArea.handleSend
         → useChat.sendMessage
         → store.addMessage (user)
         → store.addMessage (assistant, empty)
         → fetch SSE API
         → 流式读取 → store.updateLastMessage
         → 完成 → store.setState(isStreaming: false)
```

### 3.2 员工任务流程
```
用户输入 "/dispatch 404 fix bug"
         → ChatArea.handleSend
         → parseCommand(text)
         → useEmployeeTask.dispatchTask()
         → POST /chat/api/tasks/dispatch
         → addMessage(task metadata)
         → useEmployeeTask polls /chat/data/employees-active.json
         → TaskCard 实时更新状态
```

## 4. 样式方案

- **TailwindCSS** 为主
- 自定义颜色映射暗色主题
- `@layer components` 定义 Markdown 样式
- `@layer utilities` 定义动画
- 响应式断点: `lg:` (1024px) 区分移动端/桌面端

## 5. 目录结构

```
src/
├── components/          # UI 组件
│   ├── Chat/           # 聊天相关
│   │   ├── ChatArea.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── MessageInput.tsx
│   │   ├── Welcome.tsx
│   │   ├── TaskCard.tsx
│   │   └── index.ts
│   ├── Sidebar/        # 侧边栏相关
│   │   ├── Sidebar.tsx
│   │   ├── ChannelList.tsx
│   │   ├── SessionList.tsx
│   │   └── index.ts
│   ├── CodeBlock/
│   │   ├── CodeBlock.tsx
│   │   └── index.ts
│   └── Toast/
│       ├── Toast.tsx
│       └── index.ts
├── hooks/              # 自定义 Hooks
│   ├── useChat.ts
│   ├── useSession.ts
│   ├── useToast.ts
│   ├── useEmployeeStatus.ts
│   ├── useEmployeeTask.ts
│   └── index.ts
├── store/              # 状态管理
│   └── sessionStore.ts
├── utils/              # 工具函数
│   ├── markdown.ts
│   ├── storage.ts
│   ├── uuid.ts
│   ├── commandParser.ts
│   └── index.ts
├── types/              # 类型定义
│   ├── index.ts
│   └── employee.ts
├── api/                # API 层
│   └── cronJobs.ts
├── styles/             # 全局样式
│   └── index.css
├── test/               # 测试配置
│   └── setup.ts
├── App.tsx
└── main.tsx
```

## 6. 专项设计文档

- [员工状态面板设计](2026-06-14_employee-status-design.md)
- [像素风办公室设计](2026-06-14_pixel-office-design.md)
- [员工异步任务设计](2026-06-14_employee-async-task-design.md)
