# 组件文档

## 1. Sidebar

**路径**: `src/components/Sidebar/Sidebar.tsx`

侧边栏容器，包含 Channel 列表、会话列表和员工状态面板。

### Props

| 属性 | 类型 | 描述 |
|------|------|------|
| isOpen | boolean | 侧边栏是否展开（移动端） |
| onClose | () => void | 关闭侧边栏回调 |

### 特性

- 移动端：overlay 模式，点击遮罩关闭
- 桌面端：固定显示在左侧
- 底部「👥 员工状态」按钮，切换到员工状态面板

---

## 2. ChannelList

**路径**: `src/components/Sidebar/ChannelList.tsx`

Channel 管理组件。

### Props

| 属性 | 类型 | 描述 |
|------|------|------|
| currentChannel | string | 当前选中的 Channel |
| onSelect | (channel: string) => void | 选择 Channel |
| onDelete | (channel: string) => void | 删除 Channel |

### 特性

- 显示所有 Channel 列表
- 支持创建新 Channel
- default Channel 不可删除
- 选中状态高亮

---

## 3. SessionList

**路径**: `src/components/Sidebar/SessionList.tsx`

会话列表组件。

### Props

| 属性 | 类型 | 描述 |
|------|------|------|
| sessions | Session[] | 会话列表 |
| currentSessionId | string \| null | 当前会话 ID |
| onSelect | (id: string) => void | 选择会话 |
| onDelete | (id: string) => void | 删除会话 |
| onNew | () => void | 新建会话 |

### 特性

- 按更新时间倒序排列
- 显示会话标题（截取前 20 字符）
- 选中状态高亮
- Hover 显示删除按钮

---

## 4. EmployeeStatus

**路径**: `src/components/Sidebar/EmployeeStatus.tsx`

员工实时状态面板，展示每个 AI 员工的工作状态、当前任务和任务列表。

### Props

| 属性 | 类型 | 描述 |
|------|------|------|
| onBack | () => void | 返回主侧边栏回调 |

### 特性

- 显示所有员工列表（老财、铁壳、小K、404、裁判君）
- 每个员工卡片显示：头像 emoji、名字、角色、状态标签、当前任务、任务标签
- 状态标签：工作中 🟢 / 待命 🟡 / 休息 ⚪
- 顶部统计：在岗人数 / 总人数
- 顶部统计栏显示最后更新时间（右上角）
- 右上角刷新按钮
- 自动刷新（每 60 秒）
- 深色主题，与现有 UI 一致
- 移动端适配

### 数据来源

- `src/data/employees.json` — 初始员工状态数据
- `src/hooks/useEmployeeStatus.ts` — 状态管理 Hook
- Hermes CronJob API (`/api/jobs`) — 定时任务状态
- Shell Hooks 状态文件 (`/tmp/employees-active.json`) — 临时任务活跃状态

### Shell Hooks 自动追踪

员工通过 `hermes -z` 执行的临时任务不在 cronjob 列表中，面板无法感知。
Shell Hooks 机制在 session start/end 时自动写入/移除活跃状态文件。

**工作流程：**

1. Hermes 在 session 启动时调用 `scripts/employee-hook.sh on_session_start`
2. 脚本从 `HERMES_SESSION_PROMPT` 前 6 字节识别员工名（老财/铁壳/小K/404/裁判君）
3. 写入 `/tmp/employees-active.json`，格式：`{"员工名": {"task": "...", "startedAt": "..."}}`
4. session 结束时调用 `on_session_end` 移除对应条目
5. `useEmployeeStatus` hook 并行 fetch cronjob API + active 文件，合并结果

**合并规则：**

- cronjob 显示 working → 保持 working
- cronjob 显示 standby/off 但 active 文件有该员工 → 升级为 working + 文件中的 task

**并发安全：** `flock` 文件锁避免多 session 同时写入竞态。

**开发环境：** Vite dev server 通过 middleware 直接读取 `/tmp/employees-active.json`。

---

## 5. ChatArea

**路径**: `src/components/Chat/ChatArea.tsx`

聊天区域容器。

### 特性

- 顶部工具栏：在线状态、导出、清空
- 消息列表自动滚动到底部
- 空会话显示欢迎页
- 流式回复时显示打字指示器
- 支持 `/dispatch` 命令：拦截命令 → 启动员工任务 → 插入 TaskCard → 同时触发 AI 回复

---

## 6. MessageBubble

**路径**: `src/components/Chat/MessageBubble.tsx`

单条消息气泡组件。

### Props

| 属性 | 类型 | 描述 |
|------|------|------|
| message | Message | 消息对象 |

### 特性

- 用户消息：右侧蓝色气泡，纯文本
- AI 消息：左侧灰色气泡，Markdown 渲染
- 任务消息：左侧 TaskCard 组件渲染（通过 message.metadata 识别）
- 头像 emoji 区分角色

---

## 7. MessageInput

**路径**: `src/components/Chat/MessageInput.tsx`

消息输入框组件。

### Props

| 属性 | 类型 | 描述 |
|------|------|------|
| onSend | (text: string) => void | 发送消息回调 |
| disabled | boolean | 是否禁用（流式回复中） |

### 特性

- Enter 发送，Shift+Enter 换行
- 自动调整高度（最大 160px）
- 空内容时发送按钮禁用
- 禁用状态不可发送

---

## 8. Welcome

**路径**: `src/components/Chat/Welcome.tsx`

空会话欢迎页面。

### 特性

- 显示标题和提示文字
- 居中显示

---

## 9. CodeBlock

**路径**: `src/components/CodeBlock/CodeBlock.tsx`

代码块组件，支持复制功能。

### Props

| 属性 | 类型 | 描述 |
|------|------|------|
| html | string | 渲染后的 HTML |

### 特性

- 代码高亮
- 语言标签显示
- 一键复制按钮

---

## 10. Toast

**路径**: `src/components/Toast/Toast.tsx`

全局提示组件。

### Props

| 属性 | 类型 | 描述 |
|------|------|------|
| message | string \| null | 提示消息 |

### 特性

- 底部居中显示
- 自动消失（2 秒）
- 无消息时不渲染

---

## 11. TaskCard

**路径**: `src/components/Chat/TaskCard.tsx`

员工异步任务卡片组件，显示任务状态、进度和结果。

### Props

| 属性 | 类型 | 描述 |
|------|------|------|
| taskInfo | TaskInfo | 任务信息对象 |

### TaskInfo 接口

| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 任务 ID |
| employee | string | 员工名称 |
| task | string | 任务描述 |
| status | 'pending' \| 'working' \| 'completed' \| 'failed' \| 'timeout' | 任务状态 |
| startedAt | Date | 启动时间 |
| result | string? | 任务结果（完成后） |
| error | string? | 错误信息（失败时） |

### 特性
- 状态图标：⏳等待 🔄执行中 ✅完成 ❌失败 ⏰超时
- 员工头像 emoji + 角色名显示
- 任务完成后显示结果，失败时显示错误信息
- 深色主题，与现有 UI 一致

### 数据来源

- `src/hooks/useEmployeeTask.ts` — 任务调度与轮询
- `/tmp/employees-active.json` — 任务状态文件
