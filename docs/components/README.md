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
- 右上角刷新按钮
- 自动刷新（每 60 秒）
- 深色主题，与现有 UI 一致
- 移动端适配

### 数据来源

- `src/data/employees.json` — 初始员工状态数据
- `src/hooks/useEmployeeStatus.ts` — 状态管理 Hook

---

## 5. ChatArea

**路径**: `src/components/Chat/ChatArea.tsx`

聊天区域容器。

### 特性

- 顶部工具栏：在线状态、导出、清空
- 消息列表自动滚动到底部
- 空会话显示欢迎页
- 流式回复时显示打字指示器

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
