import { useState, useEffect, useCallback, useRef } from 'react';
import type { Employee, KanbanTask } from '@/types/employee';
import { kanbanStatusToEmployeeStatus } from '@/types/employee';
import {
  fetchKanbanEmployees,
  fetchKanbanTasks,
  KanbanWebSocket,
  buildKanbanWsUrl,
} from '@/api/kanban';
import type { KanbanEvent } from '@/api/kanban';
import {
  fetchCronJobs,
  mapJobNameToEmployee,
  deriveEmployeeStatus,
  fetchActiveEmployees,
  checkProcessAlive,
} from '@/api/cronJobs';
import type { CronJob, ActiveEmployeeEntry } from '@/api/cronJobs';

/** Default employee metadata (role, avatar, tasks) for known employees */
const EMPLOYEE_META: Record<string, { role: string; avatar: string; tasks: string[] }> = {
  老财: {
    role: 'AI操盘手',
    avatar: '💰',
    tasks: ['盘前研判', '开盘异动', '午盘复盘', '尾盘异动', '每晚复盘'],
  },
  铁壳: { role: 'AI运维工程师', avatar: '🤖', tasks: ['每日日报', '运维护航'] },
  小K: { role: 'AI情报员', avatar: '🔍', tasks: ['每日早报'] },
  '404': { role: 'AI开发工程师', avatar: '💻', tasks: ['每日日报', '开发任务'] },
  裁判君: { role: 'AI审查官', avatar: '⚖️', tasks: ['按需审查'] },
  Ditto: { role: 'AI测试工程师', avatar: '🧪', tasks: ['线上测试'] },
};

/** Create a default employee object for a given name */
function createDefaultEmployee(name: string): Employee {
  const meta = EMPLOYEE_META[name];
  if (meta) {
    return {
      name,
      role: meta.role,
      avatar: meta.avatar,
      status: 'off' as const,
      currentTask: '休息中',
      tasks: meta.tasks,
    };
  }
  // Unknown employee: use generic metadata
  return {
    name,
    role: 'AI员工',
    avatar: '👤',
    status: 'off' as const,
    currentTask: '休息中',
    tasks: [],
  };
}

function groupJobsByEmployee(jobs: CronJob[]): Map<string, CronJob[]> {
  const grouped = new Map<string, CronJob[]>();
  for (const job of jobs) {
    const employeeName = mapJobNameToEmployee(job.name);
    if (!employeeName) continue;
    const existing = grouped.get(employeeName) ?? [];
    existing.push(job);
    grouped.set(employeeName, existing);
  }
  return grouped;
}

/** Extract unique employee names from cron jobs */
function extractEmployeesFromJobs(jobs: CronJob[]): string[] {
  const names = new Set<string>();
  for (const job of jobs) {
    const name = mapJobNameToEmployee(job.name);
    if (name) names.add(name);
  }
  return Array.from(names);
}

function mergeWithDefaults(defaults: Map<string, Employee>, jobs: CronJob[]): Employee[] {
  const grouped = groupJobsByEmployee(jobs);
  const result: Employee[] = [];

  for (const [name, emp] of defaults) {
    const empJobs = grouped.get(name);
    if (!empJobs || empJobs.length === 0) {
      result.push({ ...emp, status: 'off' as const, currentTask: '休息中' });
    } else {
      const { status, currentTask } = deriveEmployeeStatus(empJobs);
      result.push({ ...emp, status, currentTask });
    }
  }

  return result;
}

/**
 * Overlay active status from shell hooks onto cron-based employees.
 * Respects the active.json status field instead of blindly forcing 'working'.
 *
 * Rules:
 * 1. activeEntry.status === 'completed' → skip, keep original status
 * 2. activeEntry has pid but process is dead → mark completed
 * 3. activeEntry.status === 'working' (or no status field, process alive) → set working
 */
export function mergeWithActive(
  employees: Employee[],
  active: Record<string, ActiveEmployeeEntry>,
  pidAliveMap: Record<number, boolean> = {},
): Employee[] {
  const keys = Object.keys(active);
  if (keys.length === 0) return employees;

  return employees.map((emp) => {
    const entry = active[emp.name];
    if (!entry) return emp;

    // Rule 1: already completed → don't override
    if (entry.status === 'completed') return emp;

    // Rule 2: has pid but process is dead → mark completed
    if (entry.pid !== undefined && pidAliveMap[entry.pid] === false) {
      return { ...emp, status: 'completed' as const, currentTask: entry.task };
    }

    // Rule 3: explicitly working or legacy entry without status → set working
    if (entry.status === 'working' || entry.status === undefined) {
      return { ...emp, status: 'working' as const, currentTask: entry.task };
    }

    return emp;
  });
}

// ─── Kanban 模式 ────────────────────────────────────────────────────

