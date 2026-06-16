import { useEffect, useRef, useState, useCallback } from 'react';
import {
  KanbanWebSocket,
  getKanbanWsUrl,
  type KanbanWsEvent,
  type WsConnectionStatus,
} from '@/api/kanban';

export interface UseKanbanWebSocketReturn {
  /** WebSocket 连接状态 */
  wsStatus: WsConnectionStatus;
  /** 最近收到的事件（用于驱动状态更新） */
  lastEvent: KanbanWsEvent | null;
  /** 手动触发重连 */
  reconnect: () => void;
  /** WebSocket 错误信息 */
  wsError: string | null;
}

/**
 * WebSocket hook — 管理 kanban 事件的实时推送连接。
 *
 * - 组件挂载时自动连接，卸载时断开
 * - 指数退避重连（1s → 2s → 4s → ... → 30s max）
 * - 暴露连接状态和最近事件
 *
 * @param onEvent 收到事件时的回调（用 useCallback 包裹避免重复订阅）
 */
export function useKanbanWebSocket(
  onEvent?: (event: KanbanWsEvent) => void,
): UseKanbanWebSocketReturn {
  const [wsStatus, setWsStatus] = useState<WsConnectionStatus>('disconnected');
  const [lastEvent, setLastEvent] = useState<KanbanWsEvent | null>(null);
  const [wsError, setWsError] = useState<string | null>(null);
  const wsRef = useRef<KanbanWebSocket | null>(null);
  const onEventRef = useRef(onEvent);

  // 保持 onEvent ref 最新，避免 useEffect 依赖变化导致重连
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const connect = useCallback(() => {
    // 清理旧连接
    if (wsRef.current) {
      wsRef.current.disconnect();
    }

    const url = getKanbanWsUrl();
    if (!url) return;

    const ws = new KanbanWebSocket(url);
    wsRef.current = ws;

    // 监听连接状态
    const unsubStatus = ws.onStatusChange((status) => {
      setWsStatus(status);
      // 连接成功时清除错误
      if (status === 'connected') {
        setWsError(null);
      }
    });

    // 监听错误
    const unsubError = ws.onError((message) => {
      setWsError(message);
    });

    // 监听事件
    const unsubEvent = ws.on((event) => {
      setLastEvent(event);
      onEventRef.current?.(event);
    });

    ws.connect();

    return () => {
      unsubStatus();
      unsubError();
      unsubEvent();
      ws.disconnect();
    };
  }, []);

  // 挂载时连接，卸载时断开
  useEffect(() => {
    const cleanup = connect();
    return () => cleanup?.();
  }, [connect]);

  const reconnect = useCallback(() => {
    connect();
  }, [connect]);

  return { wsStatus, lastEvent, reconnect, wsError };
}
