import { useState, useEffect, useCallback } from 'react';
import type { Employee } from '@/types/employee';
import {
  fetchCronJobs,
  mapJobNameToEmployee,
  deriveEmployeeStatus,
  fetchActiveEmployees,
} from '@/api/cronJobs';
import type { CronJob, ActiveEmployeeEntry } from '@/api/cronJobs';

/** Default employee metadata (role, avatar, tasks) for known employees */
const EMPLOYEE_META: Record<string, { role: string; avatar: string; tasks: string[] }> = {
  '老财': { role: 'AI操盘手', avatar: '💰', tasks: ['盘前研判', '开盘异动', '午盘复盘', '尾盘异动', '每晚复盘'] },
  '铁壳': { role: 'AI运维工程师', avatar: '🤖', tasks: ['每日日报', '运维护航'] },
  '小K': { role: 'AI情报员', avatar: '🔍', tasks: ['每日早报'] },
  '404': { role: 'AI开发工程师', avatar: '💻', tasks: ['每日日报', '开发任务'] },
  '裁判君': { role: 'AI审查官', avatar: '⚖️', tasks: ['按需审查'] },
  'Ditto': { role: 'AI测试工程师', avatar: '🧪', tasks: ['线上测试'] },
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
 * Active entries override 'standby'/'off' to 'working'.
 */
export function mergeWithActive(
  employees: Employee[],
  active: Record<string, ActiveEmployeeEntry>,
): Employee[] {
  const keys = Object.keys(active);
  if (keys.length === 0) return employees;
  const activeNames = new Set(keys);
  return employees.map((emp) =>
    activeNames.has(emp.name)
      ? { ...emp, status: 'working' as const, currentTask: active[emp.name].task }
      : emp,
  );
}

export function useEmployeeStatus() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const refresh = useCallback(async () => {
    try {
      const [jobs, active] = await Promise.all([
        fetchCronJobs(),
        fetchActiveEmployees(),
      ]);

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
      setEmployees(mergeWithActive(merged, active));
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

  return { employees, lastUpdated, refresh };
}
