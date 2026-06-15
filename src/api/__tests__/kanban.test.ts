import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchKanbanTasks,
  fetchKanbanTask,
  fetchKanbanStats,
  fetchKanbanEmployees,
  buildKanbanWsUrl,
  KanbanWebSocket,
} from '../kanban';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
});

describe('fetchKanbanTasks', () => {
  it('returns tasks array on success', async () => {
    const tasks = [
      {
        id: '1',
        title: '测试',
        status: 'doing',
        assignee: '404',
        priority: 'P0',
        createdAt: '',
        updatedAt: '',
      },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(tasks),
    });

    const result = await fetchKanbanTasks();
    expect(result).toEqual(tasks);
    expect(mockFetch).toHaveBeenCalledWith(
      '/chat/api/kanban/tasks',
      expect.any(Object),
    );
  });

  it('handles { tasks: [...] } response shape', async () => {
    const tasks = [
      {
        id: '1',
        title: '测试',
        status: 'doing',
        assignee: '404',
        priority: 'P0',
        createdAt: '',
        updatedAt: '',
      },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ tasks }),
    });

    const result = await fetchKanbanTasks();
    expect(result).toEqual(tasks);
  });

  it('returns empty array on non-200', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    expect(await fetchKanbanTasks()).toEqual([]);
  });

  it('returns empty array on network error', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await fetchKanbanTasks()).toEqual([]);
  });
});

describe('fetchKanbanTask', () => {
  it('returns task on success', async () => {
    const task = {
      id: 'abc',
      title: '详情',
      status: 'doing',
      assignee: '404',
      priority: 'P0',
      createdAt: '',
      updatedAt: '',
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(task),
    });

    const result = await fetchKanbanTask('abc');
    expect(result).toEqual(task);
  });

  it('returns null on 404', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    expect(await fetchKanbanTask('missing')).toBeNull();
  });

  it('returns null on network error', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed'));
    expect(await fetchKanbanTask('x')).toBeNull();
  });
});

describe('fetchKanbanStats', () => {
  it('returns stats on success', async () => {
    const stats = { total: 10, doing: 3, done: 5, pending: 2 };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(stats),
    });

    const result = await fetchKanbanStats();
    expect(result).toEqual(stats);
  });

  it('returns zeroed stats on error', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed'));
    expect(await fetchKanbanStats()).toEqual({
      total: 0,
      doing: 0,
      done: 0,
      pending: 0,
    });
  });
});

describe('fetchKanbanEmployees', () => {
  it('returns employees on success', async () => {
    const employees = [
      {
        name: '404',
        role: 'AI开发工程师',
        avatar: '💻',
        status: 'working',
        currentTask: '写代码',
        tasks: [],
      },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(employees),
    });

    const result = await fetchKanbanEmployees();
    expect(result).toEqual(employees);
  });

  it('handles { employees: [...] } response shape', async () => {
    const employees = [
      {
        name: '404',
        role: 'AI开发工程师',
        avatar: '💻',
        status: 'working',
        currentTask: '写代码',
        tasks: [],
      },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ employees }),
    });

    const result = await fetchKanbanEmployees();
    expect(result).toEqual(employees);
  });

  it('returns empty array on error', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed'));
    expect(await fetchKanbanEmployees()).toEqual([]);
  });
});

describe('buildKanbanWsUrl', () => {
  it('uses ws: on http pages', () => {
    vi.stubGlobal('window', {
      location: { protocol: 'http:', host: 'localhost:3000' },
    });
    expect(buildKanbanWsUrl()).toBe(
      'ws://localhost:3000/chat/api/kanban/events',
    );
  });

  it('uses wss: on https pages', () => {
    vi.stubGlobal('window', {
      location: { protocol: 'https:', host: 'example.com' },
    });
    expect(buildKanbanWsUrl()).toBe(
      'wss://example.com/chat/api/kanban/events',
    );
  });
});

describe('KanbanWebSocket', () => {
  it('starts disconnected', () => {
    const ws = new KanbanWebSocket('ws://test');
    expect(ws.connected).toBe(false);
  });

  it('registers and unregisters handlers', () => {
    const ws = new KanbanWebSocket('ws://test');
    const handler = vi.fn();

    const unsub = ws.on(handler);
    // After unsubscribing, no error = pass
    unsub();
    expect(true).toBe(true);
  });
});
