import type { KanbanTask, KanbanStats, Employee } from '@/types/employee';
export type { KanbanTask } from '@/types/employee';
import { resolveAssignee } from '@/config/employeeMapping';
import { getAuthToken } from '@/store/authStore';

const API_BASE = '/chat/api/kanban';

/** Employee's kanban-derived status summary. */
export interface EmployeeKanbanStatus {
  status: 'working' | 'standby' | 'off' | 'completed' | 'blocked';
  currentTask: string;
  pendingCount: number;
  completedCount: number;
  runningCount: number;
}

// ─── REST API ──────────────────────────────────────────────────────

/** 获取 kanban 任务列表 */
export async function fetchKanbanTasks(): Promise<KanbanTask[]> {
  try {
    const res = await fetch(`${API_BASE}/tasks`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data.tasks ?? []);
  } catch {
    return [];
  }
}

/** 获取单个任务详情 */
export async function fetchKanbanTask(id: string): Promise<KanbanTask | null> {
  try {
    const res = await fetch(`${API_BASE}/tasks/${encodeURIComponent(id)}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** 获取 kanban 统计数据 */
export async function fetchKanbanStats(): Promise<KanbanStats> {
  const fallback: KanbanStats = { total: 0, doing: 0, done: 0, pending: 0 };
  try {
    const res = await fetch(`${API_BASE}/stats`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    // 后端返回 { stats: { ... } }，提取 stats 字段
    return data.stats ?? data ?? fallback;
  } catch {
    return fallback;
  }
}

/** 获取 kanban 员工列表（含状态） */
export async function fetchKanbanEmployees(): Promise<Employee[]> {
  try {
    const res = await fetch(`${API_BASE}/employees`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data.employees ?? []);
  } catch {
    return [];
  }
}

// ─── WebSocket ──────────────────────────────────────────────────────

/**
 * 后端实际发送的事件类型（与 CLI poll 快照对比）：
 * - task_created: 新任务出现
 * - task_changed: 任务状态变更（含 old_status / new_status）
 * - task_claimed: 任务被认领
 * - heartbeat: 心跳（仅更新时间戳，不刷新状态）
 */
export type KanbanWsEventType = 'task_created' | 'task_changed' | 'task_claimed' | 'task_deleted' | 'heartbeat';

export interface KanbanWsEvent {
  type: KanbanWsEventType;
  /** task_created / task_changed / task_claimed / task_deleted 有值，heartbeat 无此字段 */
  task_id?: string;
  /** task_created / task_changed / task_claimed 时有值，task_deleted / heartbeat 无此字段 */
  task?: KanbanTask;
  /** 仅 task_changed 有 */
  old_status?: string;
  /** 仅 task_changed 有 */
  new_status?: string;
  /** 仅 task_claimed 有 */
  old_assignee?: string;
  /** 仅 task_claimed 有 */
  new_assignee?: string;
}

type WsEventHandler = (event: KanbanWsEvent) => void;

/** WebSocket 连接状态 */
export type WsConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

type StatusHandler = (status: WsConnectionStatus) => void;
type ErrorHandler = (message: string) => void;

/** 指数退避重连的 WebSocket 客户端 */
export class KanbanWebSocket {
  private ws: WebSocket | null = null;
  private handlers = new Set<WsEventHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private errorHandlers = new Set<ErrorHandler>();
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30_000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private _status: WsConnectionStatus = 'disconnected';
  private _lastMessageTime: Date | null = null;

  constructor(private url: string) {}

  /** 注册事件处理器 */
  on(handler: WsEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /** 注册连接状态处理器 */
  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  /** 注册错误处理器 */
  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  /** 当前连接状态 */
  get status(): WsConnectionStatus {
    return this._status;
  }

  /** 连接状态别名，与 PRD 接口一致 */
  get connectionStatus(): WsConnectionStatus {
    return this._status;
  }

  /** 最后收到消息的时间 */
  get lastMessageTime(): Date | null {
    return this._lastMessageTime;
  }

  /** 启动连接 */
  connect(): void {
    if (this.stopped) return;
    this.tryConnect();
  }

  /** 主动断开 */
  disconnect(): void {
    this.stopped = true;
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  /** 当前是否已连接 */
  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private setStatus(status: WsConnectionStatus): void {
    if (this._status === status) return;
    this._status = status;
    for (const handler of this.statusHandlers) {
      handler(status);
    }
  }

  private tryConnect(): void {
    if (this.stopped) return;

    this.setStatus('connecting');

    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.setStatus('reconnecting');
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectDelay = 1000; // 重置退避
      this.setStatus('connected');
    };

    this.ws.onmessage = (msg: MessageEvent) => {
      try {
        const event: KanbanWsEvent = JSON.parse(msg.data);
        this._lastMessageTime = new Date();
        for (const handler of this.handlers) {
          handler(event);
        }
      } catch {
        // 忽略解析失败的事件
      }
    };

    this.ws.onclose = () => {
      if (!this.stopped) {
        this.setStatus('reconnecting');
        this.scheduleReconnect();
      } else {
        this.setStatus('disconnected');
      }
    };

    this.ws.onerror = () => {
      // onclose 会紧随其后触发，在那里处理重连
      for (const handler of this.errorHandlers) {
        handler('WebSocket 连接错误');
      }
    };
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        this.maxReconnectDelay,
      );
      this.tryConnect();
    }, this.reconnectDelay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

/**
 * Get the WebSocket URL for kanban events.
 * Includes JWT token as query param (WebSocket 无法设置自定义 header).
 */
export function getKanbanWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const token = getAuthToken() ?? '';
  return `${proto}//${window.location.host}${API_BASE}/events?token=${encodeURIComponent(token)}`;
}

// ─── Status Derivation ─────────────────────────────────────────────

/**
 * Map a kanban assignee name to an employee display name.
 * Kanban assignees use Hermes profile names (e.g., "coder-404"),
 * while employees use display names (e.g., "404").
 * Returns null if no match.
 *
 * Delegates to shared config (resolveAssignee).
 */
export function mapKanbanAssigneeToEmployee(assignee: string): string | null {
  return resolveAssignee(assignee);
}

/**
 * Derive an employee's status from their kanban tasks.
 *
 * Rules (priority order):
 * 1. Any task with status 'running'/'doing' → 'working' (show task title)
 * 2. Any task with status 'blocked' → 'blocked'
 * 3. Any task with status 'todo'/'ready' → 'standby' (has pending work)
 * 4. Only 'done' tasks → 'completed'; no tasks → 'completed'
 */
export function deriveKanbanTaskStatus(tasks: KanbanTask[]): EmployeeKanbanStatus {
  const running = tasks.filter((t) => t.status === 'running' || t.status === 'doing');
  const blocked = tasks.filter((t) => t.status === 'blocked');
  const pending = tasks.filter((t) => t.status === 'todo' || t.status === 'ready');
  const done = tasks.filter((t) => t.status === 'done');

  if (running.length > 0) {
    return {
      status: 'working',
      currentTask: running[0].title,
      pendingCount: pending.length,
      completedCount: done.length,
      runningCount: running.length,
    };
  }

  if (blocked.length > 0) {
    return {
      status: 'blocked',
      currentTask: `阻塞: ${blocked[0].title}`,
      pendingCount: pending.length,
      completedCount: done.length,
      runningCount: 0,
    };
  }

  if (pending.length > 0) {
    return {
      status: 'standby',
      currentTask: `待处理: ${pending.length} 个任务`,
      pendingCount: pending.length,
      completedCount: done.length,
      runningCount: 0,
    };
  }

  return {
    status: 'completed',
    currentTask: done.length > 0 ? `已完成 ${done.length} 项` : '暂无任务',
    pendingCount: 0,
    completedCount: done.length,
    runningCount: 0,
  };
}

/**
 * Group kanban tasks by assignee, returning a map of employee name → tasks.
 * Only includes tasks whose assignee maps to a known employee.
 */
export function groupKanbanTasksByEmployee(
  tasks: KanbanTask[],
): Map<string, KanbanTask[]> {
  const grouped = new Map<string, KanbanTask[]>();
  for (const task of tasks) {
    const employee = mapKanbanAssigneeToEmployee(task.assignee);
    if (!employee) continue;
    const existing = grouped.get(employee) ?? [];
    existing.push(task);
    grouped.set(employee, existing);
  }
  return grouped;
}
