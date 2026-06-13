# 代码审查待优化清单

> 来源：裁判君首次审查（2026-06-14）
> 代码质量：⭐⭐⭐⭐☆ (4/5)
> 审查结论：✅ 可部署（无严重问题）

## 🟡 中等问题（建议修复）

### 1. XSS 消毒 — MessageBubble.tsx:23
- **问题**：`dangerouslySetInnerHTML` 渲染 Markdown 未做 XSS 消毒
- **风险**：marked v15 不内置 sanitize，LLM 返回内容若含 `<img onerror=...>` 或 `<a href="javascript:...">` 可触发 XSS（prompt injection 场景）
- **建议**：引入 DOMPurify 对 `renderMarkdown` 输出做 sanitize
- **优先级**：高（LLM 场景下 prompt injection 是真实风险）

### 2. React key 使用 index — ChatArea.tsx:46
- **问题**：`messages.map((msg, i) => <MessageBubble key={i} .../>)`，当消息列表变更时可能导致渲染异常
- **建议**：给 Message 类型加 `id` 字段，用唯一 id 做 key
- **优先级**：中

### 3. useSession export 测试覆盖不足 — useSession.ts:11-34
- **问题**：`exportChat` / `downloadExport` 未被测试覆盖（覆盖率 54.54%）
- **建议**：补充 useSession 的 export 功能单测
- **优先级**：中

### 4. renderMarkdown 错误回退路径未测试 — markdown.ts:23-28
- **问题**：错误回退路径未测试（覆盖率 77.41%）
- **建议**：补充 renderMarkdown 异常分支测试
- **优先级**：中

## 🟢 轻微问题（可选优化）

### 5. 死代码：utils/storage.ts
- **问题**：`loadFromStorage` / `saveToStorage` 仅在测试中使用，实际存储由 Zustand persist 处理
- **建议**：删除或改为封装 Zustand persist 的自定义 storage adapter

### 6. 死代码：utils/markdown.ts escapeHtml
- **问题**：`escapeHtml` 函数未在任何生产代码中使用
- **建议**：统一使用或删除未使用的导出

### 7. 重复代码：sessionStore.ts
- **问题**：`addMessage` / `updateLastMessage` / `clearCurrentMessages` 重复了按索引查找 session 的模式
- **建议**：抽取 `updateSession` 辅助函数减少重复

### 8. 缺少 Error Boundary
- **问题**：全项目无 React Error Boundary，渲染异常会导致白屏
- **建议**：在 App 层添加 ErrorBoundary 兜底

### 9. 移动端交互：ChannelList.tsx:66-68
- **问题**：删除按钮在移动端 hover 时 opacity-0 导致不可见
- **建议**：移动端考虑长按或显示操作菜单

---

## 修复记录

| 日期 | 问题编号 | 修复人 | 状态 |
|------|---------|--------|------|
| - | - | - | 待修复 |
