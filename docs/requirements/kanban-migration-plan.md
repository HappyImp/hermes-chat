# Hermes Chat Kanban 迁移方案

> 版本：v1.0  
> 日期：2026-06-15  
> 作者：管家（AI调度）  
> 状态：📋 待审批  
> 前置文档：[kanban-integration-research.md](./kanban-integration-research.md)

---

## 一、需求列表（PRD）

### Phase 1：基础设施准备

| ID | 标题 | 描述 | 优先级 |
|----|------|------|--------|
| KAN-101 | 创建 hermes-chat kanban board | 使用 `hermes kanban board create` 创建专用看板 | P0 |
| KAN-102 | 配置员工 profiles | 为每个员工（老财/铁壳/小K/404/裁判君/Ditto）创建独立 profile，配置 SOUL.md | P0 |
| KAN-103 | 启动 profile gateways | 每个 profile 需独立 gateway 实例，配置独立 API key | P0 |
| KAN-104 | 验证 kanban dispatch | 测试 `hermes kanban create + dispatch` 流程，确认任务可正常执行 | P0 |
| KAN-105 | 建立 tenant 映射表 | 创建 user_tenants 表，建立 user_id → tenant_id 映射关系 | P1 |

### Phase 2：后端适配层

| ID | 标题 | 描述 | 优先级 |
|----|------|------|--------|
| KAN-201 | 新增 kanban handler 模块 | 创建 `handlers/kanban.rs`，实现 kanban API 代理 | P0 |
| KAN-202 | 实现任务列表接口 | `GET /api/kanban/tasks` — 代理 `hermes kanban list --tenant <user_id> --json` | P0 |
| KAN-203 | 实现任务详情接口 | `GET /api/kanban/tasks/:id` — 代理 `hermes kanban show <task_id> --json` | P1 |
| KAN-204 | 实现看板统计接口 | `GET /api/kanban/stats` — 代理 `hermes kanban stats --json` | P1 |
| KAN-205 | 实现员工列表接口 | `GET /api/kanban/employees` — 从 kanban profiles + assignees 推导员工列表 | P0 |
| KAN-206 | 实现 WebSocket 事件代理 | `WS /api/kanban/events` — 代理 kanban dashboard 的实时事件流 | P1 |
| KAN-207 | 扩展权限模型 | 修改 `models/permission.rs`，支持 tenant 映射 | P0 |
| KAN-208 | 实现 tenant 权限过滤 | 后端强制注入 tenant，不信任前端参数 | P0 |

### Phase 3：前端迁移

| ID | 标题 | 描述 | 优先级 |
|----|------|------|--------|
| KAN-301 | 新增 kanban API 模块 | 创建 `src/api/kanban.ts`，封装 kanban REST + WebSocket 接口 | P0 |
| KAN-302 | 扩展 Employee 类型 | 修改 `types/employee.ts`，支持 kanban 任务状态映射 | P0 |
| KAN-303 | 改造 useEmployeeStatus hook | 从 kanban API 获取状态，替代 cron jobs + active.json | P0 |
| KAN-304 | 实现 WebSocket 实时更新 | 替代 60s 轮询，实现事件驱动的状态更新 | P1 |
| KAN-305 | 更新 EmployeeStatus 组件 | 显示 kanban 任务详情，支持任务状态颜色映射 | P1 |
| KAN-306 | 更新 EmployeeCard 组件 | 展示当前任务标题、状态、进度 | P1 |

### Phase 4：切换与清理

| ID | 标题 | 描述 | 优先级 |
|----|------|------|--------|
| KAN-401 | 并行运行验证 | flow-gate 与 kanban 并行运行 1 周，验证数据一致性 | P0 |
| KAN-402 | 废弃 flow-gate plugin | 停用 flow-gate-plugin，移除相关配置 | P1 |
| KAN-403 | 清理旧代码 | 移除 `api/cronJobs.ts`、`EMPLOYEE_META` 硬编码、active.json 逻辑 | P1 |
| KAN-404 | 更新管理后台 | admin 权限管理改为 tenant 映射方式 | P2 |

---

## 二、改动点清单

### 2.1 后端文件（Rust/Axum）

