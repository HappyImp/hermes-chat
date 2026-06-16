# 设计拆解文档

## 文档索引

| 文档 | 说明 |
|------|------|
| [2026-06-14_auth-login-register-design.md](2026-06-14_auth-login-register-design.md) | 登录/注册功能设计 |
| [auth-logout-design](2026-06-14_auth-logout-design.md) | 认证登出功能设计 |
| [2026-06-14_employee-async-task-design.md](2026-06-14_employee-async-task-design.md) | F6 员工异步任务设计 |
| [2026-06-14_employee-status-design.md](2026-06-14_employee-status-design.md) | 员工状态面板设计 |
| [2026-06-14_pixel-office-design.md](2026-06-14_pixel-office-design.md) | 像素风办公室设计 |
| [2026-06-14_rust-backend-account-system.md](2026-06-14_rust-backend-account-system.md) | Rust 后端 + 账户系统设计 |
| [2026-06-15_account-disabled-design.md](2026-06-15_account-disabled-design.md) | 账户禁用功能设计 |
| [2026-06-15_kanban-migration.md](../requirements/kanban-migration-plan.md) | Kanban 迁移方案（架构设计 + 接口定义 + 验收标准） |
| [2026-06-15_websocket-realtime-update.md](2026-06-15_websocket-realtime-update.md) | KAN-304 WebSocket 实时更新设计 |
| [admin-panel-design.md](admin-panel-design.md) | 后台管理面板设计 |

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