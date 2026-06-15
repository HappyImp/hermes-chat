# 测试报告 — 2026-06-15

## 概要

| 指标 | 数值 |
|------|------|
| 测试文件 | 33 passed |
| 测试用例 | 271 passed |
| 失败 | 0 |
| 耗时 | ~7s |

## 本次新增测试（5 个）

### useEmployeeStatus（3 个）
1. `visibilitychange` 到 visible 时触发 refresh
2. `window focus` 事件触发 refresh
3. `visibilitychange` 到 hidden 时不触发 refresh

### sessionStore（2 个）
4. `isStreaming` 不写入 localStorage（partialize 验证）
5. 旧 localStorage 中残留 `isStreaming: true` 在 rehydrate 后被强制置为 false（merge 验证）
