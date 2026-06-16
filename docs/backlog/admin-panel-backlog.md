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
- [x] KAN-404: admin 权限管理改为 tenant 映射方式
  - [x] 新增 `list_all_tenants()` / `get_user_tenants()` / `update_user_tenants()` 方法
  - [x] 新增 `GET /api/admin/tenants` 和 `PUT /api/admin/users/:id/tenants` 路由
  - [x] `list_users` 返回 `tenants` 替代 `allowed_employees`
  - [x] `get_user_detail` 返回 `tenants` 替代 `allowed_employees`
  - [x] 授权码支持 `allowed_tenants` 字段 + 008 迁移
  - [x] 注册流程继承 `allowed_tenants` 到 `user_tenants`
  - [x] 前端 Users.vue 权限弹窗改为 tenant 多选
  - [x] 前端 InvitationCodes.vue 支持 tenant 选择
  - [x] 前端 admin.ts 新增 `listTenants` / `updateUserTenants` API
  - [x] 测试新增 `listTenants` / `updateUserTenants` 用例

## 待验证 🔍

- [ ] cargo check 0 error 0 warning
- [ ] 前端 npm test 通过
- [ ] 管理员登录流程端到端测试
- [ ] 授权码全流程测试（生成→注册→tenant 继承）
- [ ] 用户禁用后 token 失效测试
- [ ] 删除用户级联清理验证
- [ ] tenant 映射 CRUD 测试

## 后续优化 💡

- [ ] 审计日志查询页面
- [ ] 授权码批量导出
- [ ] 用户数据导出 CSV
- [ ] 操作确认弹窗统一化
- [ ] 前端单元测试
- [ ] 多 tenant 管理页面（创建/删除 tenant）
