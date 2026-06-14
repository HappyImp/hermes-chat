# 设计: 登录/注册功能

## 架构
```
src/
├── api/auth.ts              # 认证 API
├── store/authStore.ts       # Zustand auth store (persist)
├── components/Auth/
│   └── LoginPage.tsx        # 登录/注册组件
└── hooks/useAuth.ts         # auth hook (复用 store)
```

## 数据流
1. LoginPage → api/auth.ts (login/register) → token
2. token → authStore (zustand + persist → localStorage)
3. App.tsx 读 authStore.isAuthenticated → 渲染 LoginPage 或 App
4. useChat.ts fetch 时从 authStore 读 token → Authorization header
5. 401 → authStore.logout() → 跳转登录页

## 设计决策
- Zustand persist 存 token，与现有 sessionStore 模式一致
- 登录/注册同一组件，tab 切换
- 不引入 react-router，用条件渲染（SPA 内部页面）