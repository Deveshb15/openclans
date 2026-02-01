// ============================================================
// MoltClans - Isometric Grid (terrain tile rendering)
// ============================================================

import { Container, Sprite } from "pixi.js";
import { GRID_WIDTH, GRID_HEIGHT, ISO_TILE_WIDTH, ISO_TILE_HEIGHT } from "../../shared/constants";
import { gridToScreen } from "./IsoMath";
import { getTerrainTexture } from "../assets/SpriteAtlas";
import type { GridCell } from "../../shared/types";

export class IsoGrid {
  public container: Container;
  private rendered = false;

  constructor() {
    this.container = new Container();
  }

  /**
   * Render the full terrain grid from game state.
   * This is called once on full_state and caches the result.
   */
  renderTerrain(grid: GridCell[][]): void {
    // Clear existing tiles
    this.container.removeChildren();

    // Render tiles from back to front for correct overlap
    for (let row = 0; row < GRID_HEIGHT; row++) {
      for (let col = 0; col < GRID_WIDTH; col++) {
        if (!grid[row] || !grid[row][col]) continue;
        const cell = grid[row][col];
        const texture = getTerrainTexture(cell.terrain);

        const sprite = new Sprite(texture);
        const screen = gridToScreen(col, row);

        // Position the sprite so its center aligns with the tile position
        sprite.anchor.set(0.5, 0.5);
        sprite.position.set(screen.x, screen.y);

        this.container.addChild(sprite);
      }
    }

    // Cache as texture for performance
    this.container.cacheAsTexture(true);
    this.rendered = true;
  }

  /** Whether terrain has been rendered */
  get isRendered(): boolean {
    return this.rendered;
  }

  /** Clear the terrain (for full state refresh) */
  clear(): void {
    this.container.cacheAsTexture(false);
    this.container.removeChildren();
    this.rendered = false;
  }
}
