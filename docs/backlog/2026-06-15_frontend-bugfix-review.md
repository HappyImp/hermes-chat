# 2026-06-15 前端 Bugfix 审查报告

**审查人**：裁判君  
**审查日期**：2026-06-15  
**审查范围**：useEmployeeStatus.ts + sessionStore.ts + LoginPage.tsx  

---

## 🟡 中等问题

### 1. LoginPage.tsx 邀请码字段混入 bugfix

**文件**：`src/components/Auth/LoginPage.tsx`  
**问题**：邀请码字段改动不在本次 bugfix 范围内，应该单独 commit  
**建议**：保持 bugfix 职责单一，邀请码功能单独提交  
**优先级**：中  
**状态**：⬜ 待修复  

### 2. focus 事件触发过于频繁

**文件**：`src/hooks/useEmployeeStatus.ts:189`  
**问题**：focus 事件每次获焦都触发 refresh()，快速切换窗口时可能频繁请求  
**建议**：添加 debounce（如 1000ms）或 throttle  
**优先级**：中  
**状态**：⬜ 待修复  

---

## 🟢 轻微问题

### 1. sessionStore merge 函数类型断言

**文件**：`src/store/sessionStore.ts:183`  
**问题**：`as Partial<SessionStore>` 类型断言，zustand persist 类型定义可能需要更新  
**建议**：优化类型定义减少断言  
**优先级**：低  
**状态**：⬜ 可选优化  

---

## 修复记录

| 日期 | 问题 | 修复人 | 修复内容 |
|------|------|--------|----------|
| - | - | - | - |
