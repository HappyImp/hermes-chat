import { describe, it, expect } from 'vitest';
import {
  SITTING_SPRITE,
  TYPING_1,
  TYPING_2,
  STANDING_SPRITE,
  COFFEE_SPRITE,
  DESK_SPRITE,
  MONITOR_SPRITE,
  CHAIR_SPRITE,
} from '../sprites';

describe('sprites', () => {
  const allSprites = [
    { name: 'SITTING_SPRITE', sprite: SITTING_SPRITE, rows: 18, cols: 16 },
    { name: 'TYPING_1', sprite: TYPING_1, rows: 18, cols: 16 },
    { name: 'TYPING_2', sprite: TYPING_2, rows: 18, cols: 16 },
    { name: 'STANDING_SPRITE', sprite: STANDING_SPRITE, rows: 18, cols: 16 },
    { name: 'COFFEE_SPRITE', sprite: COFFEE_SPRITE, rows: 8, cols: 8 },
    { name: 'DESK_SPRITE', sprite: DESK_SPRITE, rows: 12, cols: 24 },
    { name: 'MONITOR_SPRITE', sprite: MONITOR_SPRITE, rows: 10, cols: 12 },
    { name: 'CHAIR_SPRITE', sprite: CHAIR_SPRITE, rows: 10, cols: 10 },
  ];

  allSprites.forEach(({ name, sprite, rows, cols }) => {
    describe(name, () => {
      it(`has correct dimensions (${rows}x${cols})`, () => {
        expect(sprite).toHaveLength(rows);
        sprite.forEach((row) => {
          expect(row).toHaveLength(cols);
        });
      });

      it('contains at least one non-transparent pixel', () => {
        const hasPixel = sprite.some((row) =>
          row.some((cell) => cell !== null),
        );
        expect(hasPixel).toBe(true);
      });
    });
  });

  it('typing sprites differ from each other (animation)', () => {
    const flat1 = TYPING_1.flat();
    const flat2 = TYPING_2.flat();
    const differs = flat1.some((v, i) => v !== flat2[i]);
    expect(differs).toBe(true);
  });

  it('sitting and standing sprites differ', () => {
    const flat1 = SITTING_SPRITE.flat();
    const flat2 = STANDING_SPRITE.flat();
    const differs = flat1.some((v, i) => v !== flat2[i]);
    expect(differs).toBe(true);
  });
});
