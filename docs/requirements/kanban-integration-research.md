# Hermes Chat 接入 Kanban 系统可行性分析

> 调研日期：2026-06-15
> 调研人：管家（AI调度）
> 状态：✅ 可行，推荐分阶段迁移

---

## 一、概述

当前 hermes-chat 使用 **自定义 flow-gate plugin + delegate_task** 管理多员工协作。Hermes 内置的 kanban 系统（SQLite 持久化任务板）提供了更完善的任务管理能力。本报告分析迁移可行性并提出集成方案。

---

## 二、现有架构 vs Kanban 能力对比

### 2.1 前端员工管理功能

| 维度 | 当前方案 | Kanban 方案 | 兼容性 |
|------|---------|------------|--------|
| 员工列表 | 硬编码 `EMPLOYEE_META` + DB permissions 表 | `hermes profile list` + `kanban assignees` | ✅ 可替代 |
| 员工状态 | cron jobs 状态 + active.json shell hooks | kanban task status (running/ready/blocked/done) | ✅ 更精确 |
| 员工技能 | `tasks[]` 字段（静态） | profile description + kanban skills 字段 | ✅ 可映射 |
| 员工元数据 | `employees.json` 硬编码 | profile describe + SOUL.md | ✅ 可迁移 |

**结论：kanban profiles 可以完全替代现有员工数据源。**

#### 数据映射方案

```
现有 Employee 接口:
{
  name: string        ← profile name (e.g. "coder-404")
  role: string        ← profile description (e.g. "全栈码农")
  avatar: string      ← EMPLOYEE_META 保留或迁移到 profile metadata
  status: string      ← 从 kanban 任务状态推导
  currentTask: string ← 当前 running 任务的 title
  tasks: string[]     ← 员工名下的任务列表
}
```

#### 状态推导逻辑

```typescript
// 从 kanban 任务推导员工状态
function deriveStatusFromKanban(tasks: KanbanTask[]): Employee['status'] {
  if (tasks.some(t => t.status === 'running')) return 'working';
  if (tasks.some(t => t.status === 'ready')) return 'standby';
  return 'off';
}
```

### 2.2 员工动态功能

| 维度 | 当前方案 | Kanban 方案 | 兼容性 |
|------|---------|------------|--------|
| 任务状态 | cron job state + active.json | task_events 表 + WebSocket 实时推送 | ✅ 更强 |
| 执行进度 | PID 存活检查 + 手动状态文件 | task_runs 表 + heartbeat 机制 | ✅ 原生支持 |
| 完成情况 | 手动标记 | complete 命令 + result 字段 | ✅ 原生支持 |
| 实时同步 | 轮询 active.json (60s) | WebSocket `/events` 端点 | ✅ 实时性更强 |

**结论：kanban 的实时事件流远优于现有轮询方案。**

#### Kanban 实时事件流

Kanban dashboard 插件提供 WebSocket 端点：
```
ws://<host>/api/plugins/kanban/events?since=<event_id>&board=<slug>
```

事件类型包括：
- `created` — 任务创建
- `claimed` — 任务被认领
- `spawned` — worker 进程启动
- `heartbeat` — worker 存活信号
- `completed` — 任务完成
- `blocked` — 任务阻塞
- `crashed` — worker 崩溃
- `gave_up` — 超过重试上限

### 2.3 权限管理

| 维度 | 当前方案 | Kanban 方案 | 兼容性 |
|------|---------|------------|--------|
| 用户-员工权限 | permissions 表 (user_id, employee, allowed) | tenant 字段 | ⚠️ 需适配 |
| 多租户隔离 | 后端 API 层过滤 | `--tenant` 参数过滤 | ✅ 原生支持 |
| 管理后台 | admin CRUD 权限 | 需新增管理接口 | ⚠️ 需开发 |

**结论：kanban 的 tenant 机制可以实现多租户隔离，但需要适配层。**

#### 权限隔离方案