| 文件 | 改动内容 | 改动量 |
|------|---------|--------|
| `backend/src/handlers/kanban.rs` | **新增** — kanban API 代理层，包含 list/get/stats/employees/events | L |
| `backend/src/handlers/mod.rs` | 添加 `pub mod kanban;` 声明 | S |
| `backend/src/main.rs` | 注册 `/api/kanban/*` 路由 | S |
| `backend/src/models/permission.rs` | 扩展 Permission 结构体，新增 tenant 相关字段 | M |
| `backend/src/models/mod.rs` | 添加 `pub mod kanban;` 声明（如新增 kanban 模型） | S |
| `backend/src/models/kanban.rs` | **新增** — KanbanTask、KanbanEvent 等数据结构 | M |
| `backend/src/services/employee.rs` | 改造 `list_allowed` 方法，支持从 kanban 读取员工列表 | M |
| `backend/src/services/kanban.rs` | **新增** — kanban CLI 调用封装（`hermes kanban` 命令） | L |
| `backend/src/services/mod.rs` | 添加 `pub mod kanban;` 声明 | S |
| `backend/src/db/pool.rs` | 确保 kanban.db 可被后端访问（可能需要多 DB 连接池） | M |
| `backend/Cargo.toml` | 添加 WebSocket 相关依赖（如 tokio-tungstenite） | S |

### 2.2 前端文件（React/TypeScript）

| 文件 | 改动内容 | 改动量 |
|------|---------|--------|
| `src/api/kanban.ts` | **新增** — kanban REST API + WebSocket 封装 | L |
| `src/types/employee.ts` | 扩展 Employee 接口，新增 kanban 任务状态类型 | S |
| `src/types/kanban.ts` | **新增** — KanbanTask、KanbanEvent 类型定义 | M |
| `src/hooks/useEmployeeStatus.ts` | 重写 — 从 kanban API 获取数据，移除 cronJobs 依赖 | L |
| `src/hooks/useKanbanEvents.ts` | **新增** — WebSocket 事件订阅 hook | M |
| `src/components/Sidebar/EmployeeStatus.tsx` | 更新员工卡片展示，支持 kanban 任务详情 | M |
| `src/data/employees.json` | 废弃 — 数据源改为 kanban profiles | S |
| `src/api/cronJobs.ts` | 废弃 — 保留但标记 deprecated，Phase 4 清理 | S |

### 2.3 基础设施

| 文件/配置 | 改动内容 | 改动量 |
|-----------|---------|--------|
| `~/.hermes/plugins/flow-gate-plugin/` | 逐步废弃，过渡期保留 | S |
| `~/.hermes/profiles/` | 为每个员工创建独立 profile 目录 | M |
| `hermes-chat kanban board` | 创建专用看板，配置列（todo/doing/done） | S |
| Nginx 配置 | 添加 WebSocket 代理规则（`/api/kanban/events`） | S |

---

## 三、注意事项

### 3.1 迁移期间不能中断现有服务

**策略：双轨并行**

```
迁移期间：
┌─────────────────────────────────────────────────┐
│              Frontend                           │
│  ┌──────────────┐      ┌──────────────┐        │
│  │ useEmployee   │      │ useKanban    │        │
│  │ Status (旧)   │      │ Events (新)  │        │
│  └──────┬───────┘      └──────┬───────┘        │
│         │                      │                │
│         └──────────┬───────────┘                │
│                    │                            │
│            Feature Flag 控制                    │
│            (VITE_USE_KANBAN=true)               │
└─────────────────────────────────────────────────┘

后端：
┌─────────────────────────────────────────────────┐
│  /api/employees/*  →  旧逻辑（保留）            │
│  /api/kanban/*     →  新逻辑（新增）            │
│                                                   │
│  两套接口并行，前端通过 Feature Flag 切换       │
└─────────────────────────────────────────────────┘
```

**实施要点：**
- Phase 2 完成后，新增 `/api/kanban/*` 路由，不影响现有 `/api/employees/*`
- Phase 3 前端通过环境变量 `VITE_USE_KANBAN` 控制数据源
- Phase 4 验证通过后，才移除旧代码

### 3.2 权限隔离的安全考虑

**核心原则：后端强制注入 tenant，不信任前端参数**

```rust
// ❌ 错误：前端传什么 tenant 就用什么
async fn list_tasks(Query(params): Query<KanbanParams>) -> Json<Value> {
    let tenant = params.tenant; // 危险！用户可伪造
    // ...
}

// ✅ 正确：从 JWT 中提取 user_id，自动映射 tenant
async fn list_tasks(auth: AuthUser) -> Json<Value> {
    let tenant = get_tenant_for_user(&auth.user_id); // 后端查表
    // 调用 hermes kanban list --tenant <tenant>
}
```

