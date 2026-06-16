# KAN-401: 并行运行验证 — 测试报告

> 日期：2026-06-16
> 测试人：Ditto (测试工程师)
> 任务：flow-gate 与 kanban 并行运行 1 周，验证数据一致性
> 状态：⚠️ 代码分析完成，线上实测受阻（terminal 安全策略 + browser GLIBC 问题）

---

## 一、测试范围

KAN-401 要求验证 flow-gate（旧系统）和 kanban（新系统）并行运行时的数据一致性。
验收标准：对比 flow-gate 和 kanban 状态，差异 < 1%。

## 二、架构分析

### 2.1 双系统并行架构

当前系统已实现三源数据融合，架构如下：

```
数据源优先级（高→低）：
┌─────────────────────────────────────────┐
│ Layer 3: Kanban Tasks (api/kanban.ts)    │ ← 最高优先级
│   - doing → working                      │
│   - todo → standby (仅当 off)            │
│   - 附加 taskCount/kanbanStatus 等字段   │
├─────────────────────────────────────────┤
│ Layer 2: Active Entries (shell hooks)    │ ← 实时覆盖
│   - employees-active.json                │
│   - working/completed/failed 状态        │
│   - PID 存活检查                         │
├─────────────────────────────────────────┤
│ Layer 1: Cron Jobs (cronJobs.ts)         │ ← 基础状态
│   - /chat/api/jobs                       │
│   - running/standby/off 推导             │
└─────────────────────────────────────────┘
```

**关键代码**: `useEmployeeStatus.ts` L201-253

```typescript
// Layer 1: cron job status
const merged = mergeWithDefaults(defaults, jobs);
// Layer 2: active entries (shell hooks, highest real-time priority)
const withActive = mergeWithActive(merged, active, pidAliveMap);
// Layer 3: kanban task status (augments counts + upgrades if applicable)
const withKanban = mergeWithKanban(withActive, kanbanGrouped);
```

### 2.2 Feature Flag 控制

- `VITE_USE_KANBAN=true` → 启用 WebSocket 实时推送 + 30s 降级轮询
- `VITE_USE_KANBAN≠true` → 保持 60s 轮询（旧模式）
- **无论 flag 值如何，三源数据都会拉取并合并**（L201-207）

### 2.3 数据流对比

| 维度 | flow-gate (旧) | kanban (新) | 一致性风险 |
|------|---------------|-------------|-----------|
| 数据源 | cron jobs + active.json | kanban DB + WebSocket | ⚠️ 双源可能冲突 |
| 状态模型 | running/standby/off | doing/todo/done/ready/blocked | ⚠️ 状态集不完全对齐 |
| 更新频率 | 60s 轮询 | 5s WS 推送 + 30s 降级轮询 | ⚠️ 时间差可能导致短暂不一致 |
| 员工映射 | `resolveCronJobName` (中文名匹配) | `resolveAssignee` (aliases 匹配) | ✅ 共享 EMPLOYEE_META |
| 任务标识 | cron job name (字符串) | task ID (唯一标识) | ✅ 无歧义 |

---

## 三、代码级一致性分析

### 3.1 员工映射一致性 ✅

两个系统共享 `EMPLOYEE_META` 配置（`config/employeeMapping.ts`）：

| 员工 | cron 匹配方式 | kanban 匹配方式 | 一致性 |
|------|-------------|----------------|--------|
| 老财 | job name 含 "老财" | assignee 含 "老财" 或 "laocai" | ✅ |
| 铁壳 | job name 含 "铁壳" | assignee 含 "铁壳" 或 "tieke" | ✅ |
| 小K | job name 含 "小K" 或 "早报" | assignee 含 "小k" 或 "xiaok" | ✅ |
| 404 | job name 含 "404" | assignee 含 "404" 或 "coder-404" | ✅ |
| 裁判君 | job name 含 "裁判" | assignee 含 "裁判"/"reviewer"/"referee" | ✅ |
| Ditto | job name 含 "ditto" | assignee 含 "ditto" | ✅ |

**结论**：映射逻辑一致，无遗漏风险。

### 3.2 状态推导一致性 ⚠️

**flow-gate 状态推导** (`cronJobs.ts` L68-123):
```
running → working
next_run_at < 30min → standby
enabled + next_run_at → standby (显示下次运行时间)
否则 → off
```

**kanban 状态推导** (`kanban.ts` L279-311):
```
doing → working
todo → standby (仅当 off)
done → completed
```

