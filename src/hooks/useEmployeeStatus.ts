import { useState, useEffect, useCallback } from 'react';
import type { Employee } from '@/types/employee';
import { fetchCronJobs, mapJobNameToEmployee, deriveEmployeeStatus } from '@/api/cronJobs';
import type { CronJob } from '@/api/cronJobs';
import employeesData from '@/data/employees.json';

/**
 * Runtime validation for employee data from JSON.
 * Ensures the data structure matches Employee type.
 */
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

/**
 * Group cron jobs by employee name using mapJobNameToEmployee.
 * Returns a Map of employeeName → CronJob[].
 */
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

/**
 * Merge API cron data with default employee data.
 * For each default employee:
 * - If they have matching cron jobs → derive status from jobs
 * - If no matching jobs → default to 'off' with '休息中'
 */
function mergeWithDefaults(defaults: Employee[], jobs: CronJob[]): Employee[] {
  const grouped = groupJobsByEmployee(jobs);

  return defaults.map((emp) => {
    const empJobs = grouped.get(emp.name);
    if (!empJobs || empJobs.length === 0) {
      // No cron jobs for this employee (e.g. 裁判君)
      return { ...emp, status: 'off' as const, currentTask: '休息中' };
    }
    const { status, currentTask } = deriveEmployeeStatus(empJobs);
    return { ...emp, status, currentTask };
  });
}

export function useEmployeeStatus() {
  const [employees, setEmployees] = useState<Employee[]>(typedEmployees);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const refresh = useCallback(async () => {
    try {
      const jobs = await fetchCronJobs();
      if (jobs.length > 0) {
        setEmployees(mergeWithDefaults(typedEmployees, jobs));
      }
      // If API returns empty, keep current state (fallback to defaults)
    } catch {
      // On error, keep current state as fallback
    }
    setLastUpdated(new Date());
  }, []);

  // Fetch on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const timer = setInterval(refresh, 60_000);
    return () => clearInterval(timer);
  }, [refresh]);

  return { employees, lastUpdated, refresh };
}
