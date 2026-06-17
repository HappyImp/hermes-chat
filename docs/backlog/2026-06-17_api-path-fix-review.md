# 2026-06-17 前端聊天 API 路径修复 — 审查 backlog

**审查任务**: t_520c06de — 审查前端聊天 API 路径修复
**审查人**: 裁判君
**审查结果**: ✅ 代码可部署，🟡 文档需同步

## 代码变更

- **commit**: 4952838
- **文件**: `src/hooks/useChat.ts` 第 6 行
- **变更**: `API_URL` 从 `/chat/v1/chat/completions` 改为 `/chat/api/chat/completions`
- **原因**: 旧路径走 `/chat/v1/` → Nginx 直接代理到 Hermes Gateway (8642)，缺少正确 API Key。新路径走 `/chat/api/` → Nginx 代理到 Rust 后端 (3000)，后端再转发到 Gateway 并携带正确凭据。

## 验证结果

| 检查项 | 结果 |
|--------|------|
| TypeScript 编译 | ✅ 0 errors |
| 前端测试 | ✅ 391 passed (36 files) |
| useChat 测试 | ✅ 11 passed |
| API 路径三端匹配 | ✅ Nginx / Vite / Rust 后端一致 |
| Authorization 传递 | ✅ 前端→代理→后端链路完整 |
| Commit message | ✅ 符合规范 |

## 🟡 中等问题

### 1. docs/test/test-cases.md:169 — 测试用例引用旧路径

**现状**:
```
TC-8.1.1 | 聊天 API | 1. 发送 POST 请求到 /chat/v1/chat/completions
```

**应改为**:
```
TC-8.1.1 | 聊天 API | 1. 发送 POST 请求到 /chat/api/chat/completions
```

**修复建议**: 404 下次迭代时更新

---

### 2. docs/prd/2026-06-14_basic-chat.md:41 — PRD 路径不准确

**现状**:
```
- **API**: SSE 流式接口 `POST /chat/api/v1/chat/completions`
```

**应改为**:
```
- **API**: SSE 流式接口 `POST /chat/api/chat/completions`
```

**修复建议**: 404 下次迭代时更新

---

### 3. docs/architecture/README.md:88 — 架构文档路径不准确

**现状**:
```
POST /chat/api/v1/chat/completions
```

**应改为**:
```
POST /chat/api/chat/completions
```

**修复建议**: 404 下次迭代时更新

## 修复记录

| 问题 | 状态 | 修复人 | 修复日期 |
|------|------|--------|----------|
| test-cases.md 旧路径 | ⬜ 待修复 | - | - |
| basic-chat PRD 路径 | ⬜ 待修复 | - | - |
| architecture README 路径 | ⬜ 待修复 | - | - |