**合并逻辑** (`useEmployeeStatus.ts` L141-187):
```
kanban doing + emp≠working → 升级为 working
kanban todo + emp=off → 升级为 standby
kanban done → 不降级，仅附加字段
```

**风险点**：
1. ⚠️ **kanban `ready` 和 `blocked` 状态**在 `deriveKanbanTaskStatus` 中未处理（只看 doing/todo/done），但 `types/employee.ts` 的 `kanbanStatusToEmployeeStatus` 有完整映射。两处逻辑不一致。
2. ⚠️ **cron standby vs kanban standby 语义不同**：cron standby 表示"即将运行"，kanban standby 表示"有待办任务"。用户看到的"待命"含义不一致。
3. ✅ **不会互相覆盖**：mergeWithKanban 只升级不降级，不会把 working 覆盖为 standby。

### 3.3 数据实时性差异 ⚠️

| 场景 | flow-gate 延迟 | kanban 延迟 | 差异 |
|------|--------------|-------------|------|
| 任务开始 | 60s（轮询间隔）| 5s（WS poll）| 55s |
| 任务完成 | 60s + active.json 写入延迟 | 5s（WS poll）| ~55s |
| 状态变更 | 60s | 5s | 55s |

**影响**：在任务开始/完成的瞬间，两个系统可能短暂显示不同状态。
**缓解**：mergeWithKanban 优先级更高，最终会收敛到 kanban 状态。

### 3.4 WebSocket 事件一致性 ⚠️

WS handler (`handlers/kanban.rs` L158-307) 使用快照对比方式检测变更：
- 每 5s 从 CLI 拉取任务列表
- 与上次快照对比，生成 task_changed/task_created/task_deleted 事件
- **风险**：如果 CLI 返回的数据与 DB 直接查询的数据不一致，WS 事件可能错误

**验证点**：
- `list_tasks_json` (CLI) vs `list_tasks` (DB) 返回的数据是否一致
- CLI 命令 `hermes kanban list --json` 的输出格式是否稳定

### 3.5 Tenant 隔离一致性 ✅

两个系统都通过 tenant 隔离：
- kanban: `WHERE tenant = ? OR tenant IS NULL`
- cron jobs: 无 tenant 概念（全局可见）
- **影响**：cron jobs 不受 tenant 隔离，所有用户看到相同的 cron 状态。kanban 按 tenant 隔离。这可能导致不同用户看到不同的员工状态。

---

## 四、测试用例（待线上执行）

### 4.1 数据一致性测试

| ID | 用例 | 操作步骤 | 预期结果 | 状态 |
|----|------|---------|---------|------|
| DC-001 | 员工列表一致性 | 1. GET /api/kanban/employees<br>2. 对比 EMPLOYEE_META 中的员工 | kanban 返回的员工 ⊆ EMPLOYEE_META | ⏸️ |
| DC-002 | 任务状态一致性 | 1. GET /api/kanban/tasks<br>2. 对比 cron jobs 中同名任务的状态 | 同一员工的 working/off 状态一致 | ⏸️ |
| DC-003 | WS 事件 vs REST 一致性 | 1. 通过 WS 收到 task_changed 事件<br>2. GET /api/kanban/tasks 验证 | WS 事件中的状态与 REST 返回一致 | ⏸️ |
| DC-004 | CLI vs DB 一致性 | 1. GET /api/kanban/tasks (DB 查询)<br>2. 对比 WS 使用的 CLI 输出 | 两者返回的任务列表一致 | ⏸️ |

### 4.2 状态收敛测试

| ID | 用例 | 操作步骤 | 预期结果 | 状态 |
|----|------|---------|---------|------|
| SC-001 | 任务开始时状态收敛 | 1. 创建任务并分配给员工<br>2. 等待 5s (WS poll) | 员工状态从 off/standby → working | ⏸️ |
| SC-002 | 任务完成时状态收敛 | 1. 完成任务<br>2. 等待 5s | 员工状态从 working → off/completed | ⏸️ |
| SC-003 | 双系统状态最终一致 | 1. 同时观察 cron 和 kanban 状态<br>2. 等待 60s | 两个系统的员工状态一致 | ⏸️ |

### 4.3 边界条件测试

