import { describe, it, expect } from 'vitest';
import {
  getAnimationState,
  getSpriteForState,
  getDeskLayouts,
  calcScale,
} from '../officeLayout';
import {
  SITTING_SPRITE,
  TYPING_1,
  TYPING_2,
  STANDING_SPRITE,
} from '../sprites';

describe('officeLayout', () => {
  describe('getAnimationState', () => {
    it('returns empty for off status', () => {
      expect(getAnimationState('off', 0)).toBe('empty');
      expect(getAnimationState('off', 5)).toBe('empty');
    });

    it('returns standing for standby status', () => {
      expect(getAnimationState('standby', 0)).toBe('standing');
      expect(getAnimationState('standby', 3)).toBe('standing');
    });

    it('alternates typing frames for working status', () => {
      expect(getAnimationState('working', 0)).toBe('typing1');
      expect(getAnimationState('working', 1)).toBe('typing2');
      expect(getAnimationState('working', 2)).toBe('typing1');
      expect(getAnimationState('working', 3)).toBe('typing2');
    });
  });

  describe('getSpriteForState', () => {
    it('returns correct sprites for each state', () => {
      expect(getSpriteForState('sitting')).toBe(SITTING_SPRITE);
      expect(getSpriteForState('typing1')).toBe(TYPING_1);
      expect(getSpriteForState('typing2')).toBe(TYPING_2);
      expect(getSpriteForState('standing')).toBe(STANDING_SPRITE);
      expect(getSpriteForState('empty')).toBeNull();
    });
  });

  describe('getDeskLayouts', () => {
    it('returns 5 desk layouts', () => {
      const layouts = getDeskLayouts(600, 400);
      expect(layouts).toHaveLength(5);
    });

    it('has correct employee labels', () => {
      const layouts = getDeskLayouts(600, 400);
      const labels = layouts.map((l) => l.label);
      expect(labels).toEqual(['老财', '铁壳', '小K', '404', '裁判君']);
    });

    it('has correct avatars', () => {
      const layouts = getDeskLayouts(600, 400);
      const avatars = layouts.map((l) => l.avatar);
      expect(avatars).toEqual(['💰', '🤖', '🔍', '💻', '⚖️']);
    });

    it('positions desks in 2 rows', () => {
      const layouts = getDeskLayouts(600, 400);
      const row0Y = layouts[0].y;
      const row1Y = layouts[3].y;
      expect(row1Y).toBeGreaterThan(row0Y);
    });

    it('positions desks in 3 columns for first row', () => {
      const layouts = getDeskLayouts(600, 400);
      expect(layouts[0].x).toBeLessThan(layouts[1].x);
      expect(layouts[1].x).toBeLessThan(layouts[2].x);
    });
  });

  describe('calcScale', () => {
    it('returns at least 2', () => {
      expect(calcScale(100)).toBeGreaterThanOrEqual(2);
    });

    it('scales proportionally to canvas width', () => {
      const s1 = calcScale(200);
      const s2 = calcScale(400);
      expect(s2).toBeGreaterThanOrEqual(s1);
    });
  });
});
