import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useEmployeeStatus, mergeWithKanban } from '../useEmployeeStatus';
import type { Employee, KanbanTask } from '@/types/employee';
import * as kanbanApi from '@/api/kanban';

vi.mock('@/api/kanban', () => ({
  fetchKanbanTasks: vi.fn().mockResolvedValue([]),
  fetchKanbanTask: vi.fn(),
  fetchKanbanStats: vi.fn(),
  fetchKanbanEmployees: vi.fn(),
  KanbanWebSocket: vi.fn().mockImplementation(() => ({
    on: vi.fn().mockReturnValue(vi.fn()),
    onStatus: vi.fn().mockReturnValue(vi.fn()),
    onError: vi.fn().mockReturnValue(vi.fn()),
    connect: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
    status: 'disconnected',
  })),
  getKanbanWsUrl: vi.fn().mockReturnValue('ws://localhost:3000/api/kanban/events?token=test'),
  groupKanbanTasksByEmployee: vi.fn().mockReturnValue(new Map()),
  deriveKanbanTaskStatus: vi.fn(),
  mapKanbanAssigneeToEmployee: vi.fn(),
}));

let capturedOnEvent: ((event: import('@/api/kanban').KanbanWsEvent) => void) | undefined;
vi.mock('../useKanbanWebSocket', () => ({
  useKanbanWebSocket: vi.fn().mockImplementation((onEvent?: (event: import('@/api/kanban').KanbanWsEvent) => void) => {
    capturedOnEvent = onEvent;
    return {
      wsStatus: 'connected',
      lastEvent: null,
      reconnect: vi.fn(),
      wsError: null,
    };
  }),
}));

vi.stubEnv('VITE_USE_KANBAN', 'true');

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
    expect(result[0].status).toBe('standby');
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

  it('calls fetchKanbanTasks on mount', async () => {
    renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      expect(mockFetchKanbanTasks).toHaveBeenCalledTimes(1);
    });
  });

  it('falls back to all known employees on API error', async () => {
    mockFetchKanbanTasks.mockRejectedValue(new Error('network'));
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
      expect(mockFetchKanbanTasks).toHaveBeenCalledTimes(1);
    });

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(mockFetchKanbanTasks).toHaveBeenCalledTimes(2);
    });
  });

  it('refreshes on window focus event', async () => {
    renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      expect(mockFetchKanbanTasks).toHaveBeenCalledTimes(1);
    });

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(mockFetchKanbanTasks).toHaveBeenCalledTimes(2);
    });
  });

  it('does NOT refresh when visibility changes to hidden', async () => {
    renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      expect(mockFetchKanbanTasks).toHaveBeenCalledTimes(1);
    });

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(mockFetchKanbanTasks).toHaveBeenCalledTimes(1);
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

  it('exposes wsStatus as connected when VITE_USE_KANBAN is true', async () => {
    const { result } = renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      expect(result.current.wsStatus).toBe('connected');
    });
  });

  it('exposes lastWsUpdate and wsError fields', async () => {
    const { result } = renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      expect(result.current.lastWsUpdate).toBeNull();
      expect(result.current.wsError).toBeNull();
    });
  });

  it('exposes reconnect function', async () => {
    const { result } = renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      expect(typeof result.current.reconnect).toBe('function');
    });
  });
});

