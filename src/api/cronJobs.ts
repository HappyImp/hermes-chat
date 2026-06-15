import { resolveCronJobName as resolveCronJobNameShared } from '@/config/employeeMapping';

/** Active employee entry from shell hooks file. */
export interface ActiveEmployeeEntry {
  task: string;
  startedAt: string;
  status?: 'working' | 'completed' | 'failed' | 'timeout';
  pid?: number;
}

/** Raw cronjob data from Hermes API */
export interface CronJob {
  id: string;
  name: string;
  enabled: boolean;
  state: string;
  last_run_at: string | null;
  next_run_at: string | null;
  schedule: {
    kind: string;
    expr: string;
    display: string;
  };
  last_status: string | null;
}

interface CronJobsResponse {
  jobs: CronJob[];
}

const API_BASE = '/chat/api';

/**
 * Fetch all cron jobs from Hermes API.
 * Returns empty array on failure (network error, non-200, etc.)
 */
export async function fetchCronJobs(): Promise<CronJob[]> {
  try {
    const res = await fetch(`${API_BASE}/jobs`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return [];
    const data: CronJobsResponse = await res.json();
    return data.jobs ?? [];
  } catch {
    return [];
  }
}

/** Map a cron job name to an employee name.
 * Returns null if no match.
 *
 * Delegates to shared config (resolveCronJobName).
 */
export function mapJobNameToEmployee(jobName: string): string | null {
  return resolveCronJobNameShared(jobName);
}

/**
 * Derive an employee's working status from their cron jobs.
 *
 * Rules:
 * - Any job with state === 'running' → 'working'
 * - Any job with next_run_at within 30 minutes → 'standby' (high priority)
 * - Any enabled job with next_run_at → 'standby' (waiting for next run)
 * - Otherwise → 'off'
 */
export function deriveEmployeeStatus(
  jobs: CronJob[],
  now: Date = new Date(),
): { status: 'working' | 'standby' | 'off'; currentTask: string } {
  const THIRTY_MIN = 30 * 60 * 1000;

  // Check if any job is currently running
  for (const job of jobs) {
    if (job.state === 'running') {
      return { status: 'working', currentTask: job.name };
    }
  }

  // Check if any job is about to run (standby, high priority)
  let soonestJob: CronJob | null = null;
  let soonestTime = Infinity;

  for (const job of jobs) {
    if (job.next_run_at && job.enabled) {
      const nextRun = new Date(job.next_run_at).getTime();
      const diff = nextRun - now.getTime();
      if (diff > 0 && diff < THIRTY_MIN && nextRun < soonestTime) {
        soonestTime = nextRun;
        soonestJob = job;
      }
    }
  }

  if (soonestJob) {
    return { status: 'standby', currentTask: soonestJob.name };
  }

  // Any enabled job with a future schedule → standby (employee is on duty)
  for (const job of jobs) {
    if (job.enabled && job.next_run_at) {
      const nextRun = new Date(job.next_run_at).getTime();
      if (nextRun < soonestTime) {
        soonestTime = nextRun;
        soonestJob = job;
      }
    }
  }

  if (soonestJob) {
    const nextDate = new Date(soonestTime);
    const timeStr = nextDate.toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    return { status: 'standby', currentTask: `下次: ${timeStr}` };
  }

  return { status: 'off', currentTask: '休息中' };
}

/**
 * Fetch active employees from shell hooks status file.
 * Production: reads static file /chat/data/employees-active.json (Nginx serves directly).
 * Dev: Vite middleware intercepts and reads /tmp/employees-active.json.
 * Returns empty object if file doesn't exist (not an error).
 */
export async function fetchActiveEmployees(): Promise<
  Record<string, ActiveEmployeeEntry>
> {
  try {
    const res = await fetch('/chat/data/employees-active.json');
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

/**
 * Check if a process is still alive by pid.
 * Hits the backend's /api/process/alive endpoint.
 * Returns false if the endpoint is unavailable or the process is dead.
 */
export async function checkProcessAlive(pid: number): Promise<boolean> {
  try {
    const res = await fetch(`/api/process/alive?pid=${pid}`);
    if (!res.ok) return false;
    const data = await res.json();
    return data.alive === true;
  } catch {
    return false;
  }
}