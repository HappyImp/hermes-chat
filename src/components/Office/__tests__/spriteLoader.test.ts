import { describe, it, expect } from 'vitest';
import { loadImage } from '../spriteLoader';

describe('spriteLoader', () => {
  describe('loadImage', () => {
    it('resolves with image on successful load', async () => {
      const OriginalImage = globalThis.Image;
      class MockImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        _src = '';
        get src() { return this._src; }
        set src(v: string) {
          this._src = v;
          setTimeout(() => this.onload?.(), 0);
        }
      }
      (globalThis as Record<string, unknown>).Image = MockImage;

      const result = await loadImage('/test.png');
      expect(result).toBeDefined();

      globalThis.Image = OriginalImage;
    });

    it('rejects on failed load', async () => {
      const OriginalImage = globalThis.Image;
      class MockImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        _src = '';
        get src() { return this._src; }
        set src(v: string) {
          this._src = v;
          setTimeout(() => this.onerror?.(), 0);
        }
      }
      (globalThis as Record<string, unknown>).Image = MockImage;

      await expect(loadImage('/bad.png')).rejects.toThrow('Failed to load');

      globalThis.Image = OriginalImage;
    });
  });
});