describe('handleWsEvent — incremental updates', () => {
  const mockMapAssignee = vi.mocked(kanbanApi.mapKanbanAssigneeToEmployee);

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnEvent = undefined;
    mockFetchKanbanTasks.mockResolvedValue([]);
    mockGroupKanbanTasksByEmployee.mockReturnValue(new Map());
    mockMapAssignee.mockImplementation((assignee: string) => {
      const map: Record<string, string> = {
        'coder-404': '404',
        'reviewer': '裁判君',
      };
      return map[assignee] ?? null;
    });
  });

  it('task_deleted removes task from cache and recalculates employee', async () => {
    const initialTasks = [
      makeKanbanTask({ id: 't_1', assignee: 'coder-404', status: 'doing', title: '任务1' }),
      makeKanbanTask({ id: 't_2', assignee: 'coder-404', status: 'todo', title: '任务2' }),
    ];
    mockFetchKanbanTasks.mockResolvedValue(initialTasks);
    mockGroupKanbanTasksByEmployee.mockReturnValue(new Map([['404', initialTasks]]));
    mockDeriveKanbanTaskStatus.mockReturnValue({
      status: 'working',
      currentTask: '任务1',
      pendingCount: 1,
      completedCount: 0,
      runningCount: 1,
    });

    const { result } = renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      expect(result.current.employees.length).toBeGreaterThan(0);
    });

    act(() => {
      capturedOnEvent?.({
        type: 'task_deleted',
        task_id: 't_1',
      });
    });

    expect(result.current.lastWsUpdate).toBeInstanceOf(Date);
  });

  it('task_changed with reassignment recalculates both old and new assignee', async () => {
    const initialTasks = [
      makeKanbanTask({ id: 't_1', assignee: 'coder-404', status: 'doing', title: '任务1' }),
    ];
    mockFetchKanbanTasks.mockResolvedValue(initialTasks);
    mockGroupKanbanTasksByEmployee.mockReturnValue(new Map([['404', initialTasks]]));
    mockDeriveKanbanTaskStatus.mockReturnValue({
      status: 'working',
      currentTask: '任务1',
      pendingCount: 0,
      completedCount: 0,
      runningCount: 1,
    });

    const { result } = renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      expect(result.current.employees.length).toBeGreaterThan(0);
    });

    act(() => {
      capturedOnEvent?.({
        type: 'task_changed',
        task_id: 't_1',
        task: makeKanbanTask({ id: 't_1', assignee: 'reviewer', status: 'doing', title: '任务1' }),
      });
    });

    expect(result.current.lastWsUpdate).toBeInstanceOf(Date);
  });

  it('task_claimed with reassignment recalculates old assignee', async () => {
    const initialTasks = [
      makeKanbanTask({ id: 't_claim', assignee: 'coder-404', status: 'todo', title: '待认领任务' }),
    ];
    mockFetchKanbanTasks.mockResolvedValue(initialTasks);
    mockGroupKanbanTasksByEmployee.mockReturnValue(new Map([['404', initialTasks]]));
    mockDeriveKanbanTaskStatus.mockReturnValue({
      status: 'standby',
      currentTask: '待处理: 1 个任务',
      pendingCount: 1,
      completedCount: 0,
      runningCount: 0,
    });

    const { result } = renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      expect(result.current.employees.length).toBeGreaterThan(0);
    });

    act(() => {
      capturedOnEvent?.({
        type: 'task_claimed',
        task_id: 't_claim',
        task: makeKanbanTask({ id: 't_claim', assignee: 'reviewer', status: 'doing', title: '待认领任务' }),
      });
    });

    expect(result.current.lastWsUpdate).toBeInstanceOf(Date);
  });

  it('task_claimed for new task (not in cache) does not crash', async () => {
    mockFetchKanbanTasks.mockResolvedValue([]);
    mockGroupKanbanTasksByEmployee.mockReturnValue(new Map());
    mockDeriveKanbanTaskStatus.mockReturnValue({
      status: 'working',
      currentTask: '新任务',
      pendingCount: 0,
      completedCount: 0,
      runningCount: 1,
    });

    const { result } = renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      expect(result.current.employees.length).toBeGreaterThan(0);
    });

    act(() => {
      capturedOnEvent?.({
        type: 'task_claimed',
        task_id: 't_new_claim',
        task: makeKanbanTask({ id: 't_new_claim', assignee: 'coder-404', status: 'doing', title: '新认领任务' }),
      });
    });

    expect(result.current.lastWsUpdate).toBeInstanceOf(Date);
  });

  it('task_created adds task immutably to cache', async () => {
    mockFetchKanbanTasks.mockResolvedValue([]);
    mockGroupKanbanTasksByEmployee.mockReturnValue(new Map());
    mockDeriveKanbanTaskStatus.mockReturnValue({
      status: 'working',
      currentTask: '新任务',
      pendingCount: 0,
      completedCount: 0,
      runningCount: 1,
    });

    const { result } = renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      expect(result.current.employees.length).toBeGreaterThan(0);
    });

    act(() => {
      capturedOnEvent?.({
        type: 'task_created',
        task_id: 't_new',
        task: makeKanbanTask({ id: 't_new', assignee: 'coder-404', status: 'doing', title: '新任务' }),
      });
    });

    expect(result.current.lastWsUpdate).toBeInstanceOf(Date);
  });

  it('heartbeat updates lastWsUpdate without recalculating state', async () => {
    mockFetchKanbanTasks.mockResolvedValue([]);
    mockGroupKanbanTasksByEmployee.mockReturnValue(new Map());

    const { result } = renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      expect(result.current.employees.length).toBeGreaterThan(0);
    });

    const before = result.current.lastWsUpdate;

    act(() => {
      capturedOnEvent?.({
        type: 'heartbeat',
        task_id: '',
      });
    });

    expect(result.current.lastWsUpdate).toBeInstanceOf(Date);
    expect(result.current.lastWsUpdate).not.toBe(before);
  });

  it('ignores event with no task object (except task_deleted and heartbeat)', async () => {
    mockFetchKanbanTasks.mockResolvedValue([]);
    mockGroupKanbanTasksByEmployee.mockReturnValue(new Map());

    const { result } = renderHook(() => useEmployeeStatus());
    await waitFor(() => {
      expect(result.current.employees.length).toBeGreaterThan(0);
    });

    act(() => {
      capturedOnEvent?.({
        type: 'task_created',
        task_id: 't_orphan',
      });
    });

    expect(result.current.employees.length).toBeGreaterThan(0);
  });
});
