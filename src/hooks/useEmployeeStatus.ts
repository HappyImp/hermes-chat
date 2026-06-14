import { useState, useEffect, useCallback } from 'react';
import type { Employee } from '@/types/employee';
import {
  fetchCronJobs,
  mapJobNameToEmployee,
  deriveEmployeeStatus,
  fetchActiveEmployees,
} from '@/api/cronJobs';
import type { CronJob, ActiveEmployeeEntry } from '@/api/cronJobs';
import employeesData from '@/data/employees.json';

function validateEmployee(data: unknown): data is Employee {
  if (!data || typeof data !== 'object') return false;
  const emp = data as Record<string, unknown>;
  return (
    typeof emp.name === 'string' &&
    typeof emp.role === 'string' &&
    typeof emp.avatar === 'string' &&
    typeof emp.status === 'string' &&
    ['working', 'standby', 'off'].includes(emp.status) &&
    typeof emp.currentTask === 'string' &&
    Array.isArray(emp.tasks) &&
    emp.tasks.every((t: unknown) => typeof t === 'string')
  );
}

const typedEmployees: Employee[] = (employeesData.employees as unknown[])
  .filter(validateEmployee)
  .map((emp) => emp as Employee);

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

function mergeWithDefaults(defaults: Employee[], jobs: CronJob[]): Employee[] {
  const grouped = groupJobsByEmployee(jobs);

  return defaults.map((emp) => {
    const empJobs = grouped.get(emp.name);
    if (!empJobs || empJobs.length === 0) {
      return { ...emp, status: 'off' as const, currentTask: '休息中' };
    }
    const { status, currentTask } = deriveEmployeeStatus(empJobs);
    return { ...emp, status, currentTask };
  });
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
  const [employees, setEmployees] = useState<Employee[]>(typedEmployees);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const refresh = useCallback(async () => {
    try {
      const [jobs, active] = await Promise.all([
        fetchCronJobs(),
        fetchActiveEmployees(),
      ]);
      const merged = mergeWithDefaults(typedEmployees, jobs);
      setEmployees(mergeWithActive(merged, active));
    } catch {
      // On error, keep current state as fallback
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
