import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useEmployeeStatus, mergeWithActive, mergeWithKanban } from '../useEmployeeStatus';
import type { Employee, KanbanTask } from '@/types/employee';
import * as cronJobsApi from '@/api/cronJobs';
import * as kanbanApi from '@/api/kanban';
import * as employeeMapping from '@/config/employeeMapping';

vi.mock('@/config/employeeMapping', () => ({
  EMPLOYEE_META: {
    '老财': { role: 'AI操盘手', avatar: '💰', tasks: ['盘前研判'], aliases: ['老财', 'laocai'] },
    '铁壳': { role: 'AI运维工程师', avatar: '🤖', tasks: ['运维护航'], aliases: ['铁壳', 'tieke'] },
    '小K': { role: 'AI情报员', avatar: '🔍', tasks: ['每日早报'], aliases: ['小k', 'xiaok'] },
    '404': { role: 'AI开发工程师', avatar: '💻', tasks: ['开发任务'], aliases: ['404', 'coder-404'] },
    '裁判君': { role: 'AI审查官', avatar: '⚖️', tasks: ['按需审查'], aliases: ['裁判', '裁判君', 'reviewer', 'referee'] },
    'Ditto': { role: 'AI测试工程师', avatar: '🧪', tasks: ['线上测试'], aliases: ['ditto'] },
  },
  resolveCronJobName: vi.fn(),
}));

vi.mock('@/api/cronJobs', () => ({
  fetchCronJobs: vi.fn(),
  mapJobNameToEmployee: vi.fn(),
  deriveEmployeeStatus: vi.fn(),
  fetchActiveEmployees: vi.fn().mockResolvedValue({}),
  checkProcessAlive: vi.fn(),
}));

vi.mock('@/api/kanban', () => ({
  fetchKanbanTasks: vi.fn().mockResolvedValue([]),
  fetchKanbanTask: vi.fn(),
  fetchKanbanStats: vi.fn(),
  fetchKanbanEmployees: vi.fn(),
  KanbanWebSocket: vi.fn(),
  getKanbanWsUrl: vi.fn(),
  groupKanbanTasksByEmployee: vi.fn().mockReturnValue(new Map()),
  deriveKanbanTaskStatus: vi.fn(),
  mapKanbanAssigneeToEmployee: vi.fn(),
}));

const mockFetchCronJobs = vi.mocked(cronJobsApi.fetchCronJobs);
const mockDeriveEmployeeStatus = vi.mocked(cronJobsApi.deriveEmployeeStatus);
const mockFetchActiveEmployees = vi.mocked(cronJobsApi.fetchActiveEmployees);
const mockResolveCronJobName = vi.mocked(employeeMapping.resolveCronJobName);
const mockFetchKanbanTasks = vi.mocked(kanbanApi.fetchKanbanTasks);
const mockGroupKanbanTasksByEmployee = vi.mocked(kanbanApi.groupKanbanTasksByEmployee);
const mockDeriveKanbanTaskStatus = vi.mocked(kanbanApi.deriveKanbanTaskStatus);

const makeEmployee = (overrides: Partial<Employee> = {}): Employee => ({
  name: '测试',
  role: '测试员',
  avatar: '🧪',
  status: 'off',
  currentTask: '休息中',
  tasks: [],
  ...overrides,
});

const makeKanbanTask = (overrides: Partial<KanbanTask> = {}): KanbanTask => ({
  id: 't_test',
  title: '测试任务',
  status: 'todo',
  assignee: 'coder-404',
  priority: '0',
  created_at: 1750000000,
  started_at: 1750000000,
  ...overrides,
});

