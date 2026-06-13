import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmployeeStatus } from '../Sidebar/EmployeeStatus';

const mockRefresh = vi.fn();

vi.mock('@/hooks/useEmployeeStatus', () => ({
  useEmployeeStatus: () => ({
    employees: [
      {
        name: '老财',
        role: 'AI操盘手',
        avatar: '💰',
        status: 'working',
        currentTask: '盘前研判分析',
        tasks: ['盘前研判', '开盘异动', '午盘复盘'],
      },
      {
        name: '铁壳',
        role: 'AI运维工程师',
        avatar: '🤖',
        status: 'standby',
        currentTask: '待命中',
        tasks: ['每日日报', '运维护航'],
      },
      {
        name: '裁判君',
        role: 'AI审查官',
        avatar: '⚖️',
        status: 'off',
        currentTask: '休息中',
        tasks: ['按需审查'],
      },
    ],
    lastUpdated: new Date('2026-06-14T10:00:00'),
    refresh: mockRefresh,
  }),
}));

describe('EmployeeStatus', () => {
  beforeEach(() => {
    localStorage.clear();
    mockRefresh.mockClear();
  });

  it('renders the panel header', () => {
    render(<EmployeeStatus onBack={vi.fn()} />);
    expect(screen.getByText(/员工状态/)).toBeInTheDocument();
  });

  it('shows all employees', () => {
    render(<EmployeeStatus onBack={vi.fn()} />);
    expect(screen.getByText('老财')).toBeInTheDocument();
    expect(screen.getByText('铁壳')).toBeInTheDocument();
    expect(screen.getByText('裁判君')).toBeInTheDocument();
  });

  it('shows employee roles', () => {
    render(<EmployeeStatus onBack={vi.fn()} />);
    expect(screen.getByText('AI操盘手')).toBeInTheDocument();
    expect(screen.getByText('AI运维工程师')).toBeInTheDocument();
    expect(screen.getByText('AI审查官')).toBeInTheDocument();
  });

  it('shows current tasks', () => {
    render(<EmployeeStatus onBack={vi.fn()} />);
    expect(screen.getByText('盘前研判分析')).toBeInTheDocument();
    expect(screen.getByText('待命中')).toBeInTheDocument();
    expect(screen.getByText('休息中')).toBeInTheDocument();
  });

  it('shows task tags', () => {
    render(<EmployeeStatus onBack={vi.fn()} />);
    expect(screen.getByText('盘前研判')).toBeInTheDocument();
    expect(screen.getByText('每日日报')).toBeInTheDocument();
    expect(screen.getByText('按需审查')).toBeInTheDocument();
  });

  it('shows status summary with working count', () => {
    render(<EmployeeStatus onBack={vi.fn()} />);
    expect(screen.getByText('1')).toBeInTheDocument(); // 1 person working
    expect(screen.getByText(/人工作中/)).toBeInTheDocument();
    expect(screen.getByText(/共 3 人/)).toBeInTheDocument();
  });

  it('shows status labels', () => {
    render(<EmployeeStatus onBack={vi.fn()} />);
    expect(screen.getByText('工作中')).toBeInTheDocument();
    expect(screen.getByText('待命')).toBeInTheDocument();
    expect(screen.getByText('休息')).toBeInTheDocument();
  });

  it('calls onBack when back button clicked', () => {
    const onBack = vi.fn();
    render(<EmployeeStatus onBack={onBack} />);
    const backBtn = screen.getByTitle('返回');
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalled();
  });

  it('calls refresh when refresh button clicked', () => {
    render(<EmployeeStatus onBack={vi.fn()} />);
    const refreshBtn = screen.getByTitle('刷新');
    fireEvent.click(refreshBtn);
    expect(mockRefresh).toHaveBeenCalled();
  });
});
