import type { TaskInfo } from '@/types';

/** 状态图标映射 */
const STATUS_ICON: Record<TaskInfo['status'], string> = {
  pending: '⏳',
  working: '🔄',
  completed: '✅',
  failed: '❌',
  timeout: '⏰',
};

/** 状态文本映射 */
const STATUS_TEXT: Record<TaskInfo['status'], string> = {
  pending: '等待中',
  working: '执行中...',
  completed: '已完成',
  failed: '失败',
  timeout: '超时',
};

/** 员工角色映射 */
const EMPLOYEE_ROLE: Record<string, string> = {
  '老财': 'AI操盘手',
  '铁壳': 'AI运维工程师',
  '小K': 'AI情报员',
  '404': 'AI开发工程师',
  '裁判君': 'AI审查官',
  'Ditto': 'AI测试工程师',
};

/** 员工头像映射 */
const EMPLOYEE_AVATAR: Record<string, string> = {
  '老财': '💰',
  '铁壳': '🤖',
  '小K': '🔍',
  '404': '💻',
  '裁判君': '⚖️',
  'Ditto': '🧪',
};

interface TaskCardProps {
  taskInfo: TaskInfo;
}

/**
 * 员工任务卡片组件
 *
 * 显示员工异步任务的状态、进度和结果
 *
 * @example
 * <TaskCard taskInfo={taskInfo} />
 */
export function TaskCard({ taskInfo }: TaskCardProps) {
  const { employee, task, status, startedAt, result, error } = taskInfo;

  const statusIcon = STATUS_ICON[status];
  const statusText = STATUS_TEXT[status];
  const role = EMPLOYEE_ROLE[employee] || 'AI员工';
  const avatar = EMPLOYEE_AVATAR[employee] || '👤';

  return (
    <div className="task-card" data-testid="task-card">
      {/* 头部：员工信息 */}
      <div className="task-card-header">
        <span className="task-avatar">{avatar}</span>
        <div className="task-employee-info">
          <span className="task-employee-name">{employee}</span>
          <span className="task-employee-role">{role}</span>
        </div>
        <span className="task-status-icon">{statusIcon}</span>
      </div>

      {/* 任务描述 */}
      <div className="task-card-body">
        <p className="task-description">{task}</p>
        <p className="task-status" data-testid="task-status">
          {statusText}
        </p>
      </div>

      {/* 结果或错误 */}
      {result && (
        <div className="task-card-result" data-testid="task-result">
          <span className="result-label">结果:</span>
          <span className="result-content">{result}</span>
        </div>
      )}

      {error && (
        <div className="task-card-error" data-testid="task-error">
          <span className="error-label">错误:</span>
          <span className="error-content">{error}</span>
        </div>
      )}

      {/* 底部：时间信息 */}
      <div className="task-card-footer">
        <span className="task-time">
          启动时间: {startedAt.toLocaleString('zh-CN')}
        </span>
      </div>
    </div>
  );
}
