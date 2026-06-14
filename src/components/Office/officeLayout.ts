import type { Employee } from '@/types/employee';
import type { PixelGrid } from './pixelArt';
import {
  SITTING_SPRITE,
  TYPING_1,
  TYPING_2,
  STANDING_SPRITE,
} from './sprites';

export type AnimationState = 'sitting' | 'typing1' | 'typing2' | 'standing' | 'empty';

/** Map employee status to animation state */
export function getAnimationState(
  status: Employee['status'],
  frame: number,
): AnimationState {
  if (status === 'off') return 'empty';
  if (status === 'standby') return 'standing';
  return frame % 2 === 0 ? 'typing1' : 'typing2';
}

/** Get sprite for current animation state */
export function getSpriteForState(state: AnimationState): PixelGrid | null {
  switch (state) {
    case 'sitting': return SITTING_SPRITE;
    case 'typing1': return TYPING_1;
    case 'typing2': return TYPING_2;
    case 'standing': return STANDING_SPRITE;
    case 'empty': return null;
  }
}

/** Desks are laid out in a grid: 2 rows x 3 cols (5 used) */
export interface DeskLayout {
  x: number;
  y: number;
  label: string;
  avatar: string;
}

/** Calculate desk positions for a given canvas size */
export function getDeskLayouts(
  canvasW: number,
  canvasH: number,
): DeskLayout[] {
  const marginX = canvasW * 0.08;
  const marginTop = canvasH * 0.15;
  const colSpacing = (canvasW - marginX * 2) / 3;
  const rowSpacing = canvasH * 0.32;
  const employees = ['老财', '铁壳', '小K', '404', '裁判君'];
  const avatars = ['💰', '🤖', '🔍', '💻', '⚖️'];
  return employees.map((name, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    return {
      x: marginX + col * colSpacing,
      y: marginTop + row * rowSpacing,
      label: name,
      avatar: avatars[i],
    };
  });
}

/** Pixel scale factor based on canvas width */
export function calcScale(canvasW: number): number {
  return Math.max(2, Math.floor(canvasW / 200));
}