| ID | 用例 | 操作步骤 | 预期结果 | 状态 |
|----|------|---------|---------|------|
| BC-001 | kanban 不可用时降级 | 1. 模拟 kanban API 返回空<br>2. 检查员工状态 | 降级到 cron + active 数据源 | ⏸️ |
| BC-002 | cron 不可用时降级 | 1. 模拟 cron API 返回空<br>2. 检查员工状态 | 降级到 kanban 数据源 | ⏸️ |
| BC-003 | WS 断线降级 | 1. 断开 WebSocket<br>2. 检查轮询行为 | 自动切换到 30s 轮询 | ⏸️ |
| BC-004 | 新员工动态发现 | 1. 在 kanban 中创建新 assignee 任务<br>2. 检查员工列表 | 新员工自动出现（如果在 EMPLOYEE_META 中） | ⏸️ |

---

## 五、发现的问题

### Bug 1: [一般] deriveKanbanTaskStatus 未处理 ready/blocked 状态

**位置**: `src/api/kanban.ts` L279-311

**描述**: `deriveKanbanTaskStatus` 函数只检查 doing/todo/done 三种状态，忽略了 ready 和 blocked。
而 `types/employee.ts` 的 `kanbanStatusToEmployeeStatus` 有完整映射（含 ready→standby, blocked→blocked）。

**影响**: 如果任务处于 ready 或 blocked 状态，员工状态不会被正确推导。

**复现步骤**:
1. 创建任务，状态设为 blocked
2. 检查员工状态面板

**预期**: 员工状态显示 "阻塞"
**实际**: blocked 任务被忽略，员工可能显示 off

**修复建议**:
```typescript
// deriveKanbanTaskStatus 中添加 blocked 处理
const blocked = tasks.filter((t) => t.status === 'blocked');
if (blocked.length > 0) {
  return {
    status: 'working', // 或新增 'blocked' 状态
    currentTask: `阻塞: ${blocked[0].title}`,
    ...
  };
}
```

### Bug 2: [一般] kanbanStatus 字段映射不一致

**位置**: `src/hooks/useEmployeeStatus.ts` L160

**描述**: `mergeWithKanban` 中 kanbanStatus 映射：
```typescript
kanbanStatus: kanbanStatus.status === 'working' ? 'doing' : 
              kanbanStatus.status === 'standby' ? 'todo' : 'done'
```
这个映射丢失了 'ready' 和 'blocked'，且与 `getKanbanStatusLabel` 的映射不一致。

**影响**: 前端显示的 kanban 状态标签可能不准确。

### 问题 3: [轻微] cron 和 kanban 的 standby 语义不同

**描述**:
- cron standby = "即将运行"（next_run_at < 30min）
- kanban standby = "有待办任务"（todo > 0）

用户看到 "待命" 时，含义不一致。这不是 bug，但可能导致用户困惑。

**建议**: 在 UI 上区分两种待命状态，或统一语义。

---

## 六、测试覆盖评估

| 维度 | 覆盖情况 | 说明 |
|------|---------|------|
| 功能测试 | ⚠️ 代码分析完成 | 线上实测受阻（terminal/browser 不可用）|
| 边界测试 | ✅ 已识别 3 个边界场景 | ready/blocked 状态、双源降级 |
| 交互测试 | ⏸️ 待执行 | 需要浏览器访问 |
| 数据一致性 | ⚠️ 代码分析完成 | 发现 2 个潜在不一致点 |
| 回归测试 | ⏸️ 待执行 | 需要遍历所有功能模块 |

---

## 七、建议

### 7.1 立即修复
1. **修复 deriveKanbanTaskStatus** — 添加 ready/blocked 状态处理
2. **统一 kanbanStatus 映射** — mergeWithKanban 和 getKanbanStatusLabel 使用同一套映射

### 7.2 线上验证（需要 terminal 权限）
1. curl 对比 `/api/kanban/tasks` 和 `/api/jobs` 返回的员工状态
2. curl 验证 `/api/kanban/employees` 返回完整员工列表
3. 验证 WS 连接和事件推送正常

### 7.3 持续监控
1. 建议添加数据一致性监控脚本，每小时对比一次两个系统的状态
2. 记录状态不一致的次数和持续时间
3. 1 周后统计差异率，确认 < 1% 目标

---

## 八、结论

**代码层面**：双系统并行架构设计合理，三源融合逻辑清晰，员工映射一致。
**风险点**：ready/blocked 状态处理缺失，kanbanStatus 映射不一致。
**线上验证**：受阻于 terminal 安全策略和 browser GLIBC 问题，需要人工介入。

**建议**：先修复 2 个代码问题，再进行线上验证。

---

**测试报告人**: Ditto (测试工程师)
**最后更新**: 2026-06-16
