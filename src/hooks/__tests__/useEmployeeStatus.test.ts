import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEmployeeStatus } from '../useEmployeeStatus';

describe('useEmployeeStatus', () => {
  it('returns employees from data file', () => {
    const { result } = renderHook(() => useEmployeeStatus());
    expect(result.current.employees).toHaveLength(5);
    expect(result.current.employees[0].name).toBe('老财');
    expect(result.current.employees[1].name).toBe('铁壳');
    expect(result.current.employees[2].name).toBe('小K');
    expect(result.current.employees[3].name).toBe('404');
    expect(result.current.employees[4].name).toBe('裁判君');
  });

  it('returns a lastUpdated date', () => {
    const { result } = renderHook(() => useEmployeeStatus());
    expect(result.current.lastUpdated).toBeInstanceOf(Date);
  });

  it('updates lastUpdated on refresh', () => {
    const { result } = renderHook(() => useEmployeeStatus());
    const before = result.current.lastUpdated.getTime();
    act(() => {
      result.current.refresh();
    });
    expect(result.current.lastUpdated.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('refresh returns same employees', () => {
    const { result } = renderHook(() => useEmployeeStatus());
    const countBefore = result.current.employees.length;
    act(() => {
      result.current.refresh();
    });
    expect(result.current.employees).toHaveLength(countBefore);
  });
});
