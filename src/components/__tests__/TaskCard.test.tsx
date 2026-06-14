import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskCard } from '../Chat/TaskCard';
import type { TaskInfo } from '@/hooks/useEmployeeTask';

function makeTaskInfo(overrides: Partial<TaskInfo> = {}): TaskInfo {
  return {
    id: 'task_test',
    employee: '404',
    task: '修复登录bug',
    status: 'working',
    startedAt: new Date('2026-06-14T10:00:00'),
    ...overrides,
  };
}

describe('TaskCard', () => {
  it('renders employee name and role', () => {
    render(<TaskCard taskInfo={makeTaskInfo()} />);
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('AI开发工程师')).toBeInTheDocument();
  });

  it('renders task description', () => {
    render(<TaskCard taskInfo={makeTaskInfo()} />);
    expect(screen.getByText('修复登录bug')).toBeInTheDocument();
  });

  it('shows working status with correct icon', () => {
    render(<TaskCard taskInfo={makeTaskInfo({ status: 'working' })} />);
    expect(screen.getByText('执行中...')).toBeInTheDocument();
    expect(screen.getByText('🔄')).toBeInTheDocument();
  });

  it('shows completed status', () => {
    render(<TaskCard taskInfo={makeTaskInfo({ status: 'completed', result: '已修复' })} />);
    expect(screen.getByText('已完成')).toBeInTheDocument();
    expect(screen.getByText('✅')).toBeInTheDocument();
  });

  it('shows failed status', () => {
    render(<TaskCard taskInfo={makeTaskInfo({ status: 'failed', error: '网络错误' })} />);
    expect(screen.getByText('失败')).toBeInTheDocument();
    expect(screen.getByText('❌')).toBeInTheDocument();
  });

  it('shows timeout status', () => {
    render(<TaskCard taskInfo={makeTaskInfo({ status: 'timeout' })} />);
    expect(screen.getByText('超时')).toBeInTheDocument();
    expect(screen.getByText('⏰')).toBeInTheDocument();
  });

  it('shows pending status', () => {
    render(<TaskCard taskInfo={makeTaskInfo({ status: 'pending' })} />);
    expect(screen.getByText('等待中')).toBeInTheDocument();
    expect(screen.getByText('⏳')).toBeInTheDocument();
  });

  it('renders result when provided', () => {
    render(<TaskCard taskInfo={makeTaskInfo({ status: 'completed', result: 'PR已提交' })} />);
    expect(screen.getByText('PR已提交')).toBeInTheDocument();
    expect(screen.getByTestId('task-result')).toBeInTheDocument();
  });

  it('renders error when provided', () => {
    render(<TaskCard taskInfo={makeTaskInfo({ status: 'failed', error: '超时了' })} />);
    expect(screen.getByText('超时了')).toBeInTheDocument();
    expect(screen.getByTestId('task-error')).toBeInTheDocument();
  });

  it('does not render result section when no result', () => {
    render(<TaskCard taskInfo={makeTaskInfo({ status: 'working' })} />);
    expect(screen.queryByTestId('task-result')).toBeNull();
  });

  it('does not render error section when no error', () => {
    render(<TaskCard taskInfo={makeTaskInfo({ status: 'working' })} />);
    expect(screen.queryByTestId('task-error')).toBeNull();
  });

  it('renders started time', () => {
    render(<TaskCard taskInfo={makeTaskInfo()} />);
    expect(screen.getByText(/启动时间/)).toBeInTheDocument();
  });

  it('renders all employee avatars', () => {
    const employees = [
      { name: '老财', avatar: '💰' },
      { name: '铁壳', avatar: '🤖' },
      { name: '小K', avatar: '🔍' },
      { name: '404', avatar: '💻' },
      { name: '裁判君', avatar: '⚖️' },
      { name: 'Ditto', avatar: '🧪' },
    ];

    for (const emp of employees) {
      const { unmount } = render(
        <TaskCard taskInfo={makeTaskInfo({ employee: emp.name })} />,
      );
      expect(screen.getByText(emp.avatar)).toBeInTheDocument();
      unmount();
    }
  });

  it('renders unknown employee with generic avatar', () => {
    render(<TaskCard taskInfo={makeTaskInfo({ employee: '新员工' })} />);
    expect(screen.getByText('👤')).toBeInTheDocument();
    expect(screen.getByText('AI员工')).toBeInTheDocument();
  });
});
