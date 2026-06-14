import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEmployeeTask } from '../useEmployeeTask';

/** Mock global fetch */
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('useEmployeeTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with empty activeTasks', () => {
    const { result } = renderHook(() => useEmployeeTask());
    expect(result.current.activeTasks.size).toBe(0);
  });

  it('dispatchTask sends POST and returns TaskInfo', async () => {
    // Mock active employees check — employee is not busy
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })
      // Mock dispatch API response
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            task_id: 'task_123',
            employee: '404',
            started_at: '2026-06-14T10:00:00Z',
          }),
      });

    const { result } = renderHook(() => useEmployeeTask());

    let taskInfo: Awaited<ReturnType<typeof result.current.dispatchTask>>;
    await act(async () => {
      taskInfo = await result.current.dispatchTask('404', '修复登录bug');
    });

    expect(taskInfo!.id).toBe('task_123');
    expect(taskInfo!.employee).toBe('404');
    expect(taskInfo!.task).toBe('修复登录bug');
    expect(taskInfo!.status).toBe('working');
    expect(result.current.activeTasks.size).toBe(1);
  });

  it('dispatchTask throws when employee is busy', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          404: { task: '其他任务', status: 'working' },
        }),
    });

    const { result } = renderHook(() => useEmployeeTask());

    await expect(
      result.current.dispatchTask('404', '修复登录bug'),
    ).rejects.toThrow('员工 404 正在执行其他任务');
  });

  it('dispatchTask throws on API failure', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: '服务器错误' }),
      });

    const { result } = renderHook(() => useEmployeeTask());

    await expect(
      result.current.dispatchTask('404', '修复bug'),
    ).rejects.toThrow('服务器错误');
  });

  it('removeTask removes task from activeTasks', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            task_id: 'task_456',
            employee: '铁壳',
            started_at: '2026-06-14T10:00:00Z',
          }),
      });

    const { result } = renderHook(() => useEmployeeTask());

    await act(async () => {
      await result.current.dispatchTask('铁壳', '检查磁盘');
    });

    expect(result.current.activeTasks.size).toBe(1);

    act(() => {
      result.current.removeTask('task_456');
    });

    expect(result.current.activeTasks.size).toBe(0);
  });

  it('getTaskStatus returns null for non-existent task', () => {
    const { result } = renderHook(() => useEmployeeTask());
    expect(result.current.getTaskStatus('nonexistent')).toBeNull();
  });

  it('polling updates task status to completed', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            task_id: 'task_789',
            employee: '小K',
            started_at: '2026-06-14T10:00:00Z',
          }),
      });

    const { result } = renderHook(() => useEmployeeTask());

    await act(async () => {
      await result.current.dispatchTask('小K', '生成早报');
    });

    // Mock active employees returning completed status
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          小K: { task: '生成早报', status: 'completed' },
        }),
    });

    // Trigger polling (5s interval)
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    const task = result.current.getTaskStatus('task_789');
    expect(task?.status).toBe('completed');
  });

  it('dispatchTask generates ID when API omits task_id', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            employee: '404',
            started_at: '2026-06-14T10:00:00Z',
          }),
      });

    const { result } = renderHook(() => useEmployeeTask());

    let taskInfo: Awaited<ReturnType<typeof result.current.dispatchTask>>;
    await act(async () => {
      taskInfo = await result.current.dispatchTask('404', '测试');
    });

    expect(taskInfo!.id).toBeTruthy();
    expect(typeof taskInfo!.id).toBe('string');
  });
});
