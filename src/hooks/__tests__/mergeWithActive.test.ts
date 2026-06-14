import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEmployeeStatus, mergeWithActive } from '../useEmployeeStatus';
import type { Employee } from '@/types/employee';
import * as cronJobsApi from '@/api/cronJobs';

vi.mock('@/api/cronJobs', () => ({
  fetchCronJobs: vi.fn(),
  mapJobNameToEmployee: vi.fn(),
  deriveEmployeeStatus: vi.fn(),
  fetchActiveEmployees: vi.fn(),
}));

const mockFetchCronJobs = vi.mocked(cronJobsApi.fetchCronJobs);
const mockFetchActiveEmployees = vi.mocked(cronJobsApi.fetchActiveEmployees);

const makeEmployee = (overrides: Partial<Employee> = {}): Employee => ({
  name: '测试',
  role: '测试员',
  avatar: '🧪',
  status: 'off',
  currentTask: '休息中',
  tasks: [],
  ...overrides,
});

describe('mergeWithActive', () => {
  it('returns same array when active is empty', () => {
    const employees = [makeEmployee({ name: '404' })];
    expect(mergeWithActive(employees, {})).toBe(employees);
  });

  it('upgrades standby employee to working', () => {
    const employees = [makeEmployee({ name: '404', status: 'standby' })];
    const result = mergeWithActive(employees, {
      404: { task: '修 bug', startedAt: '2026-06-14T10:00:00Z' },
    });
    expect(result[0].status).toBe('working');
    expect(result[0].currentTask).toBe('修 bug');
  });

  it('upgrades off employee to working', () => {
    const employees = [makeEmployee({ name: '裁判君', status: 'off' })];
    const result = mergeWithActive(employees, {
      裁判君: { task: '审查代码', startedAt: '2026-06-14T10:00:00Z' },
    });
    expect(result[0].status).toBe('working');
    expect(result[0].currentTask).toBe('审查代码');
  });

  it('keeps working employee working with active task', () => {
    const employees = [makeEmployee({ name: '老财', status: 'working', currentTask: '旧任务' })];
    const result = mergeWithActive(employees, {
      老财: { task: '新任务', startedAt: '2026-06-14T10:00:00Z' },
    });
    expect(result[0].status).toBe('working');
    expect(result[0].currentTask).toBe('新任务');
  });

  it('does not modify non-active employees', () => {
    const employees = [
      makeEmployee({ name: '老财' }),
      makeEmployee({ name: '铁壳' }),
    ];
    const result = mergeWithActive(employees, {
      老财: { task: '分析', startedAt: '2026-06-14T10:00:00Z' },
    });
    expect(result[1]).toEqual(employees[1]);
  });

  it('handles multiple active employees', () => {
    const employees = [
      makeEmployee({ name: '老财' }),
      makeEmployee({ name: '铁壳' }),
      makeEmployee({ name: '404' }),
    ];
    const result = mergeWithActive(employees, {
      老财: { task: '复盘', startedAt: '2026-06-14T21:00:00Z' },
      404: { task: '开发', startedAt: '2026-06-14T10:00:00Z' },
    });
    expect(result[0].status).toBe('working');
    expect(result[1].status).toBe('off');
    expect(result[2].status).toBe('working');
  });

  it('preserves other fields unchanged', () => {
    const employees = [makeEmployee({ name: '404', role: '开发', avatar: '💻' })];
    const result = mergeWithActive(employees, {
      404: { task: '任务', startedAt: '2026-06-14T10:00:00Z' },
    });
    expect(result[0].role).toBe('开发');
    expect(result[0].avatar).toBe('💻');
  });
});

describe('useEmployeeStatus with active employees', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchCronJobs.mockResolvedValue([]);
    mockFetchActiveEmployees.mockResolvedValue({});
  });

  it('fetches active employees on mount', async () => {
    renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      expect(mockFetchActiveEmployees).toHaveBeenCalledTimes(1);
    });
  });

  it('merges active employee into working status', async () => {
    mockFetchActiveEmployees.mockResolvedValue({
      裁判君: { task: '审查PR', startedAt: '2026-06-14T10:00:00Z' },
    });

    const { result } = renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      const judge = result.current.employees.find((e) => e.name === '裁判君');
      expect(judge?.status).toBe('working');
      expect(judge?.currentTask).toBe('审查PR');
    });
  });

  it('keeps non-active employees unchanged', async () => {
    mockFetchActiveEmployees.mockResolvedValue({
      404: { task: '写代码', startedAt: '2026-06-14T10:00:00Z' },
    });

    const { result } = renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      const judge = result.current.employees.find((e) => e.name === '裁判君');
      expect(judge?.status).toBe('off');
    });
  });
});
