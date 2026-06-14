# 员工状态面板审查待优化清单

> 来源：裁判君二次审查（2026-06-14）
> 提交：87a23f6 feat(status): replace CLI bridge with live Hermes API proxy
> 代码质量：⭐⭐⭐⭐☆ (4/5)
> 审查结论：✅ 可通过（无严重问题）

## 🟡 中等问题（建议修复）

### 1. [NEW] deriveEmployeeStatus() 函数过长 — cronJobs.ts:60-109
- **问题**：函数 49 行，含 3 个独立 for 循环，超 20 行限制 2.5x
- **职责**：判断 working → 判断 standby → 找下一任务
- **建议**：拆分为三个小函数：
  - `findWorkingJob(jobs, now)` → CronJob | null
  - `findStandbyJob(jobs, now)` → CronJob | null
  - `findNextJob(jobs)` → CronJob | null
  - `deriveEmployeeStatus` 仅做组合判断，控制在 15 行内
- **优先级**：中

### 2. [NEW] mapJobNameToEmployee() 硬编码映射 — cronJobs.ts:44-49
- **问题**：员工名称直接写在 if-else 链中，新增/改名员工需改代码重发
- **建议**：抽取为配置对象：
  ```typescript
  const EMPLOYEE_PATTERNS: Record<string, string[]> = {
    '老财': ['老财'], '铁壳': ['铁壳'], '小K': ['小K', '早报'], '404': ['404'],
  };
  ```
  函数遍历配置，一行搞定
- **优先级**：中

### 3. 双重类型断言绕过类型安全 — useEmployeeStatus.ts:7
- **问题**：`as unknown as Employee[]` 双重类型断言跳过编译期检查
- **风险**：JSON 数据结构变更时不会在编译期捕获错误
- **建议**：添加运行时类型校验函数，或添加注释说明断言原因
- **优先级**：中
- **状态**：✅ 已修复（2026-06-14 by 404）— 添加运行时类型校验

### 4. [NEW] API 返回空数组时行为与注释不一致 — useEmployeeStatus.ts:52
- **问题**：注释写 "If API returns empty, keep current state (fallback to defaults)"，
  但 fetchCronJobs 返回 [] 是正常路径（API 可用但无 job），此时应更新 UI 显示全员 off。
  当前实现跳过更新，让 UI 显示过期的默认状态。
- **建议**：区分三种情况：
  - `jobs.length > 0` → merge with defaults
  - fetch 成功但 jobs 为空 → 全员 'off'
  - catch → 保持当前状态（真正的 fallback）
- **优先级**：中

### ~~5. 刷新逻辑为无操作 — useEmployeeStatus.ts:13~~ ✅ 已修复
- **问题**：`refresh()` 每次设置同一模块级引用，60 秒定时器实际无效
- **修复**：hook 已重写，调用 `fetchCronJobs()` 获取实时数据
- **状态**：2026-06-14 已修复

## 🟢 轻微问题（可选优化）

### 6. [NEW] fetchCronJobs() 未带 Authorization header — cronJobs.ts:29-31
- **问题**：客户端 fetch 请求没传 auth header，依赖 proxy 层注入
- **说明**：开发模式靠 Vite proxy headers，生产靠 Nginx proxy_set_header
- **建议**：加注释说明认证由 proxy 层处理，避免后续维护者困惑

### 7. [NEW] 测试未验证状态映射结果 — useEmployeeStatus.test.ts:107-123
- **问题**："maps API jobs to employee status" 测试只验证 employees.length === 5，
  没验证 status/currentTask 字段是否正确映射
- **建议**：补充断言 `expect(result.current.employees[0].status).toBe('working')`

### 8. [NEW] FIVE_MIN/THIRTY_MIN 常量位置 — cronJobs.ts:64-65
- **问题**：每次调用 deriveEmployeeStatus 都重新创建常量
- **建议**：提到文件顶部 const 声明

### 9. 冗余 useCallback 包装 — EmployeeStatus.tsx:51-53
- **问题**：`handleRefresh` 只是调用 `refresh()`，额外包装无收益
- **建议**：直接在 `onClick` 中传 `refresh`
- **状态**：✅ 已修复（2026-06-14 by 404）

### 10. tasks.map key 潜在冲突 — EmployeeStatus.tsx:36
- **问题**：用 `task` 字符串做 key，同名任务会冲突
- **建议**：`key={`${emp.name}-${task}`}`
- **状态**：✅ 已修复（2026-06-14 by 404）

### 11. 测试未覆盖空列表边界 — EmployeeStatus.test.tsx
- **问题**：未测试 0 人场景
- **建议**：补充空列表测试
- **状态**：✅ 已修复（2026-06-14 by 404）

### 12. 文档遗漏 lastUpdated 显示 — docs/components/README.md:91
- **问题**：未说明顶部统计栏显示最后更新时间
- **建议**：补充到特性列表
- **状态**：✅ 已修复（2026-06-14 by 404）

---

## 修复记录

| 日期 | 问题编号 | 修复人 | 状态 |
|------|---------|--------|------|
| 2026-06-14 | #5 | 404 | ✅ 已修复 |
| 2026-06-14 | #3, #9-12 | 404 | ✅ 已修复 |
| - | #1-2, #4, #6-8 | - | 待修复 |
| 2026-06-14 | Shell Hooks | 404 | ✅ 已实现 |
