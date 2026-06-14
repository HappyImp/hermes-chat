import { useState, useEffect, useCallback, useRef } from 'react';
import { generateId } from '@/utils';
import { fetchActiveEmployees } from '@/api/cronJobs';

/** 任务状态类型 */
export type TaskStatus = 'pending' | 'working' | 'completed' | 'failed' | 'timeout';

/** 任务信息 */
export interface TaskInfo {
  id: string;
  employee: string;
  task: string;
  status: TaskStatus;
  startedAt: Date;
  result?: string;
  error?: string;
}

/** API 响应类型 */
interface DispatchResponse {
  success: boolean;
  task_id: string;
  employee: string;
  started_at: string;
}

/** 轮询配置 */
const POLL_CONFIG = {
  interval: 5000, // 5 秒
  maxRetries: 60, // 最多轮询 5 分钟
};

const API_BASE = '/chat/api';

/**
 * 员工任务调度 Hook
 *
 * 功能：
 * - 启动员工异步任务
 * - 轮询任务状态
 * - 管理活跃任务列表
 */
export function useEmployeeTask() {
  const [activeTasks, setActiveTasks] = useState<Map<string, TaskInfo>>(new Map());
  const pollingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dispatchTask = useCallback(
    async (employee: string, task: string): Promise<TaskInfo> => {
      const active = await fetchActiveEmployees();
      if (active[employee]?.status === 'working') {
        throw new Error(`员工 ${employee} 正在执行其他任务，请稍后再试`);
      }

      const response = await fetch(`${API_BASE}/tasks/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee, task }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `任务启动失败: HTTP ${response.status}`);
      }

      const data: DispatchResponse = await response.json();

      const taskInfo: TaskInfo = {
        id: data.task_id || generateId(),
        employee,
        task,
        status: 'working',
        startedAt: new Date(data.started_at || Date.now()),
      };

      setActiveTasks((prev) => new Map(prev).set(taskInfo.id, taskInfo));

      return taskInfo;
    },
    [],
  );

  const updateTaskStatus = useCallback((taskId: string, updates: Partial<TaskInfo>) => {
    setActiveTasks((prev) => {
      const updated = new Map(prev);
      const task = updated.get(taskId);
      if (task) {
        updated.set(taskId, { ...task, ...updates });
      }
      return updated;
    });
  }, []);

  useEffect(() => {
    if (activeTasks.size === 0) return;

    const pollTask = async (taskId: string, taskInfo: TaskInfo) => {
      try {
        const active = await fetchActiveEmployees();
        const entry = active[taskInfo.employee];

        if (entry?.status === 'completed') {
          updateTaskStatus(taskId, {
            status: 'completed',
            result: entry.task,
          });
          const timer = pollingTimers.current.get(taskId);
          if (timer) {
            clearTimeout(timer);
            pollingTimers.current.delete(taskId);
          }
        } else if (entry?.status === 'failed') {
          updateTaskStatus(taskId, {
            status: 'failed',
            error: entry.task,
          });
          const timer = pollingTimers.current.get(taskId);
          if (timer) {
            clearTimeout(timer);
            pollingTimers.current.delete(taskId);
          }
        }
      } catch (error) {
        console.error('轮询任务状态失败:', error);
      }
    };

    for (const [taskId, taskInfo] of activeTasks) {
      if (taskInfo.status !== 'working') continue;
      if (pollingTimers.current.has(taskId)) continue;

      let retryCount = 0;
      const startPolling = () => {
        const timer = setTimeout(() => {
          if (retryCount >= POLL_CONFIG.maxRetries) {
            updateTaskStatus(taskId, { status: 'timeout' });
            pollingTimers.current.delete(taskId);
            return;
          }

          pollTask(taskId, taskInfo);
          retryCount++;
          startPolling();
        }, POLL_CONFIG.interval);

        pollingTimers.current.set(taskId, timer);
      };

      startPolling();
    }

    for (const [taskId, timer] of pollingTimers.current) {
      if (!activeTasks.has(taskId)) {
        clearTimeout(timer);
        pollingTimers.current.delete(taskId);
      }
    }
  }, [activeTasks, updateTaskStatus]);

  useEffect(() => {
    return () => {
      for (const timer of pollingTimers.current.values()) {
        clearTimeout(timer);
      }
      pollingTimers.current.clear();
    };
  }, []);

  const getTaskStatus = useCallback(
    (taskId: string): TaskInfo | null => {
      return activeTasks.get(taskId) ?? null;
    },
    [activeTasks],
  );

  const removeTask = useCallback((taskId: string) => {
    setActiveTasks((prev) => {
      const updated = new Map(prev);
      updated.delete(taskId);
      return updated;
    });
  }, []);

  return {
    dispatchTask,
    getTaskStatus,
    activeTasks,
    removeTask,
  };
}
