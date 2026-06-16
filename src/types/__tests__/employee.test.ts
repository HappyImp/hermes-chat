import { describe, it, expect } from 'vitest';
import {
  kanbanStatusToEmployeeStatus,
  getKanbanStatusLabel,
  getKanbanStatusColor,
  getKanbanStatusTextColor,
} from '../employee';

describe('kanbanStatusToEmployeeStatus', () => {
  it('maps "running" to "working"', () => {
    expect(kanbanStatusToEmployeeStatus('running')).toBe('working');
  });

  it('maps "doing" to "working"', () => {
    expect(kanbanStatusToEmployeeStatus('doing')).toBe('working');
  });

  it('maps "todo" to "standby"', () => {
    expect(kanbanStatusToEmployeeStatus('todo')).toBe('standby');
  });

  it('maps "ready" to "standby"', () => {
    expect(kanbanStatusToEmployeeStatus('ready')).toBe('standby');
  });

  it('maps "done" to "completed"', () => {
    expect(kanbanStatusToEmployeeStatus('done')).toBe('completed');
  });

  it('maps "blocked" to "blocked"', () => {
    expect(kanbanStatusToEmployeeStatus('blocked')).toBe('blocked');
  });

  it('maps unknown status to "off"', () => {
    expect(kanbanStatusToEmployeeStatus('unknown')).toBe('off');
    expect(kanbanStatusToEmployeeStatus('')).toBe('off');
    expect(kanbanStatusToEmployeeStatus('cancelled')).toBe('off');
  });
});

describe('getKanbanStatusLabel', () => {
  it('maps "doing" to "进行中"', () => {
    expect(getKanbanStatusLabel('doing')).toBe('进行中');
  });

  it('maps "running" to "进行中"', () => {
    expect(getKanbanStatusLabel('running')).toBe('进行中');
  });

  it('maps "todo" to "待处理"', () => {
    expect(getKanbanStatusLabel('todo')).toBe('待处理');
  });

  it('maps "ready" to "就绪"', () => {
    expect(getKanbanStatusLabel('ready')).toBe('就绪');
  });

  it('maps "done" to "已完成"', () => {
    expect(getKanbanStatusLabel('done')).toBe('已完成');
  });

  it('maps "completed" to "已完成"', () => {
    expect(getKanbanStatusLabel('completed')).toBe('已完成');
  });

  it('maps "blocked" to "阻塞"', () => {
    expect(getKanbanStatusLabel('blocked')).toBe('阻塞');
  });

  it('returns raw status for unknown values', () => {
    expect(getKanbanStatusLabel('custom')).toBe('custom');
  });

  it('returns "未知" for empty string', () => {
    expect(getKanbanStatusLabel('')).toBe('未知');
  });
});

describe('getKanbanStatusColor', () => {
  it('returns green for "doing"', () => {
    expect(getKanbanStatusColor('doing')).toBe('bg-green-500');
  });

  it('returns green for "running"', () => {
    expect(getKanbanStatusColor('running')).toBe('bg-green-500');
  });

  it('returns amber for "todo"', () => {
    expect(getKanbanStatusColor('todo')).toBe('bg-amber-500');
  });

  it('returns yellow for "ready"', () => {
    expect(getKanbanStatusColor('ready')).toBe('bg-yellow-500');
  });

  it('returns blue for "done"', () => {
    expect(getKanbanStatusColor('done')).toBe('bg-blue-500');
  });

  it('returns blue for "completed"', () => {
    expect(getKanbanStatusColor('completed')).toBe('bg-blue-500');
  });

  it('returns red for "blocked"', () => {
    expect(getKanbanStatusColor('blocked')).toBe('bg-red-500');
  });

  it('returns gray for unknown', () => {
    expect(getKanbanStatusColor('unknown')).toBe('bg-gray-500');
    expect(getKanbanStatusColor('')).toBe('bg-gray-500');
  });
});

describe('getKanbanStatusTextColor', () => {
  it('returns green for "doing"', () => {
    expect(getKanbanStatusTextColor('doing')).toBe('text-green-400');
  });

  it('returns green for "running"', () => {
    expect(getKanbanStatusTextColor('running')).toBe('text-green-400');
  });

  it('returns amber for "todo"', () => {
    expect(getKanbanStatusTextColor('todo')).toBe('text-amber-400');
  });

  it('returns yellow for "ready"', () => {
    expect(getKanbanStatusTextColor('ready')).toBe('text-yellow-400');
  });

  it('returns blue for "done"', () => {
    expect(getKanbanStatusTextColor('done')).toBe('text-blue-400');
  });

  it('returns blue for "completed"', () => {
    expect(getKanbanStatusTextColor('completed')).toBe('text-blue-400');
  });

  it('returns red for "blocked"', () => {
    expect(getKanbanStatusTextColor('blocked')).toBe('text-red-400');
  });

  it('returns gray for unknown', () => {
    expect(getKanbanStatusTextColor('unknown')).toBe('text-gray-400');
    expect(getKanbanStatusTextColor('')).toBe('text-gray-400');
  });
});
