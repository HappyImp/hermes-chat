# 产品需求文档索引

> 按迭代拆分的 PRD 文档

| 文档 | 日期 | 功能范围 | 状态 |
|------|------|----------|------|
| [basic-chat](2026-06-14_basic-chat.md) | 2026-06-14 | F1 实时聊天 + F4 数据持久化 | ✅ 完成 |
| [session-management](2026-06-14_session-management.md) | 2026-06-14 | F2 会话管理 + F3 Channel + F5 导出 | ✅ 完成 |
| [employee-status](2026-06-14_employee-status.md) | 2026-06-14 | 员工状态面板 | ✅ 完成 |
| [shell-hooks](2026-06-14_shell-hooks.md) | 2026-06-14 | Shell Hooks 自动追踪 | ✅ 完成 |
| [pixel-office](2026-06-14_pixel-office.md) | 2026-06-14 | 像素风办公室 | ✅ 完成 |

## 技术约束（全局）

- 前端框架：React 18 + TypeScript
- 构建工具：Vite
- 样式方案：TailwindCSS
- 状态管理：Zustand
- 存储：localStorage
- API：SSE 流式接口 `/chat/api/v1/chat/completions`

## 配色方案（暗色主题）

| 变量 | 色值 | 用途 |
|------|------|------|
| bg | #0d1117 | 页面背景 |
| surface | #161b22 | 卡片/侧边栏背景 |
| border | #30363d | 边框 |
| text | #e6edf3 | 主文字 |
| text2 | #8b949e | 次文字 |
| primary | #58a6ff | 主色调/链接 |
| userBg | #1f6feb | 用户消息气泡 |
| botBg | #21262d | AI 消息气泡 |
| danger | #f85149 | 危险操作 |
| success | #3fb950 | 在线状态 |

## 里程碑

| 阶段 | 内容 | 状态 |
|------|------|------|
| v1.0 | React 重构 + 基础聊天 | ✅ 完成 |
| v1.1 | 会话管理 + Channel | ✅ 完成 |
| v1.2 | 导出 + 持久化 | ✅ 完成 |
| v2.0 | 多模型支持 | 📋 规划中 |
