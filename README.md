# Hermes Chat

React 重构版 Hermes Chat，支持会话历史管理。

## 技术栈

- React 18 + TypeScript
- Vite
- TailwindCSS
- Zustand 状态管理

## 项目清单

| 项目 | 路径 | 仓库 | 状态 | 部署地址 |
|------|------|------|------|----------|
| Hermes Chat | /root/hermes-chat | [GitHub](https://github.com/HappyImp/hermes-chat) | ✅ 已部署 | http://43.249.192.131:7960/chat/ |

## 开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

## 部署

构建产物部署到 Nginx `/chat/` 路径。

## API 端点

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录，返回 JWT |
| POST | `/api/auth/logout` | 登出（Token 加入黑名单） |

### 会话

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sessions` | 获取会话列表 |
| POST | `/api/sessions` | 创建会话 |
| DELETE | `/api/sessions/:id` | 删除会话 |

### 聊天

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/v1/chat/completions` | 聊天补全（SSE 流式） |

### Kanban 看板

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/kanban/tasks` | 任务列表（按 tenant 隔离） |
| GET | `/api/kanban/tasks/:id` | 任务详情（含 comments + events） |
| GET | `/api/kanban/stats` | 看板统计（todo/doing/done） |
| GET | `/api/kanban/employees` | 员工列表（按 tenant 权限过滤） |
| WS | `/api/kanban/events?token=<JWT>&tenant=<id>` | WebSocket 实时事件 |

### 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/users` | 用户列表（管理员） |
| DELETE | `/api/admin/users/:id` | 删除用户（管理员） |
| GET | `/api/admin/audit-logs` | 审计日志（管理员） |

## 文档规范

文档统一放在 `docs/` 目录下，结构如下：

```
hermes-chat/
├── README.md
├── docs/
│   ├── README.md      # 文档清单索引（必须有，列出所有文档）
│   ├── prd/           # 需求文档
│   ├── design/        # 拆解文档
│   ├── architecture/  # 逻辑文档
│   ├── test/          # 测试报告
│   ├── components/    # 组件文档
│   └── backlog/       # 待优化清单（审查问题记录）
└── src/
```

- `docs/README.md` 是文档清单索引，必须维护
- 文件命名规范：`YYYY-MM-DD_short-description.md`
- `backlog/` 存放审查问题的待优化清单
