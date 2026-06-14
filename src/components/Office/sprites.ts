import { PALETTE, type PixelGrid } from './pixelArt';

const T = null; // transparent
const S = PALETTE.skin;
const H = PALETTE.hair;
const B = PALETTE.shirt;
const D = PALETTE.shirtDark;
const P = PALETTE.pants;
const K = PALETTE.shoes;
const W = PALETTE.white;
const SC = PALETTE.monitorScreen;

/** Sitting character facing forward (16x20) - working state */
export const SITTING_SPRITE: PixelGrid = [
  [T, T, T, H, H, H, H, T, T, T, T, T, T, T, T, T],
  [T, T, H, H, H, H, H, H, T, T, T, T, T, T, T, T],
  [T, T, H, S, S, S, S, H, T, T, T, T, T, T, T, T],
  [T, T, S, S, W, S, W, S, T, T, T, T, T, T, T, T],
  [T, T, S, S, S, S, S, S, T, T, T, T, T, T, T, T],
  [T, T, T, S, S, S, S, T, T, T, T, T, T, T, T, T],
  [T, T, T, T, B, B, T, T, T, T, T, T, T, T, T, T],
  [T, T, T, B, B, B, B, T, T, T, T, T, T, T, T, T],
  [T, T, T, B, B, B, B, T, T, T, T, T, T, T, T, T],
  [T, S, T, B, D, D, B, T, S, T, T, T, T, T, T, T],
  [T, S, T, B, D, D, B, T, S, T, T, T, T, T, T, T],
  [T, T, T, B, B, B, B, T, T, T, T, T, T, T, T, T],
  [T, T, T, T, P, P, T, T, T, T, T, T, T, T, T, T],
  [T, T, T, T, P, P, T, T, T, T, T, T, T, T, T, T],
  [T, T, T, P, P, P, P, T, T, T, T, T, T, T, T, T],
  [T, T, T, P, P, P, P, T, T, T, T, T, T, T, T, T],
  [T, T, T, P, T, T, P, T, T, T, T, T, T, T, T, T],
  [T, T, T, K, T, T, K, T, T, T, T, T, T, T, T, T],
];

/** Typing animation frame 1 - hands forward */
export const TYPING_1: PixelGrid = [
  [T, T, T, H, H, H, H, T, T, T, T, T, T, T, T, T],
  [T, T, H, H, H, H, H, H, T, T, T, T, T, T, T, T],
  [T, T, H, S, S, S, S, H, T, T, T, T, T, T, T, T],
  [T, T, S, S, W, S, W, S, T, T, T, T, T, T, T, T],
  [T, T, S, S, S, S, S, S, T, T, T, T, T, T, T, T],
  [T, T, T, S, S, S, S, T, T, T, T, T, T, T, T, T],
  [T, T, T, T, B, B, T, T, T, T, T, T, T, T, T, T],
  [T, T, T, B, B, B, B, T, T, T, T, T, T, T, T, T],
  [T, T, T, B, B, B, B, T, T, T, T, T, T, T, T, T],
  [T, T, S, B, D, D, B, S, T, T, T, T, T, T, T, T],
  [T, T, S, B, D, D, B, S, T, T, T, T, T, T, T, T],
  [T, T, T, B, B, B, B, T, T, T, T, T, T, T, T, T],
  [T, T, T, T, P, P, T, T, T, T, T, T, T, T, T, T],
  [T, T, T, T, P, P, T, T, T, T, T, T, T, T, T, T],
  [T, T, T, P, P, P, P, T, T, T, T, T, T, T, T, T],
  [T, T, T, P, P, P, P, T, T, T, T, T, T, T, T, T],
  [T, T, T, P, T, T, P, T, T, T, T, T, T, T, T, T],
  [T, T, T, K, T, T, K, T, T, T, T, T, T, T, T, T],
];