**安全检查清单：**
- [ ] 所有 kanban API 必须经过 AuthUser 中间件
- [ ] tenant 从 user_tenants 表查询，不从前端参数获取
- [ ] WebSocket 连接需要携带 JWT token 验证
- [ ] 管理员接口需要 AdminUser 中间件
- [ ] 审计日志记录所有 kanban 操作

### 3.3 性能影响评估

| 维度 | 现有方案 | Kanban 方案 | 影响 |
|------|---------|------------|------|
| 员工列表查询 | 直接查 SQLite permissions 表 | 调用 `hermes kanban` CLI + 查 permissions 表 | ⚠️ 增加 CLI 调用开销 |
| 状态更新频率 | 60s 轮询 | WebSocket 实时推送 | ✅ 延迟从 60s 降到 <1s |
| 并发连接 | 无 WebSocket | 每用户 1 个 WebSocket 连接 | ⚠️ 需评估服务器承载 |
| 数据库压力 | 单 DB（hermes.db） | 双 DB（hermes.db + kanban.db） | ⚠️ SQLite WAL 模式已支持并发读 |

**优化建议：**
1. **缓存员工列表** — kanban profiles 变化不频繁，可缓存 5 分钟
2. **批量查询** — 一次 CLI 调用获取所有任务，避免 N+1 查询
3. **WebSocket 连接池** — 服务端复用 kanban dashboard 的事件流
4. **降级策略** — WebSocket 断开时自动降级为 30s 轮询

### 3.4 回滚方案

**回滚触发条件：**
- 员工状态显示异常（持续 5 分钟以上）
- WebSocket 连接失败率 > 50%
- 用户投诉任务状态不准确
- 性能指标异常（API 响应时间 > 2s）

**回滚步骤：**

```
Level 1：前端回滚（秒级）
  设置 VITE_USE_KANBAN=false，重新构建前端
  影响：仅前端，后端无需改动

Level 2：后端回滚（分钟级）
  注释 main.rs 中 kanban 路由注册
  重启后端服务
  影响：kanban API 不可用，但不影响现有功能

Level 3：完全回滚（小时级）
  停用 kanban profiles
  恢复 flow-gate plugin
  清理 user_tenants 表
  影响：完全恢复到迁移前状态
```

**回滚验证清单：**
- [ ] 员工列表正常显示
- [ ] 员工状态正确更新
- [ ] 现有 cron jobs 正常运行
- [ ] 用户权限隔离正常

---

## 四、验收标准

### Phase 1 验收条件

| 条件 | 验证方法 |
|------|---------|
| kanban board 创建成功 | `hermes kanban board list` 显示 hermes-chat board |
| 所有员工 profiles 可用 | `hermes profile list` 显示 6 个员工 profile |
| 每个 profile gateway 启动 | `hermes profile show <name>` 显示 gateway 状态 |
| kanban dispatch 正常 | 创建测试任务，验证 dispatch + complete 流程 |
| tenant 映射表可用 | `SELECT * FROM user_tenants` 返回正确映射 |

### Phase 2 验收条件

| 条件 | 验证方法 |
|------|---------|
| GET /api/kanban/tasks 返回数据 | curl 调用返回 JSON，包含任务列表 |
| GET /api/kanban/employees 返回员工 | 返回带状态的员工列表 |
| tenant 隔离生效 | 不同用户看到不同任务 |
| WebSocket 连接成功 | wscat 连接 `/api/kanban/events` 收到事件 |
| 权限校验通过 | 未登录访问返回 401 |

### Phase 3 验收条件

| 条件 | 验证方法 |
|------|---------|
| 员工状态正确显示 | 前端显示 working/standby/off 状态 |
| 实时更新生效 | 创建任务后，前端 1s 内更新状态 |
| 降级策略正常 | 断开 WebSocket，自动切换为轮询 |
| 现有功能不受影响 | 聊天、会话管理等功能正常 |

### Phase 4 验收条件

