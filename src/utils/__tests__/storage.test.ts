import { describe, it, expect, beforeEach } from 'vitest';
import { loadFromStorage, saveToStorage } from '../storage';

describe('loadFromStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns fallback when empty', () => {
    expect(loadFromStorage('default')).toBe('default');
  });

  it('returns parsed data when exists', () => {
    localStorage.setItem('hermes_chat_sessions', JSON.stringify({ a: 1 }));
    expect(loadFromStorage({})).toEqual({ a: 1 });
  });

  it('returns fallback on invalid JSON', () => {
    localStorage.setItem('hermes_chat_sessions', 'invalid');
    expect(loadFromStorage('fallback')).toBe('fallback');
  });
});

describe('saveToStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves data to localStorage', () => {
    saveToStorage({ test: true });
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'hermes_chat_sessions',
      JSON.stringify({ test: true }),
    );
  });

  it('handles circular reference gracefully', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    // Should not throw
    expect(() => saveToStorage(circular)).not.toThrow();
  });
});
