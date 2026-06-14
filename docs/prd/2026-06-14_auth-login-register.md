# PRD: 登录/注册功能

## 背景
hermes-chat 后端已有完整的 JWT 认证系统（register/login），前端需要对接实现用户认证流程。

## 需求
1. 未登录时显示登录/注册页面
2. 登录成功后 token 存 localStorage
3. 所有 API 请求自动携带 Authorization: Bearer *** 未登录时自动跳转登录页
5. 登录后进入聊天界面（保持现有功能不变）
6. 侧边栏增加登出按钮

## API 端点
- POST /chat/api/auth/register — { username, password } → 201
- POST /chat/api/auth/login — { username, password } → 200 + { token }

## 验收标准
- [ ] 未登录显示登录页
- [ ] 注册成功自动登录
- [ ] 登录后 token 持久化
- [ ] 聊天请求携带 token
- [ ] 401 时自动登出
- [ ] 登出按钮可用
- [ ] npm test 全部通过
- [ ] npm run build 成功