import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from '../useToast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with no message', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.message).toBeNull();
  });

  it('shows toast message', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast('hello'));
    expect(result.current.message).toBe('hello');
  });

  it('hides toast after 2 seconds', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast('hello'));
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.message).toBeNull();
  });

  it('resets timer on new toast', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast('first'));
    act(() => vi.advanceTimersByTime(1000));
    act(() => result.current.showToast('second'));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.message).toBe('second');
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.message).toBeNull();
  });
});
