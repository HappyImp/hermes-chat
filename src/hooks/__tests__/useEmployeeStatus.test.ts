import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useEmployeeStatus } from '../useEmployeeStatus';
import * as cronJobsApi from '@/api/cronJobs';

vi.mock('@/api/cronJobs', () => ({
  fetchCronJobs: vi.fn(),
  mapJobNameToEmployee: vi.fn(),
  deriveEmployeeStatus: vi.fn(),
  fetchActiveEmployees: vi.fn().mockResolvedValue({}),
}));

const mockFetchCronJobs = vi.mocked(cronJobsApi.fetchCronJobs);
const mockMapJobNameToEmployee = vi.mocked(cronJobsApi.mapJobNameToEmployee);
const mockDeriveEmployeeStatus = vi.mocked(cronJobsApi.deriveEmployeeStatus);
const mockFetchActiveEmployees = vi.mocked(cronJobsApi.fetchActiveEmployees);

describe('useEmployeeStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: API returns empty (fallback to all known employees)
    mockFetchCronJobs.mockResolvedValue([]);
    mockFetchActiveEmployees.mockResolvedValue({});
  });

  it('returns all known employees when API returns empty and no active entries', async () => {
    const { result } = renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      expect(result.current.employees.length).toBeGreaterThan(0);
    });
    // Should include all known employees from EMPLOYEE_META
    const names = result.current.employees.map(e => e.name);
    expect(names).toContain('老财');
    expect(names).toContain('铁壳');
    expect(names).toContain('小K');
    expect(names).toContain('404');
    expect(names).toContain('裁判君');
    expect(names).toContain('Ditto');
  });

  it('returns a lastUpdated date', async () => {
    const { result } = renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      expect(result.current.lastUpdated).toBeInstanceOf(Date);
    });
  });

  it('calls fetchCronJobs on mount', async () => {
    renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      expect(mockFetchCronJobs).toHaveBeenCalledTimes(1);
    });
  });

  it('shows employees from cron jobs', async () => {
    const mockJobs = [
      {
        id: '1',
        name: '老财-盘前研判',
        enabled: true,
        state: 'scheduled',
        last_run_at: new Date().toISOString(),
        next_run_at: null,
        schedule: { kind: 'cron', expr: '25 9 * * 1-5', display: '25 9 * * 1-5' },
        last_status: null,
      },
    ];

    mockFetchCronJobs.mockResolvedValue(mockJobs);
    mockMapJobNameToEmployee.mockImplementation((name: string) => {
      if (name.includes('老财')) return '老财';
      return null;
    });
    mockDeriveEmployeeStatus.mockReturnValue({
      status: 'working',
      currentTask: '老财-盘前研判',
    });

    const { result } = renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      expect(mockFetchCronJobs).toHaveBeenCalled();
    });

    // Should include 老财 from cron jobs + all other known employees
    const names = result.current.employees.map(e => e.name);
    expect(names).toContain('老财');
    expect(names).toContain('Ditto');
  });

  it('updates lastUpdated on refresh', async () => {
    const { result } = renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      expect(result.current.lastUpdated).toBeInstanceOf(Date);
    });
    const before = result.current.lastUpdated.getTime();
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.lastUpdated.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('refresh calls fetchCronJobs again', async () => {
    const { result } = renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      expect(mockFetchCronJobs).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      await result.current.refresh();
    });
    expect(mockFetchCronJobs).toHaveBeenCalledTimes(2);
  });

  it('falls back to all known employees on API error', async () => {
    mockFetchCronJobs.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      expect(result.current.employees.length).toBeGreaterThan(0);
    });
    const names = result.current.employees.map(e => e.name);
    expect(names).toContain('Ditto');
  });

  it('includes employees from active entries', async () => {
    mockFetchCronJobs.mockResolvedValue([]);
    mockFetchActiveEmployees.mockResolvedValue({
      'Ditto': { task: '测试中', startedAt: '2026-06-14T10:00:00Z' },
    });

    const { result } = renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      const ditto = result.current.employees.find(e => e.name === 'Ditto');
      expect(ditto).toBeDefined();
      expect(ditto?.status).toBe('working');
      expect(ditto?.currentTask).toBe('测试中');
    });
  });
});