| 条件 | 验证方法 |
|------|---------|
| 并行运行 1 周无异常 | 监控日志无错误，用户无投诉 |
| 数据一致性验证 | 对比 flow-gate 和 kanban 状态，差异 < 1% |
| 旧代码清理完成 | grep 无 cronJobs、EMPLOYEE_META 引用 |
| 文档更新完成 | README、API 文档、架构图更新 |

### 测试用例要求

**单元测试：**
- `useEmployeeStatus` hook — mock kanban API，验证状态推导逻辑
- `useKanbanEvents` hook — mock WebSocket，验证事件处理
- 后端 kanban handler — mock CLI 调用，验证权限过滤

**集成测试：**
- 前端 → 后端 → kanban CLI 完整链路
- WebSocket 连接 → 事件推送 → 前端更新
- 多用户并发访问，验证 tenant 隔离

**E2E 测试：**
- 登录 → 查看员工列表 → 点击员工 → 查看任务详情
- 管理员 → 编辑权限 → 验证用户可见员工变化

---

## 五、时间估算

### 各阶段工作量

| 阶段 | 工作内容 | 工期 | 人力 |
|------|---------|------|------|
| Phase 1 | 基础设施准备 | 1-2 天 | 铁壳（运维） |
| Phase 2 | 后端适配层 | 2-3 天 | 404（开发） |
| Phase 3 | 前端迁移 | 2-3 天 | 404（开发） |
| Phase 4 | 并行运行 + 清理 | 1 周 | 全员观察 |
| **总计** | | **2-3 周** | |

### 详细排期

```
Week 1：
  Day 1-2：Phase 1 — 铁壳配置基础设施
  Day 3-5：Phase 2 — 404 开发后端适配层

Week 2：
  Day 1-3：Phase 3 — 404 开发前端迁移
  Day 4：裁判君代码审查
  Day 5：铁壳部署 + Ditto 测试

Week 3：
  Day 1-5：Phase 4 — 并行运行观察
  Day 5：废弃旧代码，发布最终版本
```

### 里程碑

| 里程碑 | 日期 | 交付物 |
|--------|------|--------|
| M1：基础设施就绪 | Week 1 Day 2 | kanban board + profiles + gateways |
| M2：后端 API 就绪 | Week 1 Day 5 | /api/kanban/* 接口 + 单元测试 |
| M3：前端迁移完成 | Week 2 Day 3 | Feature Flag 切换可用 |
| M4：代码审查通过 | Week 2 Day 4 | 裁判君审查报告 |
| M5：部署上线 | Week 2 Day 5 | 生产环境部署 |
| M6：迁移完成 | Week 3 Day 5 | 旧代码清理，文档更新 |

---

## 六、风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| Kanban CLI 性能瓶颈 | 中 | 高 | 批量查询 + 缓存策略 |
| WebSocket 连接不稳定 | 低 | 中 | 自动重连 + 轮询降级 |
| Profile gateway 崩溃 | 低 | 高 | health check + 自动重启 |
| 多用户并发冲突 | 低 | 中 | SQLite WAL 模式 + 后端锁 |
| 迁移期间功能异常 | 中 | 高 | Feature Flag + 快速回滚 |

---

## 附录

### A. 关键命令参考

```bash
# Kanban 操作
hermes kanban board create hermes-chat
hermes kanban list --tenant user_123 --json
hermes kanban create "任务标题" --assignee coder-404 --tenant user_123
hermes kanban dispatch
hermes kanban complete <task_id>

# Profile 管理
hermes profile list
hermes profile show coder-404
hermes profile describe coder-404

# 调试
hermes kanban tail <task_id>
hermes kanban stats --json
```

### B. 数据库迁移 SQL

```sql
-- 创建 tenant 映射表
CREATE TABLE IF NOT EXISTS user_tenants (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, tenant_id)
);

-- 迁移现有权限数据
INSERT INTO user_tenants (id, user_id, tenant_id)
SELECT 
    lower(hex(randomblob(16))),
    user_id,
    'default'  -- 默认 tenant
FROM permissions
WHERE allowed = 1
GROUP BY user_id;
```

### C. 环境变量配置

```bash
# .env
VITE_USE_KANBAN=false  # Feature Flag，Phase 4 设为 true
KANBAN_DB_PATH=~/.hermes/kanban.db
KANBOARD_WS_URL=ws://localhost:8642/api/plugins/kanban/events
```

---

> **下一步**：提交此方案到需求池（backlog），等待审批后开始 Phase 1。
