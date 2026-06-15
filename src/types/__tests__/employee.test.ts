import { describe, it, expect } from 'vitest';
import { kanbanStatusToEmployeeStatus } from '../employee';

describe('kanbanStatusToEmployeeStatus', () => {
  it('maps "doing" to "working"', () => {
    expect(kanbanStatusToEmployeeStatus('doing')).toBe('working');
  });

  it('maps "todo" to "standby"', () => {
    expect(kanbanStatusToEmployeeStatus('todo')).toBe('standby');
  });

  it('maps "done" to "completed"', () => {
    expect(kanbanStatusToEmployeeStatus('done')).toBe('completed');
  });

  it('maps unknown status to "off"', () => {
    expect(kanbanStatusToEmployeeStatus('unknown')).toBe('off');
    expect(kanbanStatusToEmployeeStatus('')).toBe('off');
    expect(kanbanStatusToEmployeeStatus('cancelled')).toBe('off');
  });
});
