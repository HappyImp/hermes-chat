# PRD: 登出功能 (Token 黑名单)

**日期**: 2026-06-14
**状态**: 已完成
**作者**: 404

## 1. 背景

当前系统登录后生成 JWT token，有效期 24 小时。但用户登出时仅清除前端本地存储，token 在有效期内仍可被使用。存在安全风险：token 泄露后无法主动失效。

## 2. 需求目标

- 用户登出时，服务端主动失效当前 token
- 已失效的 token 无法通过认证中间件
- 前端登出流程：先通知服务端，再清除本地状态

## 3. 功能描述

### 3.1 API 接口

| 接口 | 方法 | 认证 | 说明 |
|------|------|------|------|
| /api/auth/logout | POST | 需要 | 将当前 token 加入黑名单 |

**请求头**: `Authorization: Bearer <token>`

**响应**:
- 200: `{ "message": "登出成功" }`
- 401: 缺少或无效 token

### 3.2 Token 黑名单机制

- 使用 SQLite `token_blacklist` 表存储已失效 token 的 SHA-256 哈希
- 认证中间件每次验证 token 时检查黑名单
- 黑名单记录包含过期时间，支持定期清理

### 3.3 前端适配

- `src/api/auth.ts` 新增 `logout(token)` API 函数
- `src/store/authStore.ts` 的 `logout()` 改为 async：先调 API，失败也不阻塞本地清理

## 4. 验收标准

- [x] POST /api/auth/logout 返回 200
- [x] 已登出的 token 再次请求返回 401
- [x] 前端登出后清除本地状态
- [x] cargo check 0 error 0 warning
- [x] npm test 全部通过
