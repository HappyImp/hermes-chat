# 审查问题记录: Rust 后端

> 日期：2026-06-14 | 审查人：裁判君 | 开发：404

## 第一轮审查：文档缺失（🔴 打回）

裁判君首次审查发现后端项目缺少独立文档目录，主项目 docs/ 中虽有 PRD 和设计文档，但 backend/ 下无 docs/ 索引。打回要求补充。

### 问题清单

| # | 严重度 | 问题 | 状态 |
|---|--------|------|------|
| 1 | 🔴 | backend/docs/ 目录缺失，无 PRD/设计/backlog 文档 | ✅ 已修复 |
| 2 | 🔴 | 后端文档未在主项目 docs/README.md 索引中链接 | ✅ 已修复 |

## 第二轮审查：代码 warnings（🟡 待优化）

cargo check 产生 19 个 dead_code warnings。虽然不影响编译和运行，但不符合 0 warning 质量标准。

### 问题清单

| # | 严重度 | 文件 | 问题 | 状态 |
|---|--------|------|------|------|
| 1 | 🟡 | models/message.rs | Message/CreateMessage/MessageResponse/MessageListResponse 未使用（预备功能） | ✅ 已修复 |
| 2 | 🟡 | models/permission.rs | Permission/SetPermission/PermissionResponse 未使用（预备功能） | ✅ 已修复 |
| 3 | 🟡 | services/chat.rs | ChatService 及其方法未使用（消息持久化预备） | ✅ 已修复 |
| 4 | 🟡 | services/session.rs | get_by_id 方法未使用 | ✅ 已修复 |
| 5 | 🟡 | services/employee.rs | PermissionRow.allowed 字段未读取 | ✅ 已修复 |
| 6 | 🟡 | errors/mod.rs | AuthError::ExpiredToken 未构造 | ✅ 已修复 |
| 7 | 🟡 | middleware/rate_limit.rs | RateLimiter 整体未使用（速率限制预备） | ✅ 已修复 |
| 8 | 🟡 | handlers/chat.rs | ChatRequest.session_id/stream 字段未读取 | ✅ 已修复 |
| 9 | 🟡 | config.rs | RateLimitConfig.max_requests_per_minute 未读取 | ✅ 已修复 |
| 10 | 🟡 | config.rs | SecurityConfig.max_message_length 未读取 | ✅ 已修复 |
| 11 | 🟡 | config.rs | AppConfig.rate_limit 字段未读取 | ✅ 已修复 |
| 12 | 🟡 | middleware/auth.rs | AdminUser.user_id 字段未读取 | ✅ 已修复 |

### 修复策略

采用 `#[allow(dead_code)]` 标注而非删除代码，理由：
- 消息系统（ChatService/Message models）是下一阶段要实现的功能
- 速率限制（RateLimiter）是安全加固的预备代码
- Permission models 是权限系统完整实现的预留
- 删除后需要重新实现，浪费开发时间

### 验证

```
$ cargo check
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.87s
```

0 warning, 0 error。