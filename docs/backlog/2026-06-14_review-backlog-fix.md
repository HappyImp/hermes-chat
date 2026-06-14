# 代码审查待优化清单

> 来源：裁判君审查（2026-06-14）
> 项目：hermes-chat
> 代码质量：⭐⭐⭐⭐☆ (4/5)

## 🟡 中等问题（建议修复）

### 1. [FIXED] docs/design/README.md 缺少 auth-logout-design 索引
- **问题**：design 目录下有 auth-logout-design.md 但 README.md 未索引
- **状态**：✅ 已修复（2026-06-14 by 404）

### 2. [FIXED] 测试报告数据过期 — docs/test/2026-06-14_test-report.md
- **问题**：报告记录 "27 files / 194 tests"，实际 "33 files / 265 tests"
- **状态**：✅ 已修复（2026-06-14 by 404）

### 3. [FIXED] vite.config.ts proxy 指向错误 — 127.0.0.1:8642
- **问题**：应指向后端 127.0.0.1:3000，当前指向 Hermes API Server 8642
- **状态**：✅ 已修复（2026-06-14 by 404）

### 4. [FIXED] authStore.test.ts 缺少 API 失败路径测试
- **问题**：logout API 失败时仍应清除本地状态，但无测试覆盖
- **状态**：✅ 已修复（2026-06-14 by 404）

### 5. [FIXED] cleanup_expired_blacklist 未接入定时任务
- **问题**：方法已实现但标记 #[allow(dead_code)]，无调用方
- **状态**：✅ 已修复（2026-06-14 by 404）— 接入 tokio::spawn 定时任务（每小时）

### 6. [NEW] 后端零测试覆盖
- **问题**：backend/ 目录无任何测试文件，0% 覆盖率
- **建议**：优先补 auth service 的 register/login/logout 单测
- **优先级**：中（本次不强制，记录 backlog）
- **状态**：待修复

---

## 修复记录

| 日期 | 问题编号 | 修复人 | 状态 |
|------|---------|--------|------|
| 2026-06-14 | #1-5 | 404 | ✅ 已修复 |
| 2026-06-14 | #6 | 404 | 📌 记录 backlog |
