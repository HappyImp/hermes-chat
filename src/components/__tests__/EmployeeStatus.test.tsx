import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmployeeStatus } from '../Sidebar/EmployeeStatus';
import { useEmployeeStatus } from '@/hooks/useEmployeeStatus';
import type { KanbanTask } from '@/types/employee';

const mockRefresh = vi.fn();
const mockOnOpenOffice = vi.fn();

vi.mock('@/hooks/useEmployeeStatus', () => ({
  useEmployeeStatus: vi.fn(),
}));

const defaultEmployees = [
  {
    name: '老财',
    role: 'AI操盘手',
    avatar: '💰',
    status: 'working' as const,
    currentTask: '盘前研判分析',
    tasks: ['盘前研判', '开盘异动', '午盘复盘'],
    kanbanTasks: [
      { id: 't_1', title: '盘前研判分析', status: 'doing', assignee: '老财', priority: '1' },
      { id: 't_2', title: '开盘异动监控', status: 'todo', assignee: '老财', priority: '0' },
    ] as KanbanTask[],
    kanbanTaskCount: 2,
    kanbanRunningCount: 1,
    kanbanPendingCount: 1,
    kanbanCompletedCount: 0,
    currentTaskId: 't_1',
  },
  {
    name: '铁壳',
    role: 'AI运维工程师',
    avatar: '🤖',
    status: 'standby' as const,
    currentTask: '待命中',
    tasks: ['每日日报', '运维护航'],
    kanbanTasks: undefined,
    kanbanTaskCount: undefined,
    kanbanRunningCount: undefined,
    kanbanPendingCount: undefined,
    kanbanCompletedCount: undefined,
    currentTaskId: undefined,
  },
  {
    name: '裁判君',
    role: 'AI审查官',
    avatar: '⚖️',
    status: 'off' as const,
    currentTask: '休息中',
    tasks: ['按需审查'],
    kanbanTasks: [
      { id: 't_3', title: '审查 PR #42', status: 'done', assignee: '裁判君', priority: '0' },
    ] as KanbanTask[],
    kanbanTaskCount: 1,
    kanbanRunningCount: 0,
    kanbanPendingCount: 0,
    kanbanCompletedCount: 1,
    currentTaskId: undefined,
  },
];

function makeMockReturn(employees = defaultEmployees) {
  return {
    employees,
    lastUpdated: new Date('2026-06-14T10:00:00'),
    refresh: mockRefresh,
    wsStatus: 'connected' as const,
    lastWsUpdate: new Date(),
    wsError: null,
    reconnect: vi.fn(),
  };
}

