import { useState, useEffect, useCallback, useRef } from 'react';
import type { Employee } from '@/types/employee';
import {
  fetchCronJobs,
  deriveEmployeeStatus,
  fetchActiveEmployees,
  checkProcessAlive,
} from '@/api/cronJobs';
import type { CronJob, ActiveEmployeeEntry } from '@/api/cronJobs';
import {
  fetchKanbanTasks,
  groupKanbanTasksByEmployee,
  deriveKanbanTaskStatus,
  mapKanbanAssigneeToEmployee,
} from '@/api/kanban';
import type { KanbanTask } from '@/types/employee';
import type { KanbanWsEvent, WsConnectionStatus } from '@/api/kanban';
import { EMPLOYEE_META, resolveCronJobName } from '@/config/employeeMapping';
import { useKanbanWebSocket } from './useKanbanWebSocket';

/** Default employee metadata (role, avatar, tasks) for known employees */
// EMPLOYEE_META now imported from @/config/employeeMapping

/** Create a default employee object for a given name */
export function createDefaultEmployee(name: string): Employee {
  const meta = EMPLOYEE_META[name as keyof typeof EMPLOYEE_META];
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
  return {
    name,
    role: 'AI员工',
    avatar: '👤',
    status: 'off' as const,
    currentTask: '休息中',
    tasks: [],
  };
}

export function groupJobsByEmployee(jobs: CronJob[]): Map<string, CronJob[]> {
  const grouped = new Map<string, CronJob[]>();
  for (const job of jobs) {
    const employeeName = resolveCronJobName(job.name);
    if (!employeeName) continue;
    const existing = grouped.get(employeeName) ?? [];
    existing.push(job);
    grouped.set(employeeName, existing);
  }
  return grouped;
}

/** Extract unique employee names from cron jobs */
export function extractEmployeesFromJobs(jobs: CronJob[]): string[] {
  const names = new Set<string>();
  for (const job of jobs) {
    const name = resolveCronJobName(job.name);
    if (name) names.add(name);
  }
  return Array.from(names);
}

/** Extract unique employee names from kanban tasks */
export function extractEmployeesFromKanban(tasks: KanbanTask[]): string[] {
  const grouped = groupKanbanTasksByEmployee(tasks);
  return Array.from(grouped.keys());
}

