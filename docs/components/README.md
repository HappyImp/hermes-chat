# 组件文档

## 1. Sidebar

**路径**: `src/components/Sidebar/Sidebar.tsx`

侧边栏容器，包含 Channel 列表和会话列表。

### Props

| 属性 | 类型 | 描述 |
|------|------|------|
| isOpen | boolean | 侧边栏是否展开（移动端） |
| onClose | () => void | 关闭侧边栏回调 |

### 特性

- 移动端：overlay 模式，点击遮罩关闭
- 桌面端：固定显示在左侧

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

## 4. ChatArea

**路径**: `src/components/Chat/ChatArea.tsx`

聊天区域容器。

### 特性

- 顶部工具栏：在线状态、导出、清空
- 消息列表自动滚动到底部
- 空会话显示欢迎页
- 流式回复时显示打字指示器

---

## 5. MessageBubble

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

## 6. MessageInput

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

## 7. Welcome

**路径**: `src/components/Chat/Welcome.tsx`

空会话欢迎页面。

### 特性

- 显示标题和提示文字
- 居中显示

---

## 8. CodeBlock

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

## 9. Toast

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
