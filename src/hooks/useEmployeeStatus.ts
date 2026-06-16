import { useState, useEffect, useCallback, useRef } from 'react';
import type { Employee } from '@/types/employee';
import {
  fetchKanbanTasks,
  groupKanbanTasksByEmployee,
  deriveKanbanTaskStatus,
  mapKanbanAssigneeToEmployee,
} from '@/api/kanban';
import type { KanbanTask } from '@/types/employee';
import type { KanbanWsEvent, WsConnectionStatus } from '@/api/kanban';
import { useKanbanWebSocket } from './useKanbanWebSocket';

/** 员工基础元数据（仅用于默认头像/角色，不再从 cron/active.json 获取状态） */
const EMPLOYEE_DEFAULTS: Record<string, { role: string; avatar: string; tasks: string[] }> = {
  '老财': { role: 'AI操盘手', avatar: '💰', tasks: ['盘前研判', '开盘异动', '午盘复盘', '尾盘异动', '每晚复盘'] },
  '铁壳': { role: 'AI运维工程师', avatar: '🤖', tasks: ['每日日报', '运维护航'] },
  '小K': { role: 'AI情报员', avatar: '🔍', tasks: ['每日早报'] },
  '404': { role: 'AI开发工程师', avatar: '💻', tasks: ['每日日报', '开发任务'] },
  '裁判君': { role: 'AI审查官', avatar: '⚖️', tasks: ['按需审查'] },
  'Ditto': { role: 'AI测试工程师', avatar: '🧪', tasks: ['线上测试'] },
};