describe('mergeWithActive', () => {
  it('returns same array when active is empty', () => {
    const employees = [makeEmployee({ name: '404' })];
    expect(mergeWithActive(employees, {})).toBe(employees);
  });

  it('upgrades standby employee to working when status is working', () => {
    const employees = [makeEmployee({ name: '404', status: 'standby' })];
    const result = mergeWithActive(employees, {
      404: { task: '修 bug', startedAt: '2026-06-14T10:00:00Z', status: 'working' },
    });
    expect(result[0].status).toBe('working');
    expect(result[0].currentTask).toBe('修 bug');
  });

  it('upgrades off employee to working when status is working', () => {
    const employees = [makeEmployee({ name: '裁判君', status: 'off' })];
    const result = mergeWithActive(employees, {
      裁判君: { task: '审查代码', startedAt: '2026-06-14T10:00:00Z', status: 'working' },
    });
    expect(result[0].status).toBe('working');
    expect(result[0].currentTask).toBe('审查代码');
  });

  it('keeps working employee working with active task', () => {
    const employees = [makeEmployee({ name: '老财', status: 'working', currentTask: '旧任务' })];
    const result = mergeWithActive(employees, {
      老财: { task: '新任务', startedAt: '2026-06-14T10:00:00Z', status: 'working' },
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
      老财: { task: '分析', startedAt: '2026-06-14T10:00:00Z', status: 'working' },
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
      老财: { task: '复盘', startedAt: '2026-06-14T21:00:00Z', status: 'working' },
      404: { task: '开发', startedAt: '2026-06-14T10:00:00Z', status: 'working' },
    });
    expect(result[0].status).toBe('working');
    expect(result[1].status).toBe('off');
    expect(result[2].status).toBe('working');
  });

  it('preserves other fields unchanged', () => {
    const employees = [makeEmployee({ name: '404', role: '开发', avatar: '💻' })];
    const result = mergeWithActive(employees, {
      404: { task: '任务', startedAt: '2026-06-14T10:00:00Z', status: 'working' },
    });
    expect(result[0].role).toBe('开发');
    expect(result[0].avatar).toBe('💻');
  });

  it('does not override status when active entry is completed', () => {
    const employees = [makeEmployee({ name: '老财', status: 'off', currentTask: '休息中' })];
    const result = mergeWithActive(employees, {
      老财: { task: '已完成任务', startedAt: '2026-06-14T10:00:00Z', status: 'completed' },
    });
    expect(result[0].status).toBe('off');
    expect(result[0].currentTask).toBe('休息中');
  });

  it('marks as completed when pid exists but process is dead', () => {
    const employees = [makeEmployee({ name: '铁壳', status: 'working', currentTask: '部署' })];
    const result = mergeWithActive(
      employees,
      { 铁壳: { task: '部署', startedAt: '2026-06-14T10:00:00Z', pid: 12345 } },
      { 12345: false },
    );
    expect(result[0].status).toBe('completed');
    expect(result[0].currentTask).toBe('部署');
  });

  it('sets working when pid is alive and no explicit status', () => {
    const employees = [makeEmployee({ name: '404', status: 'standby' })];
    const result = mergeWithActive(
      employees,
      { 404: { task: '开发功能', startedAt: '2026-06-14T10:00:00Z', pid: 999 } },
      { 999: true },
    );
    expect(result[0].status).toBe('working');
    expect(result[0].currentTask).toBe('开发功能');
  });

  it('treats legacy entries without status field as working', () => {
    const employees = [makeEmployee({ name: '小K', status: 'off' })];
    const result = mergeWithActive(employees, {
      小K: { task: '写早报', startedAt: '2026-06-14T09:00:00Z' },
    });
    expect(result[0].status).toBe('working');
    expect(result[0].currentTask).toBe('写早报');
  });
});

describe('mergeWithKanban', () => {
  it('returns same array when kanban map is empty', () => {
    const employees = [makeEmployee({ name: '404' })];
    const result = mergeWithKanban(employees, new Map());
    expect(result).toBe(employees);
  });

  it('upgrades off employee to working when kanban has doing task', () => {
    const employees = [makeEmployee({ name: '404', status: 'off' })];
    const kanbanTasks = [makeKanbanTask({ status: 'doing', title: '修 Bug' })];
    const kanbanMap = new Map([['404', kanbanTasks]]);
    mockDeriveKanbanTaskStatus.mockReturnValue({
      status: 'working',
      currentTask: '修 Bug',
      pendingCount: 0,
      completedCount: 0,
      runningCount: 1,
    });

    const result = mergeWithKanban(employees, kanbanMap);
    expect(result[0].status).toBe('working');
    expect(result[0].currentTask).toBe('修 Bug');
    expect(result[0].taskCount).toBe(1);
    expect(result[0].kanbanStatus).toBe('doing');
  });

  it('does not downgrade working employee to standby', () => {
    const employees = [makeEmployee({ name: '404', status: 'working', currentTask: '活跃任务' })];
    const kanbanTasks = [makeKanbanTask({ status: 'todo', title: '待办任务' })];
    const kanbanMap = new Map([['404', kanbanTasks]]);
    mockDeriveKanbanTaskStatus.mockReturnValue({
      status: 'standby',
      currentTask: '待处理: 1 个任务',
      pendingCount: 1,
      completedCount: 0,
      runningCount: 0,
    });

    const result = mergeWithKanban(employees, kanbanMap);
    expect(result[0].status).toBe('working');
    expect(result[0].currentTask).toBe('活跃任务');
  });

  it('upgrades off employee to standby when kanban has todo tasks', () => {
    const employees = [makeEmployee({ name: '裁判君', status: 'off' })];
    const kanbanTasks = [makeKanbanTask({ status: 'todo', title: '审查任务', assignee: 'reviewer' })];
    const kanbanMap = new Map([['裁判君', kanbanTasks]]);
    mockDeriveKanbanTaskStatus.mockReturnValue({
      status: 'standby',
      currentTask: '待处理: 1 个任务',
      pendingCount: 1,
      completedCount: 0,
      runningCount: 0,
    });

    const result = mergeWithKanban(employees, kanbanMap);
    expect(result[0].status).toBe('standby');
    expect(result[0].kanbanStatus).toBe('todo');
  });

  it('attaches kanban fields without changing status when all done', () => {
    const employees = [makeEmployee({ name: '404', status: 'standby' })];
    const kanbanTasks = [makeKanbanTask({ status: 'done', title: '完成的任务' })];
    const kanbanMap = new Map([['404', kanbanTasks]]);
    mockDeriveKanbanTaskStatus.mockReturnValue({
      status: 'off',
      currentTask: '已完成 1 项',
      pendingCount: 0,
      completedCount: 1,
      runningCount: 0,
    });

    const result = mergeWithKanban(employees, kanbanMap);
    expect(result[0].status).toBe('standby'); // unchanged
    expect(result[0].taskCount).toBe(1);
    expect(result[0].kanbanStatus).toBe('done');
  });

  it('does not modify employees without kanban tasks', () => {
    const employees = [
      makeEmployee({ name: '404', status: 'off' }),
      makeEmployee({ name: '老财', status: 'off' }),
    ];
    const kanbanTasks = [makeKanbanTask({ status: 'doing', title: '任务' })];
    const kanbanMap = new Map([['404', kanbanTasks]]);
    mockDeriveKanbanTaskStatus.mockReturnValue({
      status: 'working',
      currentTask: '任务',
      pendingCount: 0,
      completedCount: 0,
      runningCount: 1,
    });

    const result = mergeWithKanban(employees, kanbanMap);
    expect(result[1]).toEqual(employees[1]);
  });
});

