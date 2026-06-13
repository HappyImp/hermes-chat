# 架构文档

## 1. 整体架构

采用 **分层架构**，自上而下为：

```
┌───────────────────────────────┐
│        Components (UI层)       │
├───────────────────────────────┤
│        Hooks (逻辑层)          │
├───────────────────────────────┤
│        Store (状态层)          │
├───────────────────────────────┤
│        Utils (工具层)          │
└───────────────────────────────┘
```

## 2. 状态管理架构

使用 Zustand + persist 中间件实现：

```typescript
// sessionStore.ts
export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      // state
      sessions: {},
      currentChannel: 'default',
      currentSessionId: null,
      isStreaming: false,

      // actions
      setChannel: (channel) => { ... },
      createSession: (channel) => { ... },
      // ...
    }),
    { name: 'hermes_chat_sessions' },
  ),
);
```

### 2.1 数据模型

```typescript
interface Session {
  id: string;           // UUID v4
  title: string;        // 自动截取自第一条用户消息
  channel: string;      // 所属 Channel
  messages: Message[];   // 消息列表
  createdAt: string;    // ISO 时间戳
  updatedAt: string;    // ISO 时间戳
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}
```

### 2.2 状态图

```
[初始] → sessions: {}
      → currentChannel: 'default'
      → currentSessionId: null

[创建会话] → sessions[channel].push(newSession)
          → currentSessionId = newSession.id

[发送消息] → sessions[channel][idx].messages.push(msg)
          → updatedAt = now()

[流式更新] → sessions[channel][idx].messages[last].content += delta

[切换会话] → currentSessionId = sessionId

[删除会话] → sessions[channel].filter(s => s.id !== sessionId)
           → currentSessionId = next || null
```

## 3. SSE 流式通信

### 3.1 请求格式

```
POST /chat/api/v1/chat/completions
Content-Type: application/json

{
  "model": "hermes-agent",
  "messages": [
    {"role": "user", "content": "你好"},
    {"role": "assistant", "content": "你好！"},
    {"role": "user", "content": "今天天气如何？"}
  ],
  "stream": true
}
```

### 3.2 响应格式 (SSE)

```
data: {"choices":[{"delta":{"content":"你"}}]}
data: {"choices":[{"delta":{"content":"好"}}]}
data: {"choices":[{"delta":{"content":"！"}}]}
data: [DONE]
```

### 3.3 解析流程

```typescript
function parseSSEChunk(buffer, full) {
  const lines = buffer.split('\n');
  const leftover = lines.pop();
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6).trim();
    if (data === '[DONE]') continue;
    const parsed = JSON.parse(data);
    const delta = parsed.choices?.[0]?.delta?.content;
    if (delta) full += delta;
  }
  return [leftover, full];
}
```

## 4. Markdown 渲染

使用 `marked` + `highlight.js`:

```typescript
function createRenderer() {
  const renderer = new marked.Renderer();
  renderer.code = function ({ text, lang }) {
    const highlighted = lang && hljs.getLanguage(lang)
      ? hljs.highlight(text, { language: lang }).value
      : hljs.highlightAuto(text).value;
    return `<pre><div class="code-header">
      <span>${lang || 'code'}</span>
      <button class="copy-btn">📋 复制</button>
    </div><code class="hljs">${highlighted}</code></pre>`;
  };
  return renderer;
}
```

## 5. 本地存储策略

- **Key**: `hermes_chat_sessions`
- **Value**: JSON 序列化的完整状态
- **时机**: 每次状态变更自动保存（Zustand persist）
- **恢复**: 页面加载时自动读取并恢复
- **降级**: localStorage 不可用时降级为空状态

## 6. 响应式布局

```
Desktop (≥1024px):
┌──────────┬───────────────────────┐
│ Sidebar  │      ChatArea         │
│ (260px)  │      (flex-1)         │
│          │                       │
└──────────┴───────────────────────┘

Mobile (<1024px):
┌───────────────────────┐
│ ☰   Header            │
├───────────────────────┤
│                       │
│      ChatArea         │
│                       │
└───────────────────────┘
Sidebar: overlay, toggle with button
```
