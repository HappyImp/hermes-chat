import { useState, useEffect, useCallback, useRef } from 'react';
import { generateId } from '@/utils';
import { fetchActiveEmployees } from '@/api/cronJobs';
import type { TaskInfo } from '@/types';

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
 *
 * @example
 * const { dispatchTask, activeTasks } = useEmployeeTask();
 *
 * // 启动任务
 * const taskInfo = await dispatchTask('404', '修复登录bug');
 *
 * // 查看状态
 * console.log(activeTasks.get(taskInfo.id));
 */
export function useEmployeeTask() {
  const [activeTasks, setActiveTasks] = useState<Map<string, TaskInfo>>(new Map());
  const pollingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  /**
   * 启动员工任务
   *
   * @param employee - 员工名称
   * @param task - 任务描述
   * @returns 任务信息
   * @throws 网络错误或员工忙
   */
  const dispatchTask = useCallback(
    async (employee: string, task: string): Promise<TaskInfo> => {
      // 检查员工是否在执行任务
      const active = await fetchActiveEmployees();
      if (active[employee]?.status === 'working') {
        throw new Error(`员工 ${employee} 正在执行其他任务，请稍后再试`);
      }

      // 调用 API 启动任务
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

      // 创建任务信息
      const taskInfo: TaskInfo = {
        id: data.task_id || generateId(),
        employee,
        task,
        status: 'working',
        startedAt: new Date(data.started_at || Date.now()),
      };

      // 添加到活跃任务列表
      setActiveTasks((prev) => new Map(prev).set(taskInfo.id, taskInfo));

      return taskInfo;
    },
    [],
  );

  /**
   * 更新任务状态
   */
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

  /**
   * 停止指定任务的轮询
   */
  const stopPolling = useCallback((taskId: string) => {
    const timer = pollingTimers.current.get(taskId);
    if (timer) {
      clearTimeout(timer);
      pollingTimers.current.delete(taskId);
    }
  }, []);

  /**
   * 轮询任务状态
   */
  useEffect(() => {
    if (activeTasks.size === 0) return;

    const pollTask = async (taskId: string, taskInfo: TaskInfo) => {
      try {
        const active = await fetchActiveEmployees();
        const entry = active[taskInfo.employee];

        // 任务已结束的状态：completed / failed / timeout
        if (entry?.status === 'completed') {
          updateTaskStatus(taskId, {
            status: 'completed',
            result: entry.task,
          });
          stopPolling(taskId);
        } else if (entry?.status === 'failed' || entry?.status === 'timeout') {
          updateTaskStatus(taskId, {
            status: entry.status,
            error: entry.task,
          });
          stopPolling(taskId);
        }
      } catch (error) {
        console.error('轮询任务状态失败:', error);
      }
    };

    // 为每个活跃任务启动轮询
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

    // 清理：停止不再活跃的任务的轮询
    for (const [taskId, timer] of pollingTimers.current) {
      if (!activeTasks.has(taskId)) {
        clearTimeout(timer);
        pollingTimers.current.delete(taskId);
      }
    }
  }, [activeTasks, updateTaskStatus]);

  // 清理所有轮询
  useEffect(() => {
    return () => {
      for (const timer of pollingTimers.current.values()) {
        clearTimeout(timer);
      }
      pollingTimers.current.clear();
    };
  }, []);

  /**
   * 获取任务状态
   */
  const getTaskStatus = useCallback(
    (taskId: string): TaskInfo | null => {
      return activeTasks.get(taskId) ?? null;
    },
    [activeTasks],
  );

  /**
   * 移除已完成的任务
   */
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
