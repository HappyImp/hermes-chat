# Hermes Chat

> React 重构版 Hermes Chat — 支持会话历史、Channel 切换、侧边栏管理

## 技术栈

- **React 18** + **TypeScript**
- **Vite** 构建
- **TailwindCSS** 样式
- **Zustand** 状态管理
- **localStorage** 持久化

## 功能

- 💬 消息收发（SSE 流式响应）
- 📝 Markdown 渲染 + 代码高亮
- 📋 代码块一键复制
- 📥 导出对话为 Markdown
- 💾 会话历史持久化（localStorage）
- 📂 Channel 多会话管理
- 🔄 会话新建/切换/删除
- 📱 响应式布局（移动端适配）
- 🌙 深色主题

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 测试
npm test

# 覆盖率
npm run test:coverage

# Lint
npm run lint

# 格式化
npm run format
```

## 项目结构

```
src/
├── main.tsx                 # 入口
├── App.tsx                  # 根组件
├── components/              # UI 组件
│   ├── Sidebar/             # 侧边栏（Channel + Session 列表）
│   ├── Chat/                # 聊天区（消息 + 输入框）
│   ├── CodeBlock/           # 代码块渲染
│   └── Toast/               # 提示组件
├── hooks/                   # 自定义 hooks
│   ├── useChat.ts           # 聊天逻辑
│   ├── useSession.ts        # 会话管理
│   └── useToast.ts          # Toast 提示
├── store/                   # 状态管理
│   └── sessionStore.ts      # Zustand store
├── utils/                   # 工具函数
│   ├── markdown.ts          # Markdown 渲染
│   ├── storage.ts           # localStorage 封装
│   └── uuid.ts              # UUID 生成
├── types/                   # 类型定义
└── styles/                  # 样式
```

## API

使用 OpenAI 兼容的 Chat Completions API：

```
POST /chat/api/v1/chat/completions
Content-Type: application/json

{
  "model": "hermes-agent",
  "messages": [...],
  "stream": true
}
```

## 部署

构建输出部署到 `/var/www/chat/`，Nginx 5244 端口。

```bash
npm run build
cp -r dist/* /var/www/chat/
nginx -s reload
```

## License

MIT