/** Create a default employee object for a given name */
export function createDefaultEmployee(name: string): Employee {
  const meta = EMPLOYEE_DEFAULTS[name];
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

/**
 * Overlay kanban task data onto employees.
 *
 * Rules:
 * 1. Has doing kanban task → set 'working' + task title
 * 2. Has todo kanban tasks → set 'standby' (if currently off)
 * 3. Always populate kanban count fields
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

    const kanbanFields: Partial<Employee> = {
      taskCount: kanbanTasks.length,
      kanbanTaskCount: kanbanTasks.length,
      kanbanRunningCount: kanbanStatus.runningCount,
      kanbanPendingCount: kanbanStatus.pendingCount,
      kanbanCompletedCount: kanbanStatus.completedCount,
      kanbanStatus: kanbanStatus.status === 'working' ? 'doing' : kanbanStatus.status === 'standby' ? 'todo' : kanbanStatus.status === 'blocked' ? 'blocked' : 'done',
      kanbanTasks,
    };

    if (kanbanStatus.status === 'working' && emp.status !== 'working') {
      return {
        ...emp,
        ...kanbanFields,
        status: 'working' as const,
        currentTask: kanbanStatus.currentTask,
        currentTaskId: kanbanTasks.find((t) => t.status === 'doing')?.id,
      };
    }

    if (kanbanStatus.status === 'blocked') {
      return {
        ...emp,
        ...kanbanFields,
        status: 'blocked' as const,
        currentTask: kanbanStatus.currentTask,
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

  /** 从 kanban REST API 全量拉取并合并状态 */
  const refresh = useCallback(async () => {
    try {
      const kanbanTasks = await fetchKanbanTasks();
      kanbanTasksRef.current = kanbanTasks;

      // Build employee map from known defaults + kanban assignees
      const defaults = new Map<string, Employee>();
      for (const name of Object.keys(EMPLOYEE_DEFAULTS)) {
        defaults.set(name, createDefaultEmployee(name));
      }

      // Add employees discovered from kanban tasks
      const kanbanGrouped = groupKanbanTasksByEmployee(kanbanTasks);
      for (const name of kanbanGrouped.keys()) {
        if (!defaults.has(name)) {
          defaults.set(name, createDefaultEmployee(name));
        }
      }

      // Merge kanban status onto employees
      const employeesArr = Array.from(defaults.values());
      const withKanban = mergeWithKanban(employeesArr, kanbanGrouped);

      setEmployees(withKanban);
    } catch {
      const fallback = Object.keys(EMPLOYEE_DEFAULTS).map(createDefaultEmployee);
      setEmployees(fallback);
    }
    setLastUpdated(new Date());
  }, []);

  /** 重算单个员工的 kanban 状态 */
  const recalcKanbanStatus = useCallback((prev: Employee[], tasks: KanbanTask[], assignee: string): Employee[] => {
    return prev.map((emp) => {
      if (emp.name !== assignee) return emp;

      const employeeTasks = tasks.filter(
        (t) => mapKanbanAssigneeToEmployee(t.assignee) === assignee,
      );

      const kanbanStatus = deriveKanbanTaskStatus(employeeTasks);
      const kanbanFields: Partial<Employee> = {
        taskCount: employeeTasks.length,
        kanbanTaskCount: employeeTasks.length,
        kanbanRunningCount: kanbanStatus.runningCount,
        kanbanPendingCount: kanbanStatus.pendingCount,
        kanbanCompletedCount: kanbanStatus.completedCount,
        kanbanStatus: kanbanStatus.status === 'working' ? 'doing' : kanbanStatus.status === 'standby' ? 'todo' : kanbanStatus.status === 'blocked' ? 'blocked' : 'done',
        kanbanTasks: employeeTasks,
      };

      if (kanbanStatus.status === 'working' && emp.status !== 'working') {
        return {
          ...emp,
          ...kanbanFields,
          status: 'working' as const,
          currentTask: kanbanStatus.currentTask,
          currentTaskId: employeeTasks.find((t) => t.status === 'doing')?.id,
        };
      }

      if (kanbanStatus.status === 'blocked') {
        return {
          ...emp,
          ...kanbanFields,
          status: 'blocked' as const,
          currentTask: kanbanStatus.currentTask,
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
  }, []);

  /** 处理 WebSocket 事件 — 增量更新 kanban 任务缓存和员工状态 */
  const handleWsEvent = useCallback((event: KanbanWsEvent) => {
      const { task_id, task, type } = event;

      if (type === 'heartbeat') {
        setLastWsUpdate(new Date());
        return;
      }

      if (type === 'task_deleted') {
        const deletedTask = kanbanTasksRef.current.find((t) => t.id === task_id);
        kanbanTasksRef.current = kanbanTasksRef.current.filter((t) => t.id !== task_id);

        if (deletedTask) {
          const assignee = mapKanbanAssigneeToEmployee(deletedTask.assignee);
          if (assignee) {
            setEmployees((prev) => recalcKanbanStatus(prev, kanbanTasksRef.current, assignee));
          }
        }

        setLastWsUpdate(new Date());
        return;
      }

      if (!task) return;

      const tasks = kanbanTasksRef.current;
      const idx = tasks.findIndex((t) => t.id === task_id);
      let oldAssignee: string | null = null;

      if (type === 'task_created' && idx === -1) {
        kanbanTasksRef.current = [...tasks, task];
      } else if (type === 'task_claimed') {
        if (idx !== -1) {
          oldAssignee = mapKanbanAssigneeToEmployee(tasks[idx].assignee);
        }
        kanbanTasksRef.current = idx === -1
          ? [...tasks, task]
          : [...tasks.slice(0, idx), task, ...tasks.slice(idx + 1)];
      } else if (type === 'task_changed' && idx !== -1) {
        oldAssignee = mapKanbanAssigneeToEmployee(tasks[idx].assignee);
        kanbanTasksRef.current = [...tasks.slice(0, idx), task, ...tasks.slice(idx + 1)];
      }

      const newAssignee = mapKanbanAssigneeToEmployee(task.assignee);

      setEmployees((prev) => {
        let result = prev;
        if (newAssignee) {
          result = recalcKanbanStatus(result, kanbanTasksRef.current, newAssignee);
        }
        if (oldAssignee && oldAssignee !== newAssignee) {
          result = recalcKanbanStatus(result, kanbanTasksRef.current, oldAssignee);
        }
        return result;
      });

      setLastWsUpdate(new Date());
    }, []);

  const { wsStatus: currentWsStatus, reconnect, wsError: currentWsError } = useWs
    ? useKanbanWebSocket(handleWsEvent)
    : { wsStatus: 'polling' as const, reconnect: () => {}, wsError: null as string | null };

  useEffect(() => {
    if (!useWs) {
      setWsStatus('polling');
      return;
    }
    setWsStatus(currentWsStatus);

    if (currentWsStatus === 'disconnected' || currentWsStatus === 'reconnecting') {
      if (!pollingTimerRef.current) {
        pollingTimerRef.current = setInterval(refresh, 30_000);
      }
    } else if (currentWsStatus === 'connected') {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    }
  }, [currentWsStatus, useWs, refresh]);

  useEffect(() => {
    if (useWs) {
      setWsError(currentWsError);
    }
  }, [currentWsError, useWs]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (useWs) return;
    const timer = setInterval(refresh, 60_000);
    return () => clearInterval(timer);
  }, [refresh, useWs]);

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

  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, []);

  return { employees, lastUpdated, refresh, wsStatus, lastWsUpdate, wsError, reconnect };
}
