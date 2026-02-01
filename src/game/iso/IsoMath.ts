// ============================================================
// MoltClans - Isometric Math Helpers
// ============================================================

import { ISO_TILE_WIDTH, ISO_TILE_HEIGHT } from "../../shared/constants";

/**
 * Convert grid (col, row) to screen (x, y) in isometric space.
 * Origin (0,0) maps to the top-center of the diamond.
 */
export function gridToScreen(col: number, row: number): { x: number; y: number } {
  return {
    x: (col - row) * (ISO_TILE_WIDTH / 2),
    y: (col + row) * (ISO_TILE_HEIGHT / 2),
  };
}

/**
 * Convert screen (x, y) back to grid (col, row).
 * Returns fractional values — caller should floor/round as needed.
 */
export function screenToGrid(screenX: number, screenY: number): { col: number; row: number } {
  const halfW = ISO_TILE_WIDTH / 2;
  const halfH = ISO_TILE_HEIGHT / 2;
  return {
    col: (screenX / halfW + screenY / halfH) / 2,
    row: (screenY / halfH - screenX / halfW) / 2,
  };
}

/**
 * Depth sort key for an entity at (col, row).
 * Higher values should render on top (later in draw order).
 */
export function depthKey(col: number, row: number): number {
  return col + row;
}

/**
 * Get the center screen position for a grid cell.
 */
export function gridCenterToScreen(col: number, row: number): { x: number; y: number } {
  return gridToScreen(col + 0.5, row + 0.5);
}

/**
 * Distance between two grid positions (Euclidean).
 */
export function gridDistance(
  c1: number, r1: number,
  c2: number, r2: number,
): number {
  const dc = c2 - c1;
  const dr = r2 - r1;
  return Math.sqrt(dc * dc + dr * dr);
}

/**
 * Compute 8-direction index from a movement delta.
 * Returns 0-7: S, SW, W, NW, N, NE, E, SE
 */
export function directionFromDelta(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return 0; // default south
  const angle = Math.atan2(dy, dx); // radians, 0 = east
  // Convert to 0-7 where 0 = S
  // atan2 gives: right=0, down=pi/2, left=pi, up=-pi/2
  // We want: S=0, SW=1, W=2, NW=3, N=4, NE=5, E=6, SE=7
  const deg = ((angle * 180) / Math.PI + 360) % 360;
  // S=90, SW=135, W=180, NW=225, N=270, NE=315, E=0, SE=45
  const shifted = (deg + 270) % 360; // Now S=0, SW=45, W=90...
  return Math.round(shifted / 45) % 8;
}

export const DIRECTION_NAMES = ["S", "SW", "W", "NW", "N", "NE", "E", "SE"] as const;
export type DirectionName = typeof DIRECTION_NAMES[number];
