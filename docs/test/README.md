# 测试文档

## 1. 测试策略

### 1.1 测试框架

**前端：**
- **Vitest**: 测试运行器
- **@testing-library/react**: React 组件测试
- **@testing-library/jest-dom**: DOM 断言扩展
- **@vitest/coverage-v8**: 代码覆盖率

**后端：**
- **cargo test**: Rust 内置测试框架
- **sqlx**: 内存数据库集成测试
- **tokio::test**: 异步测试运行时

### 1.2 测试类型

| 类型 | 覆盖范围 | 目标 |
|------|----------|------|
| 单元测试 | Utils 工具函数 | 100% |
| 组件测试 | UI 组件渲染和交互 | ≥80% |
| Store 测试 | 状态管理逻辑 | ≥90% |
| Hook 测试 | 自定义 Hooks | ≥80% |
| 后端集成测试 | DB 迁移 / Service 层 / 权限隔离 | ≥80% |

## 2. 测试目录结构

```
src/
├── api/__tests__/
│   └── cronJobs.test.ts
├── components/__tests__/
│   ├── Toast.test.tsx
│   ├── Welcome.test.tsx
│   ├── MessageInput.test.tsx
│   ├── MessageBubble.test.tsx
│   ├── CodeBlock.test.tsx
│   ├── ChatArea.test.tsx
│   ├── Sidebar.test.tsx
│   ├── ChannelList.test.tsx
│   ├── SessionList.test.tsx
│   └── EmployeeStatus.test.tsx
├── components/Office/__tests__/
│   ├── PixelOffice.test.tsx
│   ├── SpeechBubble.test.tsx
│   ├── sprites.test.ts
│   ├── spriteLoader.test.ts
│   ├── officeLayout.test.ts
│   ├── pixelArt.test.ts
│   └── pixelArtImage.test.ts
├── hooks/__tests__/
│   ├── useChat.test.ts
│   ├── useSession.test.ts
│   ├── useToast.test.ts
│   ├── useEmployeeStatus.test.ts
│   └── mergeWithActive.test.ts
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

## 6. 后端测试（Rust）

### 6.1 测试文件

| 文件 | 覆盖范围 | 测试数 |
|------|----------|--------|
| `tests/kanban_tests.rs` | Kanban Service 层（tenant 隔离、CRUD、事件轮询） | ~25 |
| `tests/tenant_tests.rs` | TenantScope 提取器 + is_valid_tenant_id | ~6 |
| `tests/permission_tests.rs` | 权限管理、授权码、用户 CRUD、审计日志 | ~18 |
| `tests/profile_tests.rs` | Profile Service 层 | ~5 |
| `tests/user_tenants_migration_tests.rs` | KAN-105: user_tenants 表结构、约束、数据迁移 | ~12 |

### 6.2 运行方式

```bash
# 运行所有后端测试
cd backend && cargo test

# 运行特定测试文件
cargo test --test user_tenants_migration_tests

# 运行特定测试
cargo test test_user_tenants_table_exists

# 带输出
cargo test -- --nocapture
```

### 6.3 数据库迁移测试

KAN-105 新增 `user_tenants` 表迁移测试，覆盖：
- 表结构验证（列名、类型）
- 索引存在性（user_id、tenant_id）
- UNIQUE 约束（user_id + tenant_id 不可重复）
- 多 tenant / 多用户场景
- 外键级联删除（用户删除 → user_tenants 清理）
- 数据迁移幂等性（INSERT OR IGNORE）
- 迁移跳过 disabled 权限
- permissions 表 tenant 列默认值
