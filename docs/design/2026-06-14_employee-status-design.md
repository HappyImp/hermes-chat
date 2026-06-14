# 员工状态面板设计文档

**日期**: 2026-06-14
**关联 PRD**: [prd/2026-06-14_employee-status.md](../prd/2026-06-14_employee-status.md)

## 1. 架构设计

```
┌─────────────────────────────────────────────┐
│                  Sidebar                     │
│  ┌─────────────────────────────────────────┐│
│  │           ChannelList                    ││
│  ├─────────────────────────────────────────┤│
│  │           SessionList                    ││
│  ├─────────────────────────────────────────┤│
│  │        EmployeeStatus (新增)             ││
│  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌───┐││
│  │  │老财 │ │铁壳 │ │小K  │ │404  │ │裁判│││
│  │  │ 🟢  │ │ 🔴  │ │ 🟢  │ │ 🟢  │ │🔴 │││
│  │  └─────┘ └─────┘ └─────┘ └─────┘ └───┘││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

## 2. 数据流

```
Shell Hook (on_session_start)
    ↓ 写入
/tmp/employees-active.json
    ↓ 读取 (HTTP API)
useEmployeeStatus hook (30s 轮询)
    ↓ 数据
EmployeeStatus 组件
    ↓ 渲染
侧边栏底部
```

## 3. 组件设计

### 3.1 EmployeeStatus 组件

```typescript
// src/components/Sidebar/EmployeeStatus.tsx

interface EmployeeInfo {
  task: string;       // 当前任务描述
  startedAt: string;  // ISO 时间戳
}

// Props: 无，数据自给（通过 hook 获取）
// 状态: 使用 useEmployeeStatus hook
```

**渲染逻辑**:
- 遍历固定员工列表 `["老财", "铁壳", "小K", "404", "裁判君"]`
- 在线：绿色圆点 + 员工名 + 截断任务 + 时长
- 离线：灰色圆点 + 员工名 + "离线"
- 任务描述超过 30 字符截断 + `...`

### 3.2 useEmployeeStatus Hook

```typescript
// src/hooks/useEmployeeStatus.ts

function useEmployeeStatus() {
  // 30 秒轮询 GET /employees/active
  // 返回: Map<string, EmployeeInfo | null>
  // 降级: API 失败返回空 Map
}
```

**容错策略**:
- fetch 失败 → 静默降级，所有员工显示离线
- JSON 解析失败 → 同上
- 轮询间隔 30 秒，不因错误加速重试

## 4. 样式设计

```css
/* 暗色主题，与 Sidebar 一致 */
.employee-status {
  border-top: 1px solid var(--border);  /* 分割线 */
  padding: 8px 12px;
}

.employee-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.status-dot.online  { background: #3fb950; }  /* success green */
.status-dot.offline { background: #484f58; }  /* muted gray */

.employee-name { font-weight: 500; color: #e6edf3; }
.employee-task { color: #8b949e; font-size: 0.75rem; }
```

## 5. 测试策略

| 测试 | 说明 |
|------|------|
| 渲染测试 | 5 个员工全部渲染 |
| 在线状态 | 在线员工显示绿色圆点 + 任务 |
| 离线状态 | 离线员工显示灰色圆点 + "离线" |
| 任务截断 | 超过 30 字符截断 + 省略号 |
| API 降级 | fetch 失败时全部显示离线 |
| 时长计算 | 显示正确的工作时长格式 |

## 6. 文件清单

| 文件 | 说明 |
|------|------|
| `src/components/Sidebar/EmployeeStatus.tsx` | 员工状态面板组件 |
| `src/hooks/useEmployeeStatus.ts` | 状态轮询 hook |
| `src/components/__tests__/EmployeeStatus.test.tsx` | 组件测试 |
| `src/hooks/__tests__/useEmployeeStatus.test.ts` | Hook 测试 |
| `scripts/employee-hook.sh` | Shell Hook 脚本 |
