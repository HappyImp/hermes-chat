import { describe, it, expect, vi } from 'vitest';
import {
  drawPixel,
  drawSprite,
  createFloorPattern,
  drawOutlineRect,
  PALETTE,
} from '../pixelArt';

/** Create a minimal mock CanvasRenderingContext2D */
function mockCtx(): CanvasRenderingContext2D {
  const calls: string[] = [];
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    fillRect: vi.fn(() => calls.push('fillRect')),
    strokeRect: vi.fn(() => calls.push('strokeRect')),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    textAlign: 'start',
    font: '',
  } as unknown as CanvasRenderingContext2D;
}

describe('pixelArt', () => {
  describe('drawPixel', () => {
    it('draws a filled rect at scaled position', () => {
      const ctx = mockCtx();
      drawPixel(ctx, 3, 5, '#FF0000', 4);
      expect(ctx.fillStyle).toBe('#FF0000');
      expect(ctx.fillRect).toHaveBeenCalledWith(12, 20, 4, 4);
    });

    it('skips transparent pixels', () => {
      const ctx = mockCtx();
      drawPixel(ctx, 0, 0, 'transparent', 4);
      expect(ctx.fillRect).not.toHaveBeenCalled();
    });

    it('skips null-like transparent palette color', () => {
      const ctx = mockCtx();
      drawPixel(ctx, 0, 0, PALETTE.transparent, 4);
      expect(ctx.fillRect).not.toHaveBeenCalled();
    });
  });

  describe('drawSprite', () => {
    it('draws all non-null pixels in grid', () => {
      const ctx = mockCtx();
      const sprite = [
        ['#FF0000', null],
        [null, '#00FF00'],
      ];
      drawSprite(ctx, sprite, 10, 20, 2);
      // First pixel: (10+0)*2=20, (20+0)*2=40
      expect(ctx.fillRect).toHaveBeenCalledWith(20, 40, 2, 2);
      // Second pixel: (10+1)*2=22, (20+1)*2=42
      expect(ctx.fillRect).toHaveBeenCalledWith(22, 42, 2, 2);
    });

    it('skips null pixels', () => {
      const ctx = mockCtx();
      const sprite = [[null, null]];
      drawSprite(ctx, sprite, 0, 0, 4);
      expect(ctx.fillRect).not.toHaveBeenCalled();
    });

    it('handles empty sprite', () => {
      const ctx = mockCtx();
      drawSprite(ctx, [], 0, 0, 4);
      expect(ctx.fillRect).not.toHaveBeenCalled();
    });
  });

  describe('createFloorPattern', () => {
    it('fills the entire area with alternating tiles', () => {
      const ctx = mockCtx();
      createFloorPattern(ctx, 16, 8, 4);
      // 2x1 tiles = 2 fillRect calls
      expect(ctx.fillRect).toHaveBeenCalledTimes(2);
    });
  });

  describe('drawOutlineRect', () => {
    it('draws a stroke rect at scaled position', () => {
      const ctx = mockCtx();
      drawOutlineRect(ctx, 5, 10, 20, 30, 3);
      expect(ctx.strokeRect).toHaveBeenCalledWith(15, 30, 60, 90);
    });
  });
});
