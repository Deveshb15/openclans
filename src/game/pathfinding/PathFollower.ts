// ============================================================
// MoltClans - Path Follower (smooth interpolation along path)
// ============================================================

import type { TerrainType } from "../../shared/types";

/** Movement speed by terrain (tiles per second) */
const SPEED_BY_TERRAIN: Record<string, number> = {
  road: 2.5,
  grass: 1.8,
  dirt: 1.5,
  stone: 1.2,
  sand: 1.0,
  water: 0.5,
};

export class PathFollower {
  private path: Array<{ x: number; y: number }> = [];
  private currentIndex = 0;
  private progress = 0; // 0-1 between current and next waypoint

  public x = 0;
  public y = 0;
  public active = false;
  public arrived = false;
  public speed = 1.8;

  /** Start following a new path */
  startPath(path: Array<{ x: number; y: number }>): void {
    if (path.length === 0) {
      this.active = false;
      this.arrived = true;
      return;
    }

    this.path = path;
    this.currentIndex = 0;
    this.progress = 0;
    this.x = path[0].x;
    this.y = path[0].y;
    this.active = true;
    this.arrived = false;
  }

  /** Set speed based on terrain at current position */
  setTerrain(terrain: TerrainType | "road"): void {
    this.speed = SPEED_BY_TERRAIN[terrain] ?? 1.8;
  }

  /**
   * Update position along the path.
   * @param dt Delta time in seconds
   * @returns Movement delta {dx, dy} for direction computation
   */
  update(dt: number): { dx: number; dy: number } {
    if (!this.active || this.path.length === 0) {
      return { dx: 0, dy: 0 };
    }

    if (this.currentIndex >= this.path.length - 1) {
      this.active = false;
      this.arrived = true;
      return { dx: 0, dy: 0 };
    }

    const curr = this.path[this.currentIndex];
    const next = this.path[this.currentIndex + 1];

    const segDx = next.x - curr.x;
    const segDy = next.y - curr.y;
    const segLen = Math.sqrt(segDx * segDx + segDy * segDy);

    if (segLen === 0) {
      this.currentIndex++;
      return { dx: 0, dy: 0 };
    }

    // Advance progress
    this.progress += (this.speed * dt) / segLen;

    if (this.progress >= 1) {
      this.currentIndex++;
      this.progress = 0;

      if (this.currentIndex >= this.path.length - 1) {
        const last = this.path[this.path.length - 1];
        this.x = last.x;
        this.y = last.y;
        this.active = false;
        this.arrived = true;
        return { dx: segDx, dy: segDy };
      }
    }

    // Interpolate
    const p = Math.min(1, this.progress);
    const c = this.path[this.currentIndex];
    const n = this.path[Math.min(this.currentIndex + 1, this.path.length - 1)];
    this.x = c.x + (n.x - c.x) * p;
    this.y = c.y + (n.y - c.y) * p;

    return { dx: n.x - c.x, dy: n.y - c.y };
  }

  /** Stop following immediately */
  stop(): void {
    this.active = false;
    this.arrived = true;
    this.path = [];
  }

  /** Get remaining path length */
  get remainingSteps(): number {
    return Math.max(0, this.path.length - 1 - this.currentIndex);
  }
}
