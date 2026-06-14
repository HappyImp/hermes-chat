/** Pixel art color palette - retro 8-bit style */
export const PALETTE = {
  transparent: 'transparent',
  skin: '#FFD4A3',
  skinDark: '#E8B87A',
  hair: '#4A3728',
  hairLight: '#6B5040',
  shirt: '#4488CC',
  shirtDark: '#336699',
  pants: '#334466',
  pantsDark: '#223355',
  shoes: '#222222',
  desk: '#8B6914',
  deskDark: '#6B4F0E',
  deskLight: '#A88232',
  monitor: '#222222',
  monitorScreen: '#33FF66',
  monitorScreenDim: '#228844',
  chair: '#555555',
  chairDark: '#333333',
  chairLight: '#777777',
  coffee: '#8B4513',
  coffeeLight: '#D2691E',
  floor: '#D4C4A8',
  floorDark: '#C4B498',
  wall: '#8899AA',
  wallDark: '#667788',
  wallLight: '#99AABB',
  white: '#FFFFFF',
  black: '#000000',
  outline: '#333333',
  statusGreen: '#33FF66',
  statusYellow: '#FFD700',
  statusGray: '#888888',
} as const;

export type PixelGrid = (string | null)[][];

/** Draw a single pixel (scaled) on canvas */
export function drawPixel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  scale: number,
): void {
  if (color === 'transparent' || color === PALETTE.transparent) return;
  ctx.fillStyle = color;
  ctx.fillRect(x * scale, y * scale, scale, scale);
}

/** Draw a pixel grid (sprite) at position */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: PixelGrid,
  offsetX: number,
  offsetY: number,
  scale: number,
): void {
  for (let row = 0; row < sprite.length; row++) {
    for (let col = 0; col < sprite[row].length; col++) {
      const color = sprite[row][col];
      if (color) drawPixel(ctx, offsetX + col, offsetY + row, color, scale);
    }
  }
}

/** Floor tile pattern (16x16) */
export function createFloorPattern(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scale: number,
): void {
  const tileSize = 8;
  for (let y = 0; y < height; y += tileSize) {
    for (let x = 0; x < width; x += tileSize) {
      const isAlt = ((x / tileSize) + (y / tileSize)) % 2 === 0;
      ctx.fillStyle = isAlt ? PALETTE.floor : PALETTE.floorDark;
      ctx.fillRect(x * scale, y * scale, tileSize * scale, tileSize * scale);
    }
  }
}

/** Draw a simple outline rect */
export function drawOutlineRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  scale: number,
): void {
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = scale;
  ctx.strokeRect(x * scale, y * scale, w * scale, h * scale);
}
