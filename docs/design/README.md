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
│   │   └── TaskCard (任务卡片)
│   └── MessageInput (输入框)
└── EmployeeStatus (员工状态面板)
```

## 2. 状态管理

### 2.1 Zustand Store
- sessions: 会话数据
- currentChannel: 当前 Channel
- currentSessionId: 当前会话 ID
- isStreaming: 是否正在流式回复

## 3. 数据流

### 3.1 消息发送流程
1. 用户输入消息
2. 检查是否是 dispatch 命令
3. 如果是，启动员工任务
4. 插入 TaskCard 消息
5. 触发 AI 回复