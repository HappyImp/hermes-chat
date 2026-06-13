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

/**
 * Map a cron job name to an employee name.
 * Returns null if no match.
 */
export function mapJobNameToEmployee(jobName: string): string | null {
  if (jobName.includes('老财')) return '老财';
  if (jobName.includes('铁壳')) return '铁壳';
  if (jobName.includes('小K') || jobName.includes('早报')) return '小K';
  if (jobName.includes('404')) return '404';
  return null;
}

/**
 * Derive an employee's working status from their cron jobs.
 *
 * Rules:
 * - Any job with last_run_at within 5 minutes → 'working'
 * - Any job with next_run_at within 30 minutes → 'standby'
 * - Otherwise → 'off'
 */
export function deriveEmployeeStatus(
  jobs: CronJob[],
  now: Date = new Date(),
): { status: 'working' | 'standby' | 'off'; currentTask: string } {
  const FIVE_MIN = 5 * 60 * 1000;
  const THIRTY_MIN = 30 * 60 * 1000;

  // Check if any job recently ran (working)
  for (const job of jobs) {
    if (job.last_run_at) {
      const lastRun = new Date(job.last_run_at).getTime();
      if (now.getTime() - lastRun < FIVE_MIN) {
        return { status: 'working', currentTask: job.name };
      }
    }
  }

  // Check if any job is about to run (standby)
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

  // Find the next upcoming job for display
  for (const job of jobs) {
    if (job.next_run_at && job.enabled) {
      const nextRun = new Date(job.next_run_at).getTime();
      if (nextRun < soonestTime) {
        soonestTime = nextRun;
        soonestJob = job;
      }
    }
  }

  const currentTask = soonestJob ? `下次: ${soonestJob.name}` : '休息中';
  return { status: 'off', currentTask };
}
