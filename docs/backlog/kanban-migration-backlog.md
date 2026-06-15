# Kanban 迁移 — Backlog

> 创建日期：2026-06-15  
> 方案文档：[kanban-migration-plan.md](../requirements/kanban-migration-plan.md)  
> 调研报告：[kanban-integration-research.md](../requirements/kanban-integration-research.md)

## 待开始 📋

### Phase 1：基础设施准备（1-2天）
- [ ] KAN-101：创建 hermes-chat kanban board
- [ ] KAN-102：配置员工 profiles（老财/铁壳/小K/404/裁判君/Ditto）
- [ ] KAN-103：启动 profile gateways
- [ ] KAN-104：验证 kanban dispatch 流程
- [ ] KAN-105：建立 tenant 映射表

### Phase 2：后端适配层（2-3天）
- [ ] KAN-201：新增 kanban handler 模块
- [ ] KAN-202：实现任务列表接口 GET /api/kanban/tasks
- [~] KAN-203：实现任务详情接口 GET /api/kanban/tasks/:id — 🔴 审查打回，见 backlog/2026-06-15_phase2-p1-review.md
- [~] KAN-204：实现看板统计接口 GET /api/kanban/stats — 🟡 审查通过（有建议）
- [~] KAN-205：实现员工列表接口 GET /api/kanban/employees
- [~] KAN-206：实现 WebSocket 事件代理 WS /api/kanban/events — 🔴 审查打回，见 backlog/2026-06-15_phase2-p1-review.md
- [ ] KAN-207：扩展权限模型（tenant 映射）
- [ ] KAN-208：实现 tenant 权限过滤

### Phase 3：前端迁移（2-3天）
- [ ] KAN-301：新增 kanban API 模块 src/api/kanban.ts
- [ ] KAN-302：扩展 Employee 类型（支持 kanban 状态）
- [ ] KAN-303：改造 useEmployeeStatus hook
- [ ] KAN-304：实现 WebSocket 实时更新
- [ ] KAN-305：更新 EmployeeStatus 组件
- [ ] KAN-306：更新 EmployeeCard 组件

### Phase 4：切换与清理（1周）
- [ ] KAN-401：并行运行验证（flow-gate + kanban）
- [ ] KAN-402：废弃 flow-gate plugin
- [ ] KAN-403：清理旧代码（cronJobs.ts、EMPLOYEE_META、active.json）
- [ ] KAN-404：更新管理后台（tenant 映射）

## 进行中 🔄

（暂无）

## 已完成 ✅

（暂无）

## 风险与依赖

| 依赖项 | 状态 | 说明 |
|--------|------|------|
| kanban 插件可用 | ✅ | 已安装并验证 |
| profile 系统可用 | ✅ | `hermes profile list` 正常 |
| WebSocket 支持 | ⚠️ | 需确认 Nginx 配置 |
| SQLite WAL 模式 | ✅ | 已启用 |

## 审批记录

| 日期 | 审批人 | 结论 | 备注 |
|------|--------|------|------|
| 2026-06-15 | 管家 | 提交 | 等待老板审批 |
