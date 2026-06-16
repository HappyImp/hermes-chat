import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchKanbanTasks,
  type KanbanWsEvent,
  type WsConnectionStatus,
} from '@/api/kanban';
import type { KanbanTask } from '@/types/employee';
import { useKanbanWebSocket } from './useKanbanWebSocket';

/** useKanbanEvents 配置选项 */
export interface UseKanbanEventsOptions {
  /** 是否启用 WebSocket（默认读 VITE_USE_KANBAN 环境变量） */
  enableWebSocket?: boolean;
  /** 降级轮询间隔（ms），WS 断线时启用，默认 30000 */
  fallbackPollingInterval?: number;
  /** 非 WS 模式下的轮询间隔（ms），默认 60000 */
  pollingInterval?: number;
  /** 页面获焦时是否全量刷新，默认 true */
  refreshOnFocus?: boolean;
}

/** useKanbanEvents 返回值 */
export interface UseKanbanEventsReturn {
  /** 当前 kanban 任务列表（事件驱动增量更新） */
  tasks: KanbanTask[];
  /** WebSocket 连接状态（非 WS 模式为 'polling'） */
  wsStatus: WsConnectionStatus | 'polling';
  /** 最后一次全量刷新/增量更新时间 */
  lastUpdated: Date;
  /** 最后一次 WebSocket 事件时间 */
  lastWsUpdate: Date | null;
  /** WebSocket 错误信息 */
  wsError: string | null;
  /** 手动全量刷新 */
  refresh: () => Promise<void>;
  /** 手动重连 WebSocket */
  reconnect: () => void;
  /** 是否正在初始加载 */
  isLoading: boolean;
}

/**
 * 事件驱动的 kanban 状态管理 hook。
 *
 * 替代 60s 轮询，通过 WebSocket 实时接收 task_created / task_changed /
 * task_claimed / task_deleted / heartbeat 事件，增量更新本地任务缓存。
 *
 * 降级策略：
 * - WS 连接中/断线 → 30s 轮询兜底
 * - WS 恢复 → 停止降级轮询
 * - 页面重新可见/获焦 → 全量刷新补偿丢失事件
 *
 * @param options 配置选项
 */
export function useKanbanEvents(
  options: UseKanbanEventsOptions = {},
): UseKanbanEventsReturn {
  const {
    enableWebSocket = import.meta.env.VITE_USE_KANBAN === 'true',
    fallbackPollingInterval = 30_000,
    pollingInterval = 60_000,
    refreshOnFocus = true,
  } = options;

  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [wsStatus, setWsStatus] = useState<WsConnectionStatus | 'polling'>('polling');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [lastWsUpdate, setLastWsUpdate] = useState<Date | null>(null);
  const [wsError, setWsError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 用 ref 持有最新 tasks，供 WS 事件处理器读取（避免闭包陈旧）
  const tasksRef = useRef<KanbanTask[]>([]);
  // 降级轮询 timer
  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** 全量拉取 kanban 任务 */
  const refresh = useCallback(async () => {
    try {
      const fetched = await fetchKanbanTasks();
      tasksRef.current = fetched;
      setTasks(fetched);
    } catch {
      // 网络错误时保留现有缓存，不清空
    }
    setLastUpdated(new Date());
    setIsLoading(false);
  }, []);

  /** 处理 WebSocket 事件 — 增量更新本地任务缓存 */
  const handleWsEvent = useCallback((event: KanbanWsEvent) => {
    const { task_id, task, type } = event;

    // heartbeat 仅更新时间戳，不刷新状态
    if (type === 'heartbeat') {
      setLastWsUpdate(new Date());
      return;
    }

    // task_deleted: 从缓存中移除
    if (type === 'task_deleted') {
      tasksRef.current = tasksRef.current.filter((t) => t.id !== task_id);
      setTasks(tasksRef.current);
      setLastWsUpdate(new Date());
      setLastUpdated(new Date());
      return;
    }

    // 其他事件需要 task 对象
    if (!task) return;

    const current = tasksRef.current;
    const idx = current.findIndex((t) => t.id === task_id);

    if (type === 'task_created' && idx === -1) {
      // 新任务追加
      tasksRef.current = [...current, task];
    } else if (type === 'task_claimed') {
      // 认领：已存在则替换，不存在则追加
      tasksRef.current = idx === -1
        ? [...current, task]
        : [...current.slice(0, idx), task, ...current.slice(idx + 1)];
    } else if (type === 'task_changed' && idx !== -1) {
      // 状态变更：替换已有任务
      tasksRef.current = [...current.slice(0, idx), task, ...current.slice(idx + 1)];
    } else {
      // 不匹配的事件（如 task_created 但已存在），忽略
      return;
    }

    setTasks(tasksRef.current);
    setLastWsUpdate(new Date());
    setLastUpdated(new Date());
  }, []);

  // WebSocket 连接（始终调用以遵守 Rules of Hooks，enableWebSocket 控制是否使用）
  const {
    wsStatus: currentWsStatus,
    reconnect,
    wsError: currentWsError,
  } = useKanbanWebSocket(handleWsEvent);

  // 同步 WS 状态 + 降级轮询（enableWebSocket=false 时强制 polling 模式）
  useEffect(() => {
    if (!enableWebSocket) {
      setWsStatus('polling');
      // 非 WS 模式下停止任何降级轮询（由独立的 pollingInterval timer 管理）
      if (fallbackTimerRef.current) {
        clearInterval(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      return;
    }

    setWsStatus(currentWsStatus);

    if (currentWsStatus === 'disconnected' || currentWsStatus === 'reconnecting') {
      // WS 不可用 → 启动降级轮询
      if (!fallbackTimerRef.current) {
        fallbackTimerRef.current = setInterval(refresh, fallbackPollingInterval);
      }
    } else if (currentWsStatus === 'connected') {
      // WS 恢复 → 停止降级轮询
      if (fallbackTimerRef.current) {
        clearInterval(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    }
  }, [currentWsStatus, enableWebSocket, refresh, fallbackPollingInterval]);

  // 同步 WS 错误（非 WS 模式清空错误）
  useEffect(() => {
    setWsError(enableWebSocket ? currentWsError : null);
  }, [currentWsError, enableWebSocket]);

  // 初始全量拉取
  useEffect(() => {
    refresh();
  }, [refresh]);

  // 非 WS 模式：固定间隔轮询
  useEffect(() => {
    if (enableWebSocket) return;
    const timer = setInterval(refresh, pollingInterval);
    return () => clearInterval(timer);
  }, [refresh, enableWebSocket, pollingInterval]);

  // 页面获焦/可见时全量刷新（补偿 WS 可能丢失的事件）
  useEffect(() => {
    if (!refreshOnFocus) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };
    const handleFocus = () => {
      refresh();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refresh, refreshOnFocus]);

  // 清理降级轮询 timer
  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current) {
        clearInterval(fallbackTimerRef.current);
      }
    };
  }, []);

  return {
    tasks,
    wsStatus,
    lastUpdated,
    lastWsUpdate,
    wsError,
    refresh,
    reconnect,
    isLoading,
  };
}