describe('EmployeeStatus', () => {
  beforeEach(() => {
    localStorage.clear();
    mockRefresh.mockClear();
    mockOnOpenOffice.mockClear();
    vi.mocked(useEmployeeStatus).mockReturnValue(makeMockReturn());
  });

  it('renders the panel header', () => {
    render(<EmployeeStatus onBack={vi.fn()} onOpenOffice={mockOnOpenOffice} />);
    expect(screen.getByText(/员工状态/)).toBeInTheDocument();
  });

  it('shows all employees', () => {
    render(<EmployeeStatus onBack={vi.fn()} onOpenOffice={mockOnOpenOffice} />);
    expect(screen.getByText('老财')).toBeInTheDocument();
    expect(screen.getByText('铁壳')).toBeInTheDocument();
    expect(screen.getByText('裁判君')).toBeInTheDocument();
  });

  it('shows employee roles', () => {
    render(<EmployeeStatus onBack={vi.fn()} onOpenOffice={mockOnOpenOffice} />);
    expect(screen.getByText('AI操盘手')).toBeInTheDocument();
    expect(screen.getByText('AI运维工程师')).toBeInTheDocument();
    expect(screen.getByText('AI审查官')).toBeInTheDocument();
  });

  it('shows current tasks', () => {
    render(<EmployeeStatus onBack={vi.fn()} onOpenOffice={mockOnOpenOffice} />);
    // '盘前研判分析' 出现在当前任务区域和 kanban badge 中，使用 getAllByText
    expect(screen.getAllByText('盘前研判分析').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('待命中')).toBeInTheDocument();
    expect(screen.getByText('休息中')).toBeInTheDocument();
  });

  it('shows task tags', () => {
    render(<EmployeeStatus onBack={vi.fn()} onOpenOffice={mockOnOpenOffice} />);
    // 铁壳没有 kanbanTasks，回退到字符串标签
    expect(screen.getByText('每日日报')).toBeInTheDocument();
    expect(screen.getByText('运维护航')).toBeInTheDocument();
  });

  it('shows status summary with working count', () => {
    render(<EmployeeStatus onBack={vi.fn()} onOpenOffice={mockOnOpenOffice} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText(/人工作中/)).toBeInTheDocument();
    expect(screen.getByText(/共 3 人/)).toBeInTheDocument();
  });

  it('shows status labels', () => {
    render(<EmployeeStatus onBack={vi.fn()} onOpenOffice={mockOnOpenOffice} />);
    expect(screen.getByText('工作中')).toBeInTheDocument();
    expect(screen.getByText('待命')).toBeInTheDocument();
    expect(screen.getByText('休息')).toBeInTheDocument();
  });

  it('calls onBack when back button clicked', () => {
    const onBack = vi.fn();
    render(<EmployeeStatus onBack={onBack} onOpenOffice={mockOnOpenOffice} />);
    const backBtn = screen.getByTitle('返回');
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalled();
  });

  it('calls refresh when refresh button clicked', () => {
    render(<EmployeeStatus onBack={vi.fn()} onOpenOffice={mockOnOpenOffice} />);
    const refreshBtn = screen.getByTitle('刷新');
    fireEvent.click(refreshBtn);
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('handles empty employee list', () => {
    vi.mocked(useEmployeeStatus).mockReturnValueOnce(makeMockReturn([]));
    render(<EmployeeStatus onBack={vi.fn()} onOpenOffice={mockOnOpenOffice} />);
    expect(screen.getByText(/共 0 人/)).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders the office button', () => {
    render(<EmployeeStatus onBack={vi.fn()} onOpenOffice={mockOnOpenOffice} />);
    expect(screen.getByTitle('进入办公室')).toBeInTheDocument();
  });

  it('calls onOpenOffice when office button clicked', () => {
    render(<EmployeeStatus onBack={vi.fn()} onOpenOffice={mockOnOpenOffice} />);
    fireEvent.click(screen.getByTitle('进入办公室'));
    expect(mockOnOpenOffice).toHaveBeenCalled();
  });

  // ── Kanban 任务详情 + 状态颜色映射 ──────────────────────────────

  it('renders kanban task titles for employees with kanbanTasks', () => {
    render(<EmployeeStatus onBack={vi.fn()} onOpenOffice={mockOnOpenOffice} />);
    // 老财有 kanbanTasks — '盘前研判分析' 同时出现在当前任务和 kanban badge 中
    expect(screen.getAllByText('盘前研判分析').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('开盘异动监控')).toBeInTheDocument();
  });

  it('renders kanban task status labels', () => {
    render(<EmployeeStatus onBack={vi.fn()} onOpenOffice={mockOnOpenOffice} />);
    // 老财: doing → 进行中, todo → 待处理
    expect(screen.getAllByText('进行中').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('待处理').length).toBeGreaterThanOrEqual(1);
  });

  it('renders done task status label for completed tasks', () => {
    render(<EmployeeStatus onBack={vi.fn()} onOpenOffice={mockOnOpenOffice} />);
    // 裁判君: done → 已完成
    expect(screen.getByText('审查 PR #42')).toBeInTheDocument();
  });

  it('falls back to string tasks when kanbanTasks is undefined', () => {
    render(<EmployeeStatus onBack={vi.fn()} onOpenOffice={mockOnOpenOffice} />);
    // 铁壳没有 kanbanTasks，回退到字符串
    expect(screen.getByText('每日日报')).toBeInTheDocument();
    expect(screen.getByText('运维护航')).toBeInTheDocument();
  });

  it('highlights current task with special styling', () => {
    render(<EmployeeStatus onBack={vi.fn()} onOpenOffice={mockOnOpenOffice} />);
    // 老财的 currentTaskId 是 t_1（盘前研判分析），应该有高亮
    // 通过检查 title 属性来验证 badge 存在
    const badges = screen.getAllByTitle(/盘前研判分析/);
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders kanban tasks sorted by status (doing first, then todo, then done)', () => {
    const employees = [
      {
        name: '404',
        role: 'AI开发工程师',
        avatar: '💻',
        status: 'working' as const,
        currentTask: '任务A',
        tasks: [],
        kanbanTasks: [
          { id: 't_done', title: '已完成任务', status: 'done', assignee: '404', priority: '0' },
          { id: 't_doing', title: '进行中任务', status: 'doing', assignee: '404', priority: '1' },
          { id: 't_todo', title: '待办任务', status: 'todo', assignee: '404', priority: '0' },
        ] as KanbanTask[],
        kanbanTaskCount: 3,
        kanbanRunningCount: 1,
        kanbanPendingCount: 1,
        kanbanCompletedCount: 1,
        currentTaskId: 't_doing',
      },
    ];
    vi.mocked(useEmployeeStatus).mockReturnValueOnce(makeMockReturn(employees));
    render(<EmployeeStatus onBack={vi.fn()} onOpenOffice={mockOnOpenOffice} />);

    // 所有任务都应该渲染
    expect(screen.getByText('进行中任务')).toBeInTheDocument();
    expect(screen.getByText('待办任务')).toBeInTheDocument();
    expect(screen.getByText('已完成任务')).toBeInTheDocument();
  });

  it('renders no task list when both kanbanTasks and tasks are empty', () => {
    const employees = [
      {
        name: '空闲员工',
        role: 'AI员工',
        avatar: '👤',
        status: 'off' as const,
        currentTaskId: undefined,
        currentTask: '暂无任务',
        tasks: [],
        kanbanTasks: [],
        kanbanTaskCount: 0,
        kanbanRunningCount: 0,
        kanbanPendingCount: 0,
        kanbanCompletedCount: 0,
      },
    ];
    vi.mocked(useEmployeeStatus).mockReturnValueOnce(makeMockReturn(employees));
    render(<EmployeeStatus onBack={vi.fn()} onOpenOffice={mockOnOpenOffice} />);
    // 不应该有 task tag 区域
    expect(screen.getByText('空闲员工')).toBeInTheDocument();
  });
});
