/**
 * Sprite asset loader — loads all PNG sprites for the office scene.
 * Assets are pre-generated pixel art stored in public/assets/office/.
 */

export interface OfficeSprites {
  sitting: HTMLImageElement;
  typing1: HTMLImageElement;
  typing2: HTMLImageElement;
  standing: HTMLImageElement;
  desk: HTMLImageElement;
  chair: HTMLImageElement;
  plant: HTMLImageElement;
  coffee: HTMLImageElement;
  monitor: HTMLImageElement;
  wallTile: HTMLImageElement;
  floorTile: HTMLImageElement;
  window: HTMLImageElement;
  statusWorking: HTMLImageElement;
  statusStandby: HTMLImageElement;
  statusOff: HTMLImageElement;
}

const BASE = `${import.meta.env.BASE_URL}assets/office`;

/** Load a single image, returns a promise that resolves with the Image. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

/** Load all office sprites in parallel. */
export async function loadOfficeSprites(): Promise<OfficeSprites> {
  const [
    sitting, typing1, typing2, standing,
    desk, chair, plant, coffee, monitor,
    wallTile, floorTile, window,
    statusWorking, statusStandby, statusOff,
  ] = await Promise.all([
    loadImage(`${BASE}/char-sitting.png`),
    loadImage(`${BASE}/char-typing1.png`),
    loadImage(`${BASE}/char-typing2.png`),
    loadImage(`${BASE}/char-standing.png`),
    loadImage(`${BASE}/desk.png`),
    loadImage(`${BASE}/chair.png`),
    loadImage(`${BASE}/plant.png`),
    loadImage(`${BASE}/coffee.png`),
    loadImage(`${BASE}/monitor.png`),
    loadImage(`${BASE}/wall-tile.png`),
    loadImage(`${BASE}/floor-tile.png`),
    loadImage(`${BASE}/window.png`),
    loadImage(`${BASE}/status-working.png`),
    loadImage(`${BASE}/status-standby.png`),
    loadImage(`${BASE}/status-off.png`),
  ]);
  return {
    sitting, typing1, typing2, standing,
    desk, chair, plant, coffee, monitor,
    wallTile, floorTile, window,
    statusWorking, statusStandby, statusOff,
  };
}