/** Typing animation frame 2 - hands shifted */
export const TYPING_2: PixelGrid = [
  [T, T, T, H, H, H, H, T, T, T, T, T, T, T, T, T],
  [T, T, H, H, H, H, H, H, T, T, T, T, T, T, T, T],
  [T, T, H, S, S, S, S, H, T, T, T, T, T, T, T, T],
  [T, T, S, S, W, S, W, S, T, T, T, T, T, T, T, T],
  [T, T, S, S, S, S, S, S, T, T, T, T, T, T, T, T],
  [T, T, T, S, S, S, S, T, T, T, T, T, T, T, T, T],
  [T, T, T, T, B, B, T, T, T, T, T, T, T, T, T, T],
  [T, T, T, B, B, B, B, T, T, T, T, T, T, T, T, T],
  [T, T, T, B, B, B, B, T, T, T, T, T, T, T, T, T],
  [T, S, T, B, D, D, B, T, S, T, T, T, T, T, T, T],
  [T, S, T, B, D, D, B, T, S, T, T, T, T, T, T, T],
  [T, T, T, B, B, B, B, T, T, T, T, T, T, T, T, T],
  [T, T, T, T, P, P, T, T, T, T, T, T, T, T, T, T],
  [T, T, T, T, P, P, T, T, T, T, T, T, T, T, T, T],
  [T, T, T, P, P, P, P, T, T, T, T, T, T, T, T, T],
  [T, T, T, P, P, P, P, T, T, T, T, T, T, T, T, T],
  [T, T, T, P, T, T, P, T, T, T, T, T, T, T, T, T],
  [T, T, T, K, T, T, K, T, T, T, T, T, T, T, T, T],
];

/** Standing character (16x20) - standby/idle state */
export const STANDING_SPRITE: PixelGrid = [
  [T, T, T, H, H, H, H, T, T, T, T, T, T, T, T, T],
  [T, T, H, H, H, H, H, H, T, T, T, T, T, T, T, T],
  [T, T, H, S, S, S, S, H, T, T, T, T, T, T, T, T],
  [T, T, S, S, W, S, W, S, T, T, T, T, T, T, T, T],
  [T, T, S, S, S, S, S, S, T, T, T, T, T, T, T, T],
  [T, T, T, S, S, S, S, T, T, T, T, T, T, T, T, T],
  [T, T, T, T, B, B, T, T, T, T, T, T, T, T, T, T],
  [T, T, T, B, B, B, B, T, T, T, T, T, T, T, T, T],
  [T, T, T, B, B, B, B, T, T, T, T, T, T, T, T, T],
  [T, T, T, B, D, D, B, T, T, T, T, T, T, T, T, T],
  [T, S, S, B, D, D, B, S, S, T, T, T, T, T, T, T],
  [T, T, T, B, B, B, B, T, T, T, T, T, T, T, T, T],
  [T, T, T, T, P, P, T, T, T, T, T, T, T, T, T, T],
  [T, T, T, T, P, P, T, T, T, T, T, T, T, T, T, T],
  [T, T, T, T, P, P, T, T, T, T, T, T, T, T, T, T],
  [T, T, T, T, P, P, T, T, T, T, T, T, T, T, T, T],
  [T, T, T, P, T, T, P, T, T, T, T, T, T, T, T, T],
  [T, T, T, K, T, T, K, T, T, T, T, T, T, T, T, T],
];

/** Coffee cup sprite (8x8) */
export const COFFEE_SPRITE: PixelGrid = [
  [T, T, T, T, T, T, T, T],
  [T, T, T, PALETTE.coffeeLight, T, T, T, T],
  [T, PALETTE.coffee, PALETTE.coffee, PALETTE.coffee, PALETTE.coffee, T, T, T],
  [T, PALETTE.coffee, W, PALETTE.coffee, PALETTE.coffee, PALETTE.coffee, T, T],
  [T, PALETTE.coffee, PALETTE.coffee, PALETTE.coffee, PALETTE.coffee, PALETTE.coffee, T, T],
  [T, T, PALETTE.coffee, PALETTE.coffee, PALETTE.coffee, T, T, T],
  [T, T, T, PALETTE.coffee, T, T, T, T],
  [T, T, T, T, T, T, T, T],
];

