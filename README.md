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
