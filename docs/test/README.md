# 测试文档

## 1. 测试策略

### 1.1 测试框架

- **Vitest**: 测试运行器
- **@testing-library/react**: React 组件测试
- **@testing-library/jest-dom**: DOM 断言扩展
- **@vitest/coverage-v8**: 代码覆盖率

### 1.2 测试类型

| 类型 | 覆盖范围 | 目标 |
|------|----------|------|
| 单元测试 | Utils 工具函数 | 100% |
| 组件测试 | UI 组件渲染和交互 | ≥80% |
| Store 测试 | 状态管理逻辑 | ≥90% |
| Hook 测试 | 自定义 Hooks | ≥80% |

## 2. 测试目录结构

```
src/
├── components/__tests__/
│   ├── Toast.test.tsx
│   ├── Welcome.test.tsx
│   ├── MessageInput.test.tsx
│   └── MessageBubble.test.tsx
├── hooks/__tests__/
│   ├── useChat.test.ts
│   ├── useSession.test.ts
│   └── useToast.test.ts
├── store/__tests__/
│   └── sessionStore.test.ts
└── utils/__tests__/
    ├── uuid.test.ts
    ├── storage.test.ts
    └── markdown.test.ts
```

## 3. 测试用例汇总

### 3.1 sessionStore (10 tests)

| 用例 | 描述 |
|------|------|
| creates a session | 创建会话并设置 currentSessionId |
| creates session in new channel | 切换到新 Channel 时自动创建会话 |
| adds message to current session | 添加消息并更新标题 |
| derives title from first user message | 标题截取前 20 字符 |
| updates last message | 流式更新最后一条消息 |
| deletes session | 删除会话并处理 currentSessionId |
| clears current messages | 清空当前会话消息 |
| deletes channel | 删除 Channel 回退到 default |
| switches session | 切换会话 |
| handles edge cases | 空消息更新、default channel 删除 |

### 3.2 useChat (4 tests)

| 用例 | 描述 |
|------|------|
| does not send empty message | 空消息不发送 |
| handles fetch error | 网络错误处理 |
| handles HTTP error | HTTP 错误处理 |
| sends message and processes SSE | 正常 SSE 流式响应 |

### 3.3 useSession (7 tests)

| 用例 | 描述 |
|------|------|
| returns empty messages when no session | 无会话返回空数组 |
| returns current session messages | 返回当前会话消息 |
| creates new session | 创建新会话 |
| deletes session | 删除会话 |
| returns all channels | 返回所有 Channel |
| clears chat | 清空对话 |
| returns channel name | 返回 Channel 名称 |

### 3.4 useToast (4 tests)

| 用例 | 描述 |
|------|------|
| starts with no message | 初始无消息 |
| shows toast message | 显示 Toast |
| hides toast after 2 seconds | 2 秒后自动隐藏 |
| resets timer on new toast | 新 Toast 重置计时器 |

### 3.5 组件测试 (19 tests)

- Toast: 2 tests
- Welcome: 1 test
- MessageInput: 8 tests
- MessageBubble: 7 tests

### 3.6 Utils 测试 (14 tests)

- generateId: 3 tests
- storage: 5 tests
- markdown: 6 tests (5 escapeHtml + 6 renderMarkdown)

## 4. 测试环境配置

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock localStorage, clipboard, fetch
```

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
    },
  },
});
```

## 5. 运行方式

```bash
# 运行所有测试
npm test

# 生成覆盖率报告
npm run test:coverage

# 监听模式
npx vitest --watch
```
