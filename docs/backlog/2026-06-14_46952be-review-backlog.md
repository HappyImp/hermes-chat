# 代码审查待优化清单

> 来源：裁判君三次审查（2026-06-14）
> 提交：46952be fix(chat): resolve SSE loading stuck and employee status always offline
> 代码质量：⭐⭐⭐⭐☆ (4/5)
> 审查结论：❌ 需修改后重审（1 个严重问题：测试报告过期）

## 🔴 严重问题（必须修复）

### 1. [NEW] 测试报告数据过期 — docs/test/2026-06-14_test-report.md
- **问题**：报告记录 "25 files / 182 tests"，实际跑出 "27 files / 189 tests"
- **差距**：mergeWithActive 3→10, EmployeeStatus 5→12, useSession 7→9, cronJobs 新增用例等
- **建议**：更新测试报告 + docs/README.md 引用
- **优先级**：高（文档同步底线）
- **状态**：待修复

## 🟡 中等问题（建议修复）

### 2. [NEW] deriveEmployeeStatus() 函数过长（67 行）— cronJobs.ts:63-130
- **问题**：二次审查 backlog #1 已标记（当时 49 行），本次提交加了 toLocaleString 后膨胀到 67 行，超 20 行限制 3x+
- **含**：3 个独立 for 循环 + 1 个 if 分支
- **建议**：拆为 findWorkingJob() / findStandbyJob() / findNextJob()，主函数 15 行内
- **优先级**：中
- **状态**：待修复（回归加重）

### 3. [NEW] SSE 修复缺少回归测试 — useChat.test.ts
- **问题**：修了 \r\n 处理 + decoder flush + 宽松 data: 匹配，但测试未覆盖这些场景
- **建议**：补充 3 个测试：
  - CRLF (\r\n) 行尾 SSE 数据
  - stream 结束时 buffer 残留数据 flush
  - "data:" (无空格) 边界 case
- **优先级**：中
- **状态**：待修复

### 4. [NEW] build-deploy.sh 硬编码 /var/www/chat — scripts/build-deploy.sh:21
- **问题**：`sudo rm -rf /var/www/chat/*` 路径写死无变量保护
- **建议**：提取 DEPLOY_DIR 变量，顶部加注释说明
- **优先级**：中
- **状态**：待修复

### 5. [NEW] sync_to_prod 静默吞错误 — employee-hook.sh:37-39
- **问题**：mkdir -p 和 cp 的错误被 2>/dev/null || true 吞掉，生产目录不可写时无任何告警
- **建议**：至少写一行到 stderr 或 syslog
- **优先级**：中
- **状态**：待修复

## 🟢 轻微问题（可选优化）

### 6. [NEW] SSE parser 设计决策缺少注释 — useChat.ts:14
- **问题**：`trimmed.slice(5).trim()` 同时处理 "data:value" 和 "data: value"，宽容但不直观
- **建议**：加行注释说明意图
- **优先级**：低
- **状态**：待优化

### 7. [NEW] decoder flush 追加 '\n' 不直观 — useChat.ts:72-75
- **问题**：`parseSSEChunk(buffer + '\n', full)` 追加换行触发行分割，逻辑正确但需注释
- **建议**：加注释 "Append newline to flush the last incomplete line"
- **优先级**：低
- **状态**：待优化

### 8. [NEW] toLocaleString zh-CN 跨环境一致性 — cronJobs.ts:113-120
- **问题**：Node.js 和浏览器对 zh-CN 的 toLocaleString 输出可能不同，当前纯前端无问题
- **建议**：留 TODO 注释，将来做 SSR 时注意
- **优先级**：低
- **状态**：待优化

---

## 修复记录

| 日期 | 问题编号 | 修复人 | 状态 |
|------|---------|--------|------|
| - | #1-8 | - | 待修复 |
