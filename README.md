# Hermes Chat

一个基于 React 的 AI 聊天客户端，支持多会话管理、会话历史、Markdown 渲染和代码高亮。

## 功能特性

- 🤖 **AI 聊天** - 通过 SSE 流式传输与 Hermes Agent 对话
- 💬 **多会话管理** - 每个 Channel 支持多个会话，随时切换
- 📁 **Channel 管理** - 创建/删除 Channel，分类管理会话
- 📝 **Markdown 渲染** - 支持代码高亮、表格、列表等
- 📥 **导出对话** - 将对话导出为 Markdown 文件
- 💾 **本地存储** - 会话历史自动保存到 localStorage
- 📱 **响应式设计** - 支持移动端和桌面端

## 技术栈

- **React 18** + TypeScript
- **Vite** 构建工具
- **TailwindCSS** 样式框架
- **Zustand** 状态管理
- **Vitest** + Testing Library 测试

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 运行测试
npm test

# 生成测试覆盖率报告
npm run test:coverage

# 代码检查
npm run lint

# 代码格式化
npm run format
```

## 项目结构

```
hermes-chat/
├── docs/                        # 文档
│   ├── prd/                     # 需求文档
│   ├── design/                  # 设计拆解
│   ├── architecture/            # 架构文档
│   ├── test/                    # 测试文档
│   └── components/              # 组件文档
├── src/
│   ├── components/              # React 组件
│   │   ├── Chat/                # 聊天区域组件
│   │   ├── Sidebar/             # 侧边栏组件
│   │   ├── CodeBlock/           # 代码块组件
│   │   └── Toast/               # 提示组件
│   ├── hooks/                   # 自定义 Hooks
│   ├── store/                   # 状态管理
│   ├── utils/                   # 工具函数
│   ├── types/                   # 类型定义
│   ├── styles/                  # 全局样式
│   └── test/                    # 测试配置
├── index.html                   # 入口 HTML
├── vite.config.ts               # Vite 配置
├── tailwind.config.js           # TailwindCSS 配置
├── vitest.config.ts             # Vitest 配置
└── tsconfig.json                # TypeScript 配置
```

## 架构设计

采用 **组件化 + 状态管理** 架构：

- **组件层**：纯 UI 组件，通过 Props 接收数据
- **Hooks 层**：封装业务逻辑，连接组件与状态
- **Store 层**：Zustand 全局状态管理，支持 localStorage 持久化
- **Utils 层**：纯函数工具库

## API 接口

聊天功能通过 SSE 流式调用 `/chat/api/v1/chat/completions` 接口：

```json
POST /chat/api/v1/chat/completions
{
  "model": "hermes-agent",
  "messages": [{"role": "user", "content": "你好"}],
  "stream": true
}
```

## 部署

构建后将 `dist/` 目录部署到 Nginx：

```bash
npm run build
cp -r dist/* /var/www/chat/
```

Nginx 配置监听 5244 端口。

## License

MIT
