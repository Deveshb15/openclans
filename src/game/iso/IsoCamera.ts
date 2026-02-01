// ============================================================
// MoltClans - Isometric Camera (viewport pan/zoom/follow)
// ============================================================

import {
  GRID_WIDTH,
  GRID_HEIGHT,
  ISO_TILE_WIDTH,
  ISO_TILE_HEIGHT,
} from "../../shared/constants";
import { gridToScreen } from "./IsoMath";

export class IsoCamera {
  // Viewport offset (world coordinates relative to the rendering container)
  public offsetX = 0;
  public offsetY = 0;
  public zoom = 1;

  // Zoom limits
  private readonly minZoom = 0.15;
  private readonly maxZoom = 3;

  // Viewport size (screen pixels)
  public viewWidth = 0;
  public viewHeight = 0;

  // Follow target (screen coords)
  private followX: number | null = null;
  private followY: number | null = null;
  private readonly followEasing = 0.08;

  constructor() {
    // Center on the middle of the grid initially
    this.centerOnGrid(GRID_WIDTH / 2, GRID_HEIGHT / 2);
  }

  /** Set the viewport size (call on init and resize) */
  setViewSize(w: number, h: number): void {
    this.viewWidth = w;
    this.viewHeight = h;
  }

  /** Center the camera on a grid position */
  centerOnGrid(col: number, row: number): void {
    const screen = gridToScreen(col, row);
    this.offsetX = -screen.x * this.zoom + this.viewWidth / 2;
    this.offsetY = -screen.y * this.zoom + this.viewHeight / 2;
  }

  /** Pan the camera by screen delta pixels */
  pan(dx: number, dy: number): void {
    this.followX = null;
    this.followY = null;
    this.offsetX += dx;
    this.offsetY += dy;
  }

  /** Zoom toward a screen point */
  zoomAt(screenX: number, screenY: number, delta: number): void {
    const oldZoom = this.zoom;
    this.zoom *= 1 - delta * 0.001;
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom));

    // Adjust offset so the point under the cursor stays fixed
    const scale = this.zoom / oldZoom;
    this.offsetX = screenX - (screenX - this.offsetX) * scale;
    this.offsetY = screenY - (screenY - this.offsetY) * scale;
  }

  /** Follow a grid position (lerps each frame) */
  followGrid(col: number, row: number): void {
    const screen = gridToScreen(col, row);
    this.followX = screen.x;
    this.followY = screen.y;
  }

  /** Stop following */
  stopFollow(): void {
    this.followX = null;
    this.followY = null;
  }

  /** Navigate to a grid tile (instant center) */
  navigateToTile(col: number, row: number): void {
    this.stopFollow();
    this.centerOnGrid(col + 0.5, row + 0.5);
  }

  /** Update each frame (for follow lerping) */
  update(): void {
    if (this.followX !== null && this.followY !== null) {
      const targetOffsetX = -this.followX * this.zoom + this.viewWidth / 2;
      const targetOffsetY = -this.followY * this.zoom + this.viewHeight / 2;
      this.offsetX += (targetOffsetX - this.offsetX) * this.followEasing;
      this.offsetY += (targetOffsetY - this.offsetY) * this.followEasing;
    }
  }

  /** Convert screen coordinates to world coordinates */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.offsetX) / this.zoom,
      y: (screenY - this.offsetY) / this.zoom,
    };
  }

  /** Get approximate visible grid bounds for minimap viewport rect */
  getVisibleGridBounds(): { minCol: number; minRow: number; maxCol: number; maxRow: number } {
    // Convert screen corners to world coordinates
    const topLeft = this.screenToWorld(0, 0);
    const topRight = this.screenToWorld(this.viewWidth, 0);
    const bottomLeft = this.screenToWorld(0, this.viewHeight);
    const bottomRight = this.screenToWorld(this.viewWidth, this.viewHeight);

    // Convert world coords to grid coords
    const halfW = ISO_TILE_WIDTH / 2;
    const halfH = ISO_TILE_HEIGHT / 2;

    const points = [topLeft, topRight, bottomLeft, bottomRight];
    let minCol = Infinity, maxCol = -Infinity;
    let minRow = Infinity, maxRow = -Infinity;

    for (const p of points) {
      const col = (p.x / halfW + p.y / halfH) / 2;
      const row = (p.y / halfH - p.x / halfW) / 2;
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
    }

    return {
      minCol: Math.max(0, Math.floor(minCol)),
      minRow: Math.max(0, Math.floor(minRow)),
      maxCol: Math.min(GRID_WIDTH, Math.ceil(maxCol)),
      maxRow: Math.min(GRID_HEIGHT, Math.ceil(maxRow)),
    };
  }
}
