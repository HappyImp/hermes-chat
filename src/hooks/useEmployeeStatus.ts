import { useState, useEffect, useCallback } from 'react';
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
} from '@/api/kanban';
import type { KanbanTask } from '@/types/employee';
import { EMPLOYEE_META, resolveCronJobName } from '@/config/employeeMapping';

/** Default employee metadata (role, avatar, tasks) for known employees */
// EMPLOYEE_META now imported from @/config/employeeMapping

/** Create a default employee object for a given name */
function createDefaultEmployee(name: string): Employee {
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

function groupJobsByEmployee(jobs: CronJob[]): Map<string, CronJob[]> {
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
function extractEmployeesFromJobs(jobs: CronJob[]): string[] {
  const names = new Set<string>();
  for (const job of jobs) {
    const name = resolveCronJobName(job.name);
    if (name) names.add(name);
  }
  return Array.from(names);
}

/** Extract unique employee names from kanban tasks */
function extractEmployeesFromKanban(tasks: KanbanTask[]): string[] {
  const grouped = groupKanbanTasksByEmployee(tasks);
  return Array.from(grouped.keys());
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

  const refresh = useCallback(async () => {
    try {
      const [jobs, active, kanbanTasks] = await Promise.all([
        fetchCronJobs(),
        fetchActiveEmployees(),
        fetchKanbanTasks(),
      ]);

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

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
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