/** 将 kanban 任务 + 员工信息合并为 Employee[] */
function mergeKanbanEmployees(kanbanEmployees: Employee[], tasks: KanbanTask[]): Employee[] {
  // 按 assignee 分组任务
  const tasksByAssignee = new Map<string, KanbanTask[]>();
  for (const task of tasks) {
    const list = tasksByAssignee.get(task.assignee) ?? [];
    list.push(task);
    tasksByAssignee.set(task.assignee, list);
  }

  return kanbanEmployees.map((emp) => {
    const empTasks = tasksByAssignee.get(emp.name) ?? [];
    // 找到最新的 "doing" 任务作为当前任务
    const doingTask = empTasks.find((t) => t.status === 'doing');
    const status = doingTask ? kanbanStatusToEmployeeStatus('doing') : emp.status;

    return {
      ...emp,
      status,
      currentTask: doingTask?.title ?? emp.currentTask,
      currentTaskId: doingTask?.id,
      taskCount: empTasks.length,
      kanbanStatus: doingTask?.status ?? emp.kanbanStatus,
    };
  });
}

// ─── Hook ───────────────────────────────────────────────────────────

const USE_KANBAN = import.meta.env.VITE_USE_KANBAN === 'true';

export function useEmployeeStatus() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const wsRef = useRef<KanbanWebSocket | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Kanban 模式 ──────────────────────────────────────────────────

  const refreshKanban = useCallback(async () => {
    try {
      const [kanbanEmployees, tasks] = await Promise.all([
        fetchKanbanEmployees(),
        fetchKanbanTasks(),
      ]);

      if (kanbanEmployees.length > 0) {
        setEmployees(mergeKanbanEmployees(kanbanEmployees, tasks));
      } else {
        // API 返回空 → 降级为默认员工列表
        const fallback = Object.keys(EMPLOYEE_META).map(createDefaultEmployee);
        setEmployees(fallback);
      }
    } catch {
      const fallback = Object.keys(EMPLOYEE_META).map(createDefaultEmployee);
      setEmployees(fallback);
    }
    setLastUpdated(new Date());
  }, []);

  const handleKanbanEvent = useCallback(
    (event: KanbanEvent) => {
      // 任务相关事件 → 触发刷新
      if (event.type.startsWith('task.')) {
        refreshKanban();
      }
    },
    [refreshKanban],
  );

  // ── Legacy 模式 ──────────────────────────────────────────────────

  const refreshLegacy = useCallback(async () => {
    try {
      const [jobs, active] = await Promise.all([fetchCronJobs(), fetchActiveEmployees()]);

      // Always start with all known employees
      const defaults = new Map<string, Employee>();
      for (const name of Object.keys(EMPLOYEE_META)) {
        defaults.set(name, createDefaultEmployee(name));
      }

      // Add any additional employees from cron jobs or active entries
      for (const name of extractEmployeesFromJobs(jobs)) {
        if (!defaults.has(name)) {
          defaults.set(name, createDefaultEmployee(name));
        }
      }
      for (const name of Object.keys(active)) {
        if (!defaults.has(name)) {
          defaults.set(name, createDefaultEmployee(name));
        }
      }

      const merged = mergeWithDefaults(defaults, jobs);

      // Pre-compute pid alive states for active entries that have pids
      const pids = Object.values(active)
        .map((e) => e.pid)
        .filter((pid): pid is number => pid !== undefined);
      const aliveResults = pids.length > 0 ? await Promise.all(pids.map(checkProcessAlive)) : [];
      const pidAliveMap: Record<number, boolean> = {};
      pids.forEach((pid, i) => {
        pidAliveMap[pid] = aliveResults[i];
      });

      setEmployees(mergeWithActive(merged, active, pidAliveMap));
    } catch {
      // On error, show all known employees as off
      const fallback = Object.keys(EMPLOYEE_META).map(createDefaultEmployee);
      setEmployees(fallback);
    }
    setLastUpdated(new Date());
  }, []);

  // ── 主逻辑 ───────────────────────────────────────────────────────

  const refresh = USE_KANBAN ? refreshKanban : refreshLegacy;

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Kanban 模式：WebSocket + 降级轮询
  useEffect(() => {
    if (!USE_KANBAN) return;

    const ws = new KanbanWebSocket(buildKanbanWsUrl());
    wsRef.current = ws;

    ws.on(handleKanbanEvent);
    ws.connect();

    // 定时检查 WebSocket 状态，断开时降级为 30s 轮询
    const checkInterval = setInterval(() => {
      if (!ws.connected && !pollingRef.current) {
        // WebSocket 断开 → 启动降级轮询
        pollingRef.current = setInterval(refreshKanban, 30_000);
      } else if (ws.connected && pollingRef.current) {
        // WebSocket 恢复 → 停止降级轮询
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }, 5_000);

    return () => {
      ws.disconnect();
      clearInterval(checkInterval);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [refreshKanban, handleKanbanEvent]);

  // Legacy 模式：60s 轮询
  useEffect(() => {
    if (USE_KANBAN) return;
    const timer = setInterval(refresh, 60_000);
    return () => clearInterval(timer);
  }, [refresh]);

  // 立即刷新：页面重新可见或窗口获焦时
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };
    const handleFocus = () => {
      refresh();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refresh]);

  return { employees, lastUpdated, refresh };
}
