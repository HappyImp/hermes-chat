# 文档清单

> 本项目所有文档索引，按类型分类

## 📝 需求文档 (docs/requirements/)

| 文档 | 日期 | 状态 | 说明 |
|------|------|------|------|
| [requirements/2026-06-14_admin-panel.md](requirements/2026-06-14_admin-panel.md) | 2026-06-14 | **待开发** | 后台管理面板（授权码+用户管理+审计日志） |
| [requirements/kanban-migration-plan.md](requirements/kanban-migration-plan.md) | 2026-06-15 | **Phase 2 审查中** | Kanban 迁移方案（PRD + 改动清单 + 验收标准） |
| [requirements/kanban-integration-research.md](requirements/kanban-integration-research.md) | 2026-06-15 | ✅ 已完成 | Kanban 集成可行性分析（架构对比 + 技术方案） |

## 📋 需求文档 (docs/prd/)

| 文档 | 日期 | 说明 |
|------|------|------|
| [prd/README.md](prd/README.md) | 2026-06-14 | PRD 索引 + 全局技术约束 |
| [prd/2026-06-14_basic-chat.md](prd/2026-06-14_basic-chat.md) | 2026-06-14 | F1 实时聊天 + F4 数据持久化 |
| [prd/2026-06-14_session-management.md](prd/2026-06-14_session-management.md) | 2026-06-14 | F2 会话管理 + F3 Channel + F5 导出 |
| [prd/2026-06-14_employee-status.md](prd/2026-06-14_employee-status.md) | 2026-06-14 | 员工状态面板功能 PRD |
| [prd/2026-06-14_shell-hooks.md](prd/2026-06-14_shell-hooks.md) | 2026-06-14 | Shell Hooks 自动追踪 PRD |
| [prd/2026-06-14_pixel-office.md](prd/2026-06-14_pixel-office.md) | 2026-06-14 | 像素风办公室 PRD |
| [prd/2026-06-14_employee-async-task.md](prd/2026-06-14_employee-async-task.md) | 2026-06-14 | F6 员工异步任务 PRD |
| [prd/2026-06-14_rust-backend-account-system.md](prd/2026-06-14_rust-backend-account-system.md) | 2026-06-14 | Rust 后端 + 账户系统 PRD |
| [prd/2026-06-14_auth-logout.md](prd/2026-06-14_auth-logout.md) | 2026-06-14 | 登出功能 (Token 黑名单) PRD |
| [prd/2026-06-15_websocket-realtime-update.md](prd/2026-06-15_websocket-realtime-update.md) | 2026-06-15 | KAN-304 WebSocket 实时更新 PRD |

## 🏗️ 设计拆解 (docs/design/)

| 文档 | 日期 | 说明 |
|------|------|------|
| [design/README.md](design/README.md) | 2026-06-14 | 初版设计拆解（组件树 + 状态 + 数据流） |
| [design/2026-06-14_employee-status-design.md](design/2026-06-14_employee-status-design.md) | 2026-06-14 | 员工状态面板设计 |
| [design/2026-06-14_pixel-office-design.md](design/2026-06-14_pixel-office-design.md) | 2026-06-14 | 像素风办公室设计 |
| [design/2026-06-14_employee-async-task-design.md](design/2026-06-14_employee-async-task-design.md) | 2026-06-14 | F6 员工异步任务设计 |
| [design/2026-06-14_rust-backend-account-system.md](design/2026-06-14_rust-backend-account-system.md) | 2026-06-14 | Rust 后端 + 账户系统技术设计 |
| [design/2026-06-14_auth-login-register-design.md](design/2026-06-14_auth-login-register-design.md) | 2026-06-14 | 登录/注册功能设计 |
| [design/2026-06-14_auth-logout-design.md](design/2026-06-14_auth-logout-design.md) | 2026-06-14 | 登出功能 (Token 黑名单) 设计 |
| [design/2026-06-15_websocket-realtime-update.md](design/2026-06-15_websocket-realtime-update.md) | 2026-06-15 | KAN-304 WebSocket 实时更新设计 |

## 🧠 架构文档 (docs/architecture/)

| 文档 | 日期 | 说明 |
|------|------|------|
| [architecture/README.md](architecture/README.md) | 2026-06-14 | 系统架构文档 |

## ⚙️ 后端文档 (backend/docs/)

