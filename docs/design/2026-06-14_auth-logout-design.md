# 设计: 登出功能 (Token 黑名单)

**日期**: 2026-06-14
**关联 PRD**: [prd/2026-06-14_auth-logout.md](../prd/2026-06-14_auth-logout.md)

## 1. 技术方案

### 1.1 数据库设计

新增 `token_blacklist` 表：

    CREATE TABLE token_blacklist (
        token_hash TEXT PRIMARY KEY,  -- SHA-256 哈希，不存原始 token
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

**设计决策**:
- 存储 token 哈希而非原始 token（安全考虑）
- 包含 expires_at 字段支持定期清理过期记录
- 使用 INSERT OR IGNORE 防止重复插入

### 1.2 后端架构

    ┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
    │   Handler    │────>│   AuthService     │────>│   SQLite DB     │
    │   logout()   │     │   logout()        │     │   token_blacklist│
    └─────────────┘     │   is_blacklisted() │     └─────────────────┘
                        └──────────────────┘
                                ↑
    ┌─────────────┐             │
    │  Middleware  │─────────────┘
    │  auth_check  │  每次请求检查黑名单
    └─────────────┘

### 1.3 关键实现

**AuthService 新增方法**:
- `logout(pool, token, user_id, exp)` — 将 token 哈希写入黑名单
- `is_token_blacklisted(pool, token)` — 检查 token 是否已失效
- `cleanup_expired_blacklist(pool)` — 清理过期记录（定时任务调用）

**中间件改动**:
- `auth_middleware` 在 JWT 验证后增加黑名单检查
- 黑名单中的 token 返回 401

**Handler**:
- `logout` 提取 Authorization header 中的原始 token
- 解码获取 exp（过期时间）
- 调用 AuthService.logout() 入库

### 1.4 前端架构

    authStore.logout()
        │
        ├─ 1. 调用 API: POST /api/auth/logout (带 token)
        │     └─ 失败时 catch，不阻塞
        │
        └─ 2. 清除本地状态
              └─ set({ token: null, username: null, isAuthenticated: false })

## 2. 依赖变更

- 新增 `sha2 = "0.10"` 依赖（Cargo.toml）

## 3. 数据流

1. 用户点击登出 → Sidebar 调用 `authStore.logout()`
2. authStore 调用 `logoutApi(token)` → POST /api/auth/logout
3. 后端 Handler 提取 token → 解码获取 exp
4. AuthService 计算 token SHA-256 哈希 → INSERT INTO token_blacklist
5. 返回 200 → 前端清除本地状态
6. 后续请求中间件检查黑名单 → token 已失效返回 401
