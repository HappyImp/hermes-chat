import { describe, it, expect, vi } from 'vitest';
import { drawImageSprite, fillWithTile } from '../pixelArt';

/** Create a minimal mock CanvasRenderingContext2D */
function mockCtx(): CanvasRenderingContext2D {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    drawImage: vi.fn(),
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

/** Create a minimal mock HTMLImageElement */
function mockImg(w: number, h: number): HTMLImageElement {
  return { width: w, height: h } as unknown as HTMLImageElement;
}

describe('drawImageSprite', () => {
  it('draws image at scaled position', () => {
    const ctx = mockCtx();
    const img = mockImg(32, 32);
    drawImageSprite(ctx, img, 5, 10, 3);
    expect(ctx.drawImage).toHaveBeenCalledWith(
      img, 15, 30, 96, 96,
    );
  });

  it('disables image smoothing for pixel art', () => {
    const ctx = mockCtx();
    const img = mockImg(16, 16);
    drawImageSprite(ctx, img, 0, 0, 2);
    expect(ctx.imageSmoothingEnabled).toBe(false);
  });

  it('skips null image', () => {
    const ctx = mockCtx();
    drawImageSprite(ctx, null, 0, 0, 2);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe('fillWithTile', () => {
  it('tiles image across area', () => {
    const ctx = mockCtx();
    const tile = mockImg(16, 16);
    fillWithTile(ctx, tile, 0, 0, 48, 48, 2);
    // tile size = 16*2 = 32px, area = 48x48
    // 2x2 = 4 tiles
    expect(ctx.drawImage).toHaveBeenCalledTimes(4);
  });

  it('handles partial tiles at edges', () => {
    const ctx = mockCtx();
    const tile = mockImg(16, 16);
    fillWithTile(ctx, tile, 0, 0, 40, 20, 2);
    // tile = 32px, area = 40x20
    // cols: ceil(40/32)=2, rows: ceil(20/32)=1 => 2 tiles
    expect(ctx.drawImage).toHaveBeenCalledTimes(2);
  });
});
