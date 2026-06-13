import { describe, it, expect } from 'vitest';
import { generateId } from '../uuid';

describe('generateId', () => {
  it('returns a string', () => {
    expect(typeof generateId()).toBe('string');
  });

  it('returns unique values', () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
  });

  it('matches UUID format', () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
