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

describe('useEmployeeStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: API returns empty (fallback to static data)
    mockFetchCronJobs.mockResolvedValue([]);
  });

  it('returns 5 employees from default data when API returns empty', async () => {
    const { result } = renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      expect(result.current.employees).toHaveLength(5);
    });
    expect(result.current.employees[0].name).toBe('老财');
    expect(result.current.employees[4].name).toBe('裁判君');
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

  it('falls back to default employees when API returns empty', async () => {
    mockFetchCronJobs.mockResolvedValue([]);
    const { result } = renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      expect(result.current.employees).toHaveLength(5);
    });
    // Default data has 老财 as 'working' from JSON
    expect(result.current.employees[0].name).toBe('老财');
  });

  it('maps API jobs to employee status', async () => {
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
      {
        id: '2',
        name: '铁壳日报',
        enabled: true,
        state: 'scheduled',
        last_run_at: null,
        next_run_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        schedule: { kind: 'cron', expr: '0 12 * * *', display: '0 12 * * *' },
        last_status: null,
      },
    ];

    mockFetchCronJobs.mockResolvedValue(mockJobs);
    mockMapJobNameToEmployee.mockImplementation((name: string) => {
      if (name.includes('老财')) return '老财';
      if (name.includes('铁壳')) return '铁壳';
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

    // Should still have 5 employees (merged with defaults)
    expect(result.current.employees).toHaveLength(5);
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

  it('falls back to defaults on API error', async () => {
    mockFetchCronJobs.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useEmployeeStatus());
    // fetchCronJobs catches errors internally and returns [],
    // but let's test the case where it throws unexpectedly
    await waitFor(() => {
      expect(result.current.employees).toHaveLength(5);
    });
  });
});
