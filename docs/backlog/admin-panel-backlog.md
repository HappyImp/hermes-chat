# 后台管理面板 — Backlog

## 已完成 ✅

- [x] invitation_codes 表 + 迁移文件
- [x] audit_logs 表 + 迁移文件
- [x] users 表增加 enabled 字段
- [x] 预置管理员账号 13459730010
- [x] 授权码生成 API（HC-XXXX-XXXX 格式）
- [x] 授权码列表/禁用/删除 API
- [x] 注册流程改造（增加 invitation_code 验证）
- [x] 注册时权限继承（授权码→用户）
- [x] 用户列表/搜索/详情 API
- [x] 修改用户权限 API
- [x] 禁用/启用用户 API
- [x] 删除用户 API（级联清理）
- [x] 仪表盘统计 API
- [x] 审计日志记录
- [x] AdminUser 中间件校验
- [x] auth_middleware 检查用户 enabled 状态
- [x] Vue3 后台前端（登录/仪表盘/授权码/用户管理）
- [x] 前端构建通过

## 待验证 🔍

- [ ] cargo check 0 error 0 warning
- [ ] 前端 npm test 通过
- [ ] 管理员登录流程端到端测试
- [ ] 授权码全流程测试（生成→注册→权限继承）
- [ ] 用户禁用后 token 失效测试
- [ ] 删除用户级联清理验证

## 后续优化 💡

- [ ] 审计日志查询页面
- [ ] 授权码批量导出
- [ ] 用户数据导出 CSV
- [ ] 操作确认弹窗统一化
- [ ] 前端单元测试