/** Desk sprite (24x12) */
export const DESK_SPRITE: PixelGrid = [
  [T, PALETTE.deskLight, PALETTE.deskLight, PALETTE.deskLight, PALETTE.deskLight, PALETTE.deskLight, PALETTE.deskLight, PALETTE.deskLight, PALETTE.deskLight, PALETTE.deskLight, PALETTE.deskLight, PALETTE.deskLight, PALETTE.deskLight, PALETTE.deskLight, PALETTE.deskLight, PALETTE.deskLight, PALETTE.deskLight, PALETTE.deskLight, PALETTE.deskLight, PALETTE.deskLight, PALETTE.deskLight, PALETTE.deskLight, PALETTE.deskLight, T],
  [T, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, T],
  [T, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, T],
  [T, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, PALETTE.desk, T],
  [T, PALETTE.deskDark, PALETTE.deskDark, PALETTE.deskDark, PALETTE.deskDark, PALETTE.deskDark, PALETTE.deskDark, PALETTE.deskDark, PALETTE.deskDark, PALETTE.deskDark, PALETTE.deskDark, PALETTE.deskDark, PALETTE.deskDark, PALETTE.deskDark, PALETTE.deskDark, PALETTE.deskDark, PALETTE.deskDark, PALETTE.deskDark, PALETTE.deskDark, PALETTE.deskDark, PALETTE.deskDark, PALETTE.deskDark, PALETTE.deskDark, T],
  [T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T],
  [T, PALETTE.deskDark, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, PALETTE.deskDark, T],
  [T, PALETTE.deskDark, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, PALETTE.deskDark, T],
  [T, PALETTE.deskDark, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, PALETTE.deskDark, T],
  [T, PALETTE.deskDark, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, PALETTE.deskDark, T],
  [T, PALETTE.deskDark, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, PALETTE.deskDark, T],
  [T, PALETTE.deskDark, PALETTE.deskDark, PALETTE.deskDark, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, PALETTE.deskDark, PALETTE.deskDark, PALETTE.deskDark, T],
];

/** Monitor sprite (12x10) */
export const MONITOR_SPRITE: PixelGrid = [
  [T, PALETTE.monitor, PALETTE.monitor, PALETTE.monitor, PALETTE.monitor, PALETTE.monitor, PALETTE.monitor, PALETTE.monitor, PALETTE.monitor, PALETTE.monitor, PALETTE.monitor, T],
  [T, PALETTE.monitor, SC, SC, SC, SC, SC, SC, SC, SC, PALETTE.monitor, T],
  [T, PALETTE.monitor, SC, SC, SC, SC, SC, SC, SC, SC, PALETTE.monitor, T],
  [T, PALETTE.monitor, SC, SC, SC, SC, SC, SC, SC, SC, PALETTE.monitor, T],
  [T, PALETTE.monitor, SC, SC, SC, SC, SC, SC, SC, SC, PALETTE.monitor, T],
  [T, PALETTE.monitor, SC, SC, SC, SC, SC, SC, SC, SC, PALETTE.monitor, T],
  [T, PALETTE.monitor, PALETTE.monitor, PALETTE.monitor, PALETTE.monitor, PALETTE.monitor, PALETTE.monitor, PALETTE.monitor, PALETTE.monitor, PALETTE.monitor, PALETTE.monitor, T],
  [T, T, T, T, PALETTE.monitor, PALETTE.monitor, PALETTE.monitor, PALETTE.monitor, T, T, T, T],
  [T, T, T, T, T, PALETTE.monitor, PALETTE.monitor, T, T, T, T, T],
  [T, T, T, PALETTE.monitor, PALETTE.monitor, PALETTE.monitor, PALETTE.monitor, PALETTE.monitor, PALETTE.monitor, T, T, T],
];

/** Chair sprite (10x10) */
export const CHAIR_SPRITE: PixelGrid = [
  [T, T, PALETTE.chairLight, PALETTE.chairLight, PALETTE.chairLight, PALETTE.chairLight, PALETTE.chairLight, PALETTE.chairLight, T, T],
  [T, T, PALETTE.chair, PALETTE.chair, PALETTE.chair, PALETTE.chair, PALETTE.chair, PALETTE.chair, T, T],
  [T, T, PALETTE.chair, PALETTE.chair, PALETTE.chair, PALETTE.chair, PALETTE.chair, PALETTE.chair, T, T],
  [T, T, PALETTE.chair, PALETTE.chair, PALETTE.chair, PALETTE.chair, PALETTE.chair, PALETTE.chair, T, T],
  [T, T, PALETTE.chair, PALETTE.chair, PALETTE.chair, PALETTE.chair, PALETTE.chair, PALETTE.chair, T, T],
  [T, T, T, PALETTE.chairDark, PALETTE.chairDark, PALETTE.chairDark, PALETTE.chairDark, T, T, T],
  [T, T, T, T, PALETTE.chairDark, PALETTE.chairDark, T, T, T, T],
  [T, T, T, T, PALETTE.chairDark, PALETTE.chairDark, T, T, T, T],
  [T, T, PALETTE.chairDark, T, T, T, T, PALETTE.chairDark, T, T],
  [T, T, PALETTE.chairDark, T, T, T, T, PALETTE.chairDark, T, T],
];