export function mergeWithDefaults(defaults: Map<string, Employee>, jobs: CronJob[]): Employee[] {
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

/**
 * Overlay kanban task data onto employees.
 *
 * Rules (lower priority than active entries, higher than cron-only):
 * 1. Has doing kanban task → set 'working' + task title
 * 2. Has todo kanban tasks → set 'standby' (if currently off)
 * 3. Always populate kanban count fields
 *
 * @param employees - employees with cron-based status already merged
 * @param kanbanTasksByEmployee - kanban tasks grouped by employee name
 */
export function mergeWithKanban(
  employees: Employee[],
  kanbanTasksByEmployee: Map<string, KanbanTask[]>,
): Employee[] {
  if (kanbanTasksByEmployee.size === 0) return employees;

  return employees.map((emp) => {
    const kanbanTasks = kanbanTasksByEmployee.get(emp.name);
    if (!kanbanTasks || kanbanTasks.length === 0) return emp;

    const kanbanStatus = deriveKanbanTaskStatus(kanbanTasks);

    // Build kanban field updates
    const kanbanFields: Partial<Employee> = {
      taskCount: kanbanTasks.length,
      kanbanTaskCount: kanbanTasks.length,
      kanbanRunningCount: kanbanStatus.runningCount,
      kanbanPendingCount: kanbanStatus.pendingCount,
      kanbanCompletedCount: kanbanStatus.completedCount,
      kanbanStatus: kanbanStatus.status === 'working' ? 'doing' : kanbanStatus.status === 'standby' ? 'todo' : 'done',
    };

    // Only upgrade status, never downgrade working → standby
    if (kanbanStatus.status === 'working' && emp.status !== 'working') {
      return {
        ...emp,
        ...kanbanFields,
        status: 'working' as const,
        currentTask: kanbanStatus.currentTask,
        currentTaskId: kanbanTasks.find((t) => t.status === 'doing')?.id,
      };
    }

    // Set standby if employee is off and kanban has pending work
    if (kanbanStatus.status === 'standby' && emp.status === 'off') {
      return {
        ...emp,
        ...kanbanFields,
        status: 'standby' as const,
        currentTask: kanbanStatus.currentTask,
      };
    }

    // Just attach kanban fields without changing status
    return { ...emp, ...kanbanFields };
  });
}

export function useEmployeeStatus() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [wsStatus, setWsStatus] = useState<WsConnectionStatus | 'polling'>('polling');
  const [lastWsUpdate, setLastWsUpdate] = useState<Date | null>(null);
  const [wsError, setWsError] = useState<string | null>(null);
  const kanbanTasksRef = useRef<KanbanTask[]>([]);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const useWs = import.meta.env.VITE_USE_KANBAN === 'true';

  /** 从 REST API 全量拉取并合并状态 */
  const refresh = useCallback(async () => {
    try {
      const [jobs, active, kanbanTasks] = await Promise.all([
        fetchCronJobs(),
        fetchActiveEmployees(),
        fetchKanbanTasks(),
      ]);

      // 缓存 kanban 任务，供 WebSocket 增量更新使用
      kanbanTasksRef.current = kanbanTasks;

      // Always start with all known employees
      const defaults = new Map<string, Employee>();
      for (const name of Object.keys(EMPLOYEE_META)) {
        defaults.set(name, createDefaultEmployee(name));
      }

      // Add any additional employees from cron jobs, active entries, or kanban
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
      for (const name of extractEmployeesFromKanban(kanbanTasks)) {
        if (!defaults.has(name)) {
          defaults.set(name, createDefaultEmployee(name));
        }
      }

      // Layer 1: cron job status
      const merged = mergeWithDefaults(defaults, jobs);

      // Layer 2: active entries (shell hooks, highest real-time priority)
      const pids = Object.values(active)
        .map((e) => e.pid)
        .filter((pid): pid is number => pid !== undefined);
      const aliveResults = pids.length > 0
        ? await Promise.all(pids.map(checkProcessAlive))
        : [];
      const pidAliveMap: Record<number, boolean> = {};
      pids.forEach((pid, i) => { pidAliveMap[pid] = aliveResults[i]; });

      const withActive = mergeWithActive(merged, active, pidAliveMap);

      // Layer 3: kanban task status (augments counts + upgrades if applicable)
      const kanbanGrouped = groupKanbanTasksByEmployee(kanbanTasks);
      const withKanban = mergeWithKanban(withActive, kanbanGrouped);

      setEmployees(withKanban);
    } catch {
      // On error, show all known employees as off
      const fallback = Object.keys(EMPLOYEE_META).map(createDefaultEmployee);
      setEmployees(fallback);
    }
    setLastUpdated(new Date());
  }, []);

  /** 处理 WebSocket 事件 — 增量更新 kanban 任务缓存和员工状态 */
  const handleWsEvent = useCallback((event: KanbanWsEvent) => {
    const { task_id, task, type } = event;

    // heartbeat 仅更新 lastWsUpdate，不刷新状态
    if (type === 'heartbeat') {
      setLastWsUpdate(new Date());
      return;
    }

    // 更新本地 kanban 任务缓存
    const tasks = kanbanTasksRef.current;
    const idx = tasks.findIndex((t) => t.id === task_id);

    if ((type === 'task_created' || type === 'task_claimed') && idx === -1) {
      tasks.push(task);
    } else if (type === 'task_changed' && idx !== -1) {
      tasks[idx] = task;
    }

    // 增量更新员工状态（只重算受影响的员工）
    setEmployees((prev) => {
      const assignee = mapKanbanAssigneeToEmployee(task.assignee);
      if (!assignee) return prev;

      // 找到该员工的所有 kanban 任务
      const employeeTasks = tasks.filter(
        (t) => mapKanbanAssigneeToEmployee(t.assignee) === assignee,
      );

      return prev.map((emp) => {
        if (emp.name !== assignee) return emp;

        const kanbanStatus = deriveKanbanTaskStatus(employeeTasks);
        const kanbanFields: Partial<Employee> = {
          taskCount: employeeTasks.length,
          kanbanTaskCount: employeeTasks.length,
          kanbanRunningCount: kanbanStatus.runningCount,
          kanbanPendingCount: kanbanStatus.pendingCount,
          kanbanCompletedCount: kanbanStatus.completedCount,
          kanbanStatus: kanbanStatus.status === 'working' ? 'doing' : kanbanStatus.status === 'standby' ? 'todo' : 'done',
        };

        // 升级规则与 mergeWithKanban 一致
        if (kanbanStatus.status === 'working' && emp.status !== 'working') {
          return {
            ...emp,
            ...kanbanFields,
            status: 'working' as const,
            currentTask: kanbanStatus.currentTask,
            currentTaskId: employeeTasks.find((t) => t.status === 'doing')?.id,
          };
        }

        if (kanbanStatus.status === 'standby' && emp.status === 'off') {
          return {
            ...emp,
            ...kanbanFields,
            status: 'standby' as const,
            currentTask: kanbanStatus.currentTask,
          };
        }

        return { ...emp, ...kanbanFields };
      });
    });

    setLastWsUpdate(new Date());
  }, []);

  // WebSocket 实时推送（仅当 VITE_USE_KANBAN=true）
  const { wsStatus: currentWsStatus, reconnect } = useWs
    ? useKanbanWebSocket(handleWsEvent)
    : { wsStatus: 'polling' as const, reconnect: () => {} };

  // 同步 WebSocket 状态 + 降级轮询逻辑
  useEffect(() => {
    if (!useWs) {
      // 非 WS 模式：始终 polling
      setWsStatus('polling');
      return;
    }

    setWsStatus(currentWsStatus);

    // WS 断线/重连中 → 启动 30s 降级轮询
    if (currentWsStatus === 'disconnected' || currentWsStatus === 'reconnecting') {
      if (!pollingTimerRef.current) {
        pollingTimerRef.current = setInterval(refresh, 30_000);
      }
    } else if (currentWsStatus === 'connected') {
      // WS 恢复 → 停止降级轮询
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      setWsError(null);
    }
  }, [currentWsStatus, useWs, refresh]);

  // 初始全量拉取
  useEffect(() => {
    refresh();
  }, [refresh]);

  // 非 WS 模式：保持 60s 轮询
  useEffect(() => {
    if (useWs) return;
    const timer = setInterval(refresh, 60_000);
    return () => clearInterval(timer);
  }, [refresh, useWs]);

  // 页面重新可见或窗口获焦时，全量刷新一次（补偿 WebSocket 可能丢失的事件）
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

  // 清理降级轮询 timer
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, []);

  return { employees, lastUpdated, refresh, wsStatus, lastWsUpdate, wsError, reconnect };
}