**方案 A：tenant = user_id（推荐）**
```
每个用户的任务打上 tenant=<user_id> 标签
hermes kanban create "任务" --tenant user_123 --assignee coder-404
hermes kanban list --tenant user_123
```

**方案 B：tenant = 用户组**
```
按用户组划分 tenant（如 "free" / "pro" / "enterprise"）
不同组可访问不同员工集合
```

**推荐方案 A**，因为：
1. 现有 `permissions` 表已经是 user_id 粒度
2. kanban `--tenant` 天然支持此粒度
3. 前端只需在 API 调用时传入 tenant 参数

---

## 三、需要改造的模块

### 3.1 后端改造（Rust/Axum）

| 模块 | 改造内容 | 工作量 |
|------|---------|--------|
| `employee_service.rs` | 从 kanban DB 读取员工列表，替代硬编码 | 小 |
| `handlers/employee.rs` | 新增 kanban 任务状态查询接口 | 中 |
| `handlers/admin.rs` | 权限管理改为 tenant 映射 | 中 |
| 新增 `handlers/kanban.rs` | 代理 kanban API，添加权限校验 | 中 |
| `models/permission.rs` | 扩展支持 tenant 映射 | 小 |

### 3.2 前端改造（React/TypeScript）

| 模块 | 改造内容 | 工作量 |
|------|---------|--------|
| `useEmployeeStatus.ts` | 从 kanban API 获取状态，替代 cron jobs | 中 |
| `api/cronJobs.ts` | 替换为 kanban API 调用 | 中 |
| `types/employee.ts` | 扩展状态类型支持 kanban 状态 | 小 |
| 新增 `api/kanban.ts` | 封装 kanban API + WebSocket | 中 |
| `EmployeeStatus.tsx` | 显示 kanban 任务详情 | 小 |

### 3.3 基础设施

| 模块 | 改造内容 | 工作量 |
|------|---------|--------|
| Kanban DB | 确保 kanban.db 可被后端访问 | 小 |
| Gateway | 每个 profile 需独立 gateway | 中 |
| API Key | 每个 profile 需配置独立 API key | 小 |
| Flow-gate | 逐步废弃，过渡期共存 | 小 |

---

## 四、技术集成方案

### 4.1 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ EmployeeList  │  │ TaskBoard    │  │ TaskDetail   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │           │
│         └────────────┬────┴─────────────────┘           │
│                      │                                  │
│              ┌───────▼────────┐                         │
│              │  kanban API    │                         │
│              │  (WebSocket)   │                         │
│              └───────┬────────┘                         │
└──────────────────────┼──────────────────────────────────┘
                       │