describe('useEmployeeStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchCronJobs.mockResolvedValue([]);
    mockFetchActiveEmployees.mockResolvedValue({});
    mockFetchKanbanTasks.mockResolvedValue([]);
    mockGroupKanbanTasksByEmployee.mockReturnValue(new Map());
  });

  it('returns all known employees when API returns empty', async () => {
    const { result } = renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      expect(result.current.employees.length).toBeGreaterThan(0);
    });
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

  it('calls fetchCronJobs and fetchKanbanTasks on mount', async () => {
    renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      expect(mockFetchCronJobs).toHaveBeenCalledTimes(1);
      expect(mockFetchKanbanTasks).toHaveBeenCalledTimes(1);
    });
  });

  it('shows employees from cron jobs', async () => {
    const mockJobs = [{
      id: '1',
      name: '老财-盘前研判',
      enabled: true,
      state: 'scheduled',
      last_run_at: new Date().toISOString(),
      next_run_at: null,
      schedule: { kind: 'cron', expr: '25 9 * * 1-5', display: '25 9 * * 1-5' },
      last_status: null,
    }];

    mockFetchCronJobs.mockResolvedValue(mockJobs);
    mockResolveCronJobName.mockImplementation((name: string) => {
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

    const names = result.current.employees.map(e => e.name);
    expect(names).toContain('老财');
    expect(names).toContain('Ditto');
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

  it('refreshes when page becomes visible', async () => {
    renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      expect(mockFetchCronJobs).toHaveBeenCalledTimes(1);
    });

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(mockFetchCronJobs).toHaveBeenCalledTimes(2);
    });
  });

  it('refreshes on window focus event', async () => {
    renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      expect(mockFetchCronJobs).toHaveBeenCalledTimes(1);
    });

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(mockFetchCronJobs).toHaveBeenCalledTimes(2);
    });
  });

  it('does NOT refresh when visibility changes to hidden', async () => {
    renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      expect(mockFetchCronJobs).toHaveBeenCalledTimes(1);
    });

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(mockFetchCronJobs).toHaveBeenCalledTimes(1);
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

  it('includes kanban task counts when kanban data available', async () => {
    const kanbanTasks = [makeKanbanTask({ status: 'doing', assignee: 'coder-404' })];
    mockFetchKanbanTasks.mockResolvedValue(kanbanTasks);
    mockGroupKanbanTasksByEmployee.mockReturnValue(
      new Map([['404', kanbanTasks]]),
    );
    mockDeriveKanbanTaskStatus.mockReturnValue({
      status: 'working',
      currentTask: '测试任务',
      pendingCount: 0,
      completedCount: 0,
      runningCount: 1,
    });

    const { result } = renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      const emp404 = result.current.employees.find(e => e.name === '404');
      expect(emp404).toBeDefined();
      expect(emp404?.taskCount).toBe(1);
      expect(emp404?.kanbanStatus).toBe('doing');
    });
  });
});
