# Shell Hooks 自动追踪 PRD

**日期**: 2026-06-14
**状态**: ✅ 已完成

## 1. 功能描述

通过 Hermes Shell Hooks 机制，在员工 Agent 会话开始/结束时自动写入和清除活跃状态记录。无需员工 Agent 主动上报，系统级自动追踪。

## 2. 用户故事

- 作为系统管理员，我希望员工 Agent 启动会话时自动登记为"在线"，不需要手动操作
- 作为系统管理员，我希望员工 Agent 结束会话时自动清除在线状态
- 作为系统管理员，我希望崩溃/超时的会话在 2 小时后自动过期，避免僵尸状态
- 作为系统管理员，我希望通过 prompt 内容自动识别是哪个员工（包含员工名即匹配）

## 3. 验收标准

- [x] Shell Hook 脚本 `employee-hook.sh` 支持 `on_session_start` 和 `on_session_end` 事件
- [x] prompt 中包含员工名（"老财"/"铁壳"/"小K"/"404"/"裁判君"）即可自动识别
- [x] 活跃状态写入 `/tmp/employees-active.json`，格式 `{员工名: {task, startedAt}}`
- [x] 使用文件锁（flock）保证并发安全
- [x] TTL 清理：2 小时前的记录自动移除
- [x] 在 Hermes config.yaml 中正确注册 hooks

## 4. 技术约束

- **脚本路径**: `/root/hermes-chat/scripts/employee-hook.sh`
- **数据文件**: `/tmp/employees-active.json`
- **锁文件**: `/tmp/employees-active.lock`（flock）
- **TTL**: 7200 秒（2 小时）
- **识别方式**: prompt 包含匹配（`*"$name"*` 模式）
- **Hermes 配置**: `hooks.on_session_start` + `hooks.on_session_end`

## 5. 优先级

| 功能 | 优先级 | 原因 |
|------|--------|------|
| 会话开始追踪 | **P0** | 员工状态面板的数据来源 |
| 会话结束清理 | **P0** | 防止离线后仍显示在线 |
| TTL 过期清理 | **P1** | 防止僵尸记录 |
| 并发安全 | **P1** | 多员工同时启动时不丢数据 |
