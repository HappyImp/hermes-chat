# 裁判君审查：登出功能 (Token 黑名单)

**日期**: 2026-06-14
**审查范围**: 登出接口 + token 黑名单
**关联文档**: [PRD](../prd/2026-06-14_auth-logout.md) | [设计](../design/2026-06-14_auth-logout-design.md)

---

## 🟡 中等问题

### 1. docs/design/README.md 未更新索引
- **文件**: docs/design/README.md
- **问题**: 缺少 `2026-06-14_auth-logout-design.md` 索引条目，PRD README 和总 README 都已更新，唯独设计索引遗漏
- **建议**: 在 design/README.md 表格中添加一行
- **优先级**: 🟡 中等
- **状态**: ⬜ 待修复

### 2. 测试报告过时
- **文件**: docs/test/2026-06-14_test-report.md
- **问题**: 报告记录 27 文件/194 测试，实际 npm test 跑出 33 文件/265 测试（新增 authStore、Sidebar logout 等测试）
- **建议**: 更新测试报告，补充新增的 6 个测试文件和 71 个测试用例
- **优先级**: 🟡 中等
- **状态**: ⬜ 待修复

### 3. cleanup_expired_blacklist 从未调用
- **文件**: backend/src/services/auth.rs:123
- **问题**: `cleanup_expired_blacklist()` 已实现且标注 `#[allow(dead_code)]`，但无定时任务调用。黑名单表会无限增长
- **建议**: 接入 cron 定时清理（例如每天凌晨执行一次），或在应用启动时触发一次清理
- **优先级**: 🟡 中等
- **状态**: ⬜ 待修复

### 4. Vite 代理与生产路由不一致（dev 模式）
- **文件**: vite.config.ts:54
- **问题**: Vite dev proxy `/chat/api` → `http://127.0.0.1:8642/api`（Hermes API Server），但生产 Nginx 路由 `/chat/api/` → `http://127.0.0.1:3000/api/`（Rust 后端）。开发模式下 logout 请求会打到错误的服务
- **建议**: Vite proxy 应指向 `http://127.0.0.1:3000` 以与生产一致
- **优先级**: 🟡 中等
- **状态**: ⬜ 待修复

### 5. 后端无 Rust 单元测试
- **文件**: backend/src/ 全局
- **问题**: 所有认证逻辑（register/login/logout/blacklist）零 `#[cfg(test)]` 测试。核心安全功能无后端测试保障
- **建议**: 为 AuthService 添加单元测试，至少覆盖：logout 写入黑名单、is_token_blacklisted 判断、cleanup 删除过期记录
- **优先级**: 🟡 中等
- **状态**: ⬜ 待修复

### 6. authStore 测试缺少 API 失败路径
- **文件**: src/store/__tests__/authStore.test.ts
- **问题**: 仅测试 logout API 成功场景，未测试 API 失败时本地状态是否仍被清除（这是 authStore 的关键设计点：catch 后仍执行 set）
- **建议**: 添加测试 `logout API 失败时仍清除本地状态`
- **优先级**: 🟡 中等
- **状态**: ⬜ 待修复

---

## 🟢 轻微问题

### 1. 002_token_blacklist.sql 是死文件
- **文件**: backend/migrations/002_token_blacklist.sql
- **问题**: 迁移文件存在但从未执行（run_migrations 在 db/pool.rs 中内联了相同 DDL）。两个来源可能不同步
- **建议**: 统一迁移机制——要么用 sqlx migrate，要么去掉 migrations/ 目录，避免误导
- **优先级**: 🟢 轻微
- **状态**: ⬜ 待修复

### 2. logout handler 二次解码 JWT
- **文件**: backend/src/handlers/auth.rs:58-63
- **问题**: 中间件已解码一次 JWT，handler 再解码一次获取 exp。可通过在 Claims 中传递 exp 给 handler 避免
- **建议**: 将 exp 放入 AuthUser 或 extensions 中，避免重复解码
- **优先级**: 🟢 轻微
- **状态**: ⬜ 待修复

### 3. 中间件每次请求查 DB
- **文件**: backend/src/middleware/auth.rs:96
- **问题**: 每次认证请求都 SELECT COUNT 查黑名单表。当前规模可接受，流量增长后可能成瓶颈
- **建议**: 未来可考虑本地 LRU 缓存 + TTL，或 Redis 方案
- **优先级**: 🟢 轻微（暂不处理）
- **状态**: ⬜ 待评估

---

## 修复记录

| # | 问题 | 修复人 | 修复日期 | 修复说明 |
|---|------|--------|----------|----------|
|   |      |        |          |          |