┌──────────────────────┼──────────────────────────────────┐
│              Backend (Rust/Axum)                         │
│              ┌───────▼────────┐                         │
│              │ /api/kanban/*  │ ← 新增代理层            │
│              │ (权限校验+tenant) │                       │
│              └───────┬────────┘                         │
│                      │                                  │
│         ┌────────────┼────────────┐                     │
│         │            │            │                     │
│  ┌──────▼──────┐ ┌───▼────┐ ┌────▼─────┐              │
│  │ permissions │ │ kanban │ │ hermes   │              │
│  │    表       │ │   DB   │ │ gateway  │              │
│  └─────────────┘ └────────┘ └──────────┘              │
└─────────────────────────────────────────────────────────┘
```

### 4.2 API 设计

#### 新增后端 API

```rust
// GET /api/kanban/tasks
// 获取当前用户的 kanban 任务列表
// 自动注入 tenant=<user_id> 过滤
async fn list_tasks(auth: AuthUser) -> Json<Value> {
    // 调用 hermes kanban list --tenant <user_id> --json
}

// GET /api/kanban/tasks/:id
// 获取任务详情
async fn get_task(auth: AuthUser, task_id: String) -> Json<Value> {
    // 调用 hermes kanban show <task_id> --json
}

// GET /api/kanban/stats
// 获取看板统计
async fn get_stats(auth: AuthUser) -> Json<Value> {
    // 调用 hermes kanban stats --json
}

// GET /api/kanban/employees
// 获取员工列表（从 kanban profiles + assignees 推导）
async fn list_employees(auth: AuthUser) -> Json<Value> {
    // 1. hermes profile list
    // 2. hermes kanban assignees --json
    // 3. 合并权限过滤
}

// WebSocket /api/kanban/events
// 实时任务事件流
// 代理 kanban dashboard 的 /events WebSocket
```

#### 前端 API 封装

```typescript
// src/api/kanban.ts
export async function fetchKanbanTasks(tenant?: string): Promise<KanbanTask[]> {
  const res = await fetch(`/api/kanban/tasks?tenant=${tenant}`);
  return res.json();
}

export function connectKanbanEvents(
  onEvent: (event: KanbanEvent) => void
): WebSocket {
  const ws = new WebSocket(`ws://${location.host}/api/kanban/events`);
  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    data.events.forEach(onEvent);
  };
  return ws;
}
```

### 4.3 权限隔离实现

```sql
-- 权限表扩展（兼容现有结构）
-- 现有：permissions(user_id, employee, allowed)
-- 新增：user_tenants(user_id, tenant_id)

-- 查询用户可见的 kanban 任务
SELECT t.* FROM tasks t
JOIN user_tenants ut ON t.tenant = ut.tenant_id
WHERE ut.user_id = ? AND t.status != 'archived'
```

### 4.4 迁移步骤

#### Phase 1：基础设施准备（1-2天）
- [ ] 配置每个 profile 的 API key
- [ ] 启动每个 profile 的 gateway
- [ ] 验证 kanban dispatch 正常工作
- [ ] 建立 hermes-chat kanban board

#### Phase 2：后端适配层（2-3天）
- [ ] 新增 `/api/kanban/*` 路由
- [ ] 实现 tenant 权限过滤
- [ ] 实现 WebSocket 事件代理
- [ ] 扩展 permission 模型

#### Phase 3：前端迁移（2-3天）
- [ ] 新增 `api/kanban.ts` 模块
- [ ] 改造 `useEmployeeStatus` 使用 kanban 数据源
- [ ] 实现 WebSocket 实时更新
- [ ] 更新 EmployeeStatus 组件

#### Phase 4：并行运行 + 废弃旧方案（1周）
- [ ] flow-gate 与 kanban 并行运行
- [ ] 验证数据一致性
- [ ] 废弃 flow-gate plugin
- [ ] 清理旧代码

---

## 五、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Kanban DB 并发访问 | 读写冲突 | SQLite WAL 模式已支持并发读 |
| Profile gateway 未启动 | 任务无法 dispatch | 后端 health check + 前端提示 |
| WebSocket 连接断开 | 实时更新中断 | 前端自动重连 + 轮询降级 |
| 现有 cron jobs 迁移 | 定时任务丢失 | 保留 cron jobs，kanban 仅管一次性任务 |
| 多用户 tenant 隔离 | 数据泄露 | 后端强制注入 tenant，不信任前端参数 |

---

## 六、结论

**✅ 推荐迁移**。Kanban 系统在以下方面显著优于现有方案：

1. **任务管理**：原子性 claim、依赖链、自动重试、heartbeat
2. **实时性**：WebSocket 事件流 vs 60s 轮询
3. **可观测性**：task_events、task_runs、worker logs
4. **多租户**：tenant 字段天然支持用户隔离

**建议分 4 阶段迁移，总工期约 2-3 周**。过渡期两套系统并行，确保零中断。

---

## 附录：关键命令参考

```bash
# 查看 kanban 状态
hermes kanban list --json
hermes kanban stats --json
hermes kanban assignees --json

# 按 tenant 过滤
hermes kanban list --tenant user_123 --json

# 实时事件流
hermes kanban tail <task_id>

# Profile 管理
hermes profile list
hermes profile show <name>
hermes profile describe <name>

# 任务生命周期
hermes kanban create "标题" --assignee coder-404 --tenant user_123
hermes kanban dispatch
hermes kanban complete <task_id>
```
