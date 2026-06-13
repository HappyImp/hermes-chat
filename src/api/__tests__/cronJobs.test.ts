import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchCronJobs, mapJobNameToEmployee, deriveEmployeeStatus } from '../cronJobs';
import type { CronJob } from '../cronJobs';

// Helper to create a minimal CronJob
function makeJob(overrides: Partial<CronJob> = {}): CronJob {
  return {
    id: 'test-id',
    name: 'test-job',
    enabled: true,
    state: 'scheduled',
    last_run_at: null,
    next_run_at: null,
    schedule: { kind: 'cron', expr: '0 9 * * *', display: '0 9 * * *' },
    last_status: null,
    ...overrides,
  };
}

describe('mapJobNameToEmployee', () => {
  it('maps 老财 jobs', () => {
    expect(mapJobNameToEmployee('老财-盘前研判')).toBe('老财');
    expect(mapJobNameToEmployee('老财-开盘异动')).toBe('老财');
  });

  it('maps 铁壳 jobs', () => {
    expect(mapJobNameToEmployee('铁壳日报')).toBe('铁壳');
  });

  it('maps 小K jobs', () => {
    expect(mapJobNameToEmployee('小K早报')).toBe('小K');
  });

  it('maps jobs containing 早报 to 小K', () => {
    expect(mapJobNameToEmployee('科技早报')).toBe('小K');
  });

  it('maps 404 jobs', () => {
    expect(mapJobNameToEmployee('404日报')).toBe('404');
    expect(mapJobNameToEmployee('404-employee-status-api')).toBe('404');
  });

  it('returns null for unknown job names', () => {
    expect(mapJobNameToEmployee('裁判君审查')).toBeNull();
    expect(mapJobNameToEmployee('random-task')).toBeNull();
  });
});

describe('deriveEmployeeStatus', () => {
  it('returns working when last_run_at is within 5 minutes', () => {
    const now = new Date('2026-06-14T10:00:00+08:00');
    const jobs = [
      makeJob({
        name: '老财-盘前研判',
        last_run_at: '2026-06-14T09:58:00+08:00',
      }),
    ];

    const result = deriveEmployeeStatus(jobs, now);
    expect(result.status).toBe('working');
    expect(result.currentTask).toBe('老财-盘前研判');
  });

  it('returns standby when next_run_at is within 30 minutes', () => {
    const now = new Date('2026-06-14T10:00:00+08:00');
    const jobs = [
      makeJob({
        name: '老财-开盘异动',
        next_run_at: '2026-06-14T10:20:00+08:00',
      }),
    ];

    const result = deriveEmployeeStatus(jobs, now);
    expect(result.status).toBe('standby');
    expect(result.currentTask).toBe('老财-开盘异动');
  });

  it('returns off when no jobs are recent or upcoming', () => {
    const now = new Date('2026-06-14T10:00:00+08:00');
    const jobs = [
      makeJob({
        name: '老财-盘前研判',
        last_run_at: '2026-06-14T08:00:00+08:00',
        next_run_at: '2026-06-15T09:25:00+08:00',
      }),
    ];

    const result = deriveEmployeeStatus(jobs, now);
    expect(result.status).toBe('off');
    expect(result.currentTask).toContain('老财-盘前研判');
  });

  it('picks the soonest standby job when multiple exist', () => {
    const now = new Date('2026-06-14T10:00:00+08:00');
    const jobs = [
      makeJob({
        name: '老财-午盘复盘',
        next_run_at: '2026-06-14T10:25:00+08:00',
      }),
      makeJob({
        name: '老财-开盘异动',
        next_run_at: '2026-06-14T10:10:00+08:00',
      }),
    ];

    const result = deriveEmployeeStatus(jobs, now);
    expect(result.status).toBe('standby');
    expect(result.currentTask).toBe('老财-开盘异动');
  });

  it('working takes priority over standby', () => {
    const now = new Date('2026-06-14T10:00:00+08:00');
    const jobs = [
      makeJob({
        name: '老财-盘前研判',
        last_run_at: '2026-06-14T09:58:00+08:00',
      }),
      makeJob({
        name: '老财-开盘异动',
        next_run_at: '2026-06-14T10:10:00+08:00',
      }),
    ];

    const result = deriveEmployeeStatus(jobs, now);
    expect(result.status).toBe('working');
  });

  it('returns off with 休息中 when no jobs at all', () => {
    const now = new Date('2026-06-14T10:00:00+08:00');
    const result = deriveEmployeeStatus([], now);
    expect(result.status).toBe('off');
    expect(result.currentTask).toBe('休息中');
  });

  it('ignores disabled jobs for standby', () => {
    const now = new Date('2026-06-14T10:00:00+08:00');
    const jobs = [
      makeJob({
        name: '老财-开盘异动',
        enabled: false,
        next_run_at: '2026-06-14T10:10:00+08:00',
      }),
    ];

    const result = deriveEmployeeStatus(jobs, now);
    expect(result.status).toBe('off');
  });
});

describe('fetchCronJobs', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns jobs on success', async () => {
    const mockResponse = { jobs: [makeJob()] };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const jobs = await fetchCronJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].name).toBe('test-job');
  });

  it('returns empty array on non-200 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Not Found', { status: 404 }));

    const jobs = await fetchCronJobs();
    expect(jobs).toEqual([]);
  });

  it('returns empty array on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));

    const jobs = await fetchCronJobs();
    expect(jobs).toEqual([]);
  });

  it('returns empty array when response has no jobs field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    const jobs = await fetchCronJobs();
    expect(jobs).toEqual([]);
  });
});