| 文档 | 日期 | 说明 |
|------|------|------|
| [backend/docs/README.md](../backend/docs/README.md) | 2026-06-14 | 后端文档清单索引 |
| [backend/docs/prd/2026-06-14_rust-backend.md](../backend/docs/prd/2026-06-14_rust-backend.md) | 2026-06-14 | 后端功能 PRD（账户/会话/权限/SSE代理） |
| [backend/docs/design/2026-06-14_rust-backend-impl.md](../backend/docs/design/2026-06-14_rust-backend-impl.md) | 2026-06-14 | 后端实现设计（技术栈/schema/认证/安全） |
| [backend/docs/backlog/2026-06-14_review-backlog.md](../backend/docs/backlog/2026-06-14_review-backlog.md) | 2026-06-14 | 后端审查记录（2🔴+12🟡，已全部修复） |

## 🧪 测试文档 (docs/test/)

| 文档 | 日期 | 说明 |
|------|------|------|
| [test/README.md](test/README.md) | 2026-06-14 | 测试策略 + 目录结构 |
|| [test/2026-06-14_test-report.md](test/2026-06-14_test-report.md) | 2026-06-14 | 测试报告（33 文件 / 265 测试全部通过） |
|| [test/2026-06-15_test-report.md](test/2026-06-15_test-report.md) | 2026-06-15 | 测试报告（33 文件 / 271 测试全部通过） |
| [test/2026-06-15_backend-kanban-test-report.md](test/2026-06-15_backend-kanban-test-report.md) | 2026-06-15 | 后端 Kanban 模块测试报告（33 个测试全部通过） |

## 🧩 组件文档 (docs/components/)

| 文档 | 日期 | 说明 |
|------|------|------|
| [components/README.md](components/README.md) | 2026-06-14 | 组件清单（含 TaskCard + PixelOffice） |

## 📊 规划文档 (docs/planning/)

| 文档 | 日期 | 说明 |
|------|------|------|
| [planning/product-roadmap-2026-06-15.md](planning/product-roadmap-2026-06-15.md) | 2026-06-15 | 产品规划报告（10轮深度探索） |

## 📌 待优化清单 (docs/backlog/)

| 文档 | 日期 | 说明 |
|------|------|------|
| [backlog/2026-06-14_review-backlog.md](backlog/2026-06-14_review-backlog.md) | 2026-06-14 | 首次审查 9 个优化项 |
| [backlog/2026-06-14_employee-status-review.md](backlog/2026-06-14_employee-status-review.md) | 2026-06-14 | 员工状态面板审查待优化清单 |
| [backlog/2026-06-14_46952be-review-backlog.md](backlog/2026-06-14_46952be-review-backlog.md) | 2026-06-14 | SSE+状态修复审查待优化清单（8 项） |
| [backlog/2026-06-14_35f6fe4-review-backlog.md](backlog/2026-06-14_35f6fe4-review-backlog.md) | 2026-06-14 | 员工状态动态列表审查（2🔴+2🟡） |
|| [backlog/2026-06-14_taskstatus-polling-fix.md](backlog/2026-06-14_taskstatus-polling-fix.md) | 2026-06-14 | TaskStatus 轮询修复（1🔴+5🟡） |
|| [backlog/2026-06-14_auth-login-register-review.md](backlog/2026-06-14_auth-login-register-review.md) | 2026-06-14 | 登录/注册功能审查（1🟡+2🟢） |
|| [backlog/2026-06-14_auth-logout-review.md](backlog/2026-06-14_auth-logout-review.md) | 2026-06-14 | 登出功能审查（6🟡+3🟢） |
|| [backlog/2026-06-15_bug-fixes.md](backlog/2026-06-15_bug-fixes.md) | 2026-06-15 | 两个前端 bug 修复（员工列表刷新 + 发送按钮置灰） |
| [backlog/2026-06-15_kanban-backend-review.md](backlog/2026-06-15_kanban-backend-review.md) | 2026-06-15 | Kanban 后端适配层审查（3🔴+3🟡+2🟢） |
| [backlog/2026-06-15_phase2-p0-review.md](backlog/2026-06-15_phase2-p0-review.md) | 2026-06-15 | Phase 2 P0 审查 — KAN-205/207/208（1🔴+3🟡+3🟢） |
| [backlog/2026-06-15_phase2-p1-review.md](backlog/2026-06-15_phase2-p1-review.md) | 2026-06-15 | Phase 2 P1 审查 — KAN-203/204/206（4🔴+4🟡+3🟢） |
| [backlog/2026-06-15_phase2-p1-review-v2.md](backlog/2026-06-15_phase2-p1-review-v2.md) | 2026-06-15 | Phase 2 P1 复审 — 4🔴已修复，剩余 1🟡安全+3🟡文档 |
| [backlog/2026-06-15_phase3-p0-review.md](backlog/2026-06-15_phase3-p0-review.md) | 2026-06-15 | Phase 3 P0 审查 — KAN-301/302/303（5🟡+3🟢） |