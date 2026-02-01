// ============================================================
// MoltClans - MiniMap (Canvas-based, flat top-down view)
// ============================================================

import { GAME_CONFIG } from "../config";
import { GRID_WIDTH, GRID_HEIGHT } from "../shared/constants";
import type { SpectatorState, GridCell } from "../shared/types";

/** CSS hex string to {r,g,b} */
function hexToRgb(hex: number): { r: number; g: number; b: number } {
  return {
    r: (hex >> 16) & 0xff,
    g: (hex >> 8) & 0xff,
    b: hex & 0xff,
  };
}

/**
 * A small canvas-based minimap that shows the entire grid.
 * Flat top-down view. Click-to-navigate converts minimap pixel -> grid tile.
 */
export class MiniMap {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  /** Callback fired when the user clicks on the minimap (tileX, tileZ) */
  public onNavigate: ((tileX: number, tileZ: number) => void) | null = null;

  constructor() {
    this.container = document.getElementById("minimap-container")!;
    this.container.innerHTML = "";

    this.canvas = document.createElement("canvas");
    this.canvas.width = GRID_WIDTH;
    this.canvas.height = GRID_HEIGHT;
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.imageRendering = "pixelated";
    this.container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext("2d")!;

    // Click to navigate: minimap pixel -> grid tile
    this.canvas.addEventListener("click", (e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = GRID_WIDTH / rect.width;
      const scaleY = GRID_HEIGHT / rect.height;
      const tileX = Math.floor((e.clientX - rect.left) * scaleX);
      const tileZ = Math.floor((e.clientY - rect.top) * scaleY);

      if (this.onNavigate) {
        this.onNavigate(tileX, tileZ);
      }
    });
  }

  /**
   * Redraw the minimap from current state and camera bounds.
   * Camera bounds are in grid coordinates (3D world XZ = grid tile coords).
   */
  update(
    state: SpectatorState,
    cameraBounds: {
      minX: number;
      minZ: number;
      maxX: number;
      maxZ: number;
    }
  ): void {
    const ctx = this.ctx;
    const grid = state.grid;

    // Clear
    ctx.clearRect(0, 0, GRID_WIDTH, GRID_HEIGHT);

    // --- Draw terrain ---
    const imageData = ctx.createImageData(GRID_WIDTH, GRID_HEIGHT);
    const data = imageData.data;

    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        if (!grid[y] || !grid[y][x]) continue;
        const cell = grid[y][x];
        const colorHex =
          GAME_CONFIG.TERRAIN_COLORS[cell.terrain] ?? 0x000000;
        const { r, g, b } = hexToRgb(colorHex);
        const idx = (y * GRID_WIDTH + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // --- Draw plots as colored outlines ---
    for (const plot of Object.values(state.plots)) {
      const agent = state.agents[plot.ownerId];
      if (agent) {
        ctx.strokeStyle = agent.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(plot.x, plot.y, plot.width, plot.height);
      }
    }

    // --- Draw buildings as brighter dots ---
    for (const building of Object.values(state.buildings)) {
      const colorHex =
        GAME_CONFIG.BUILDING_COLORS[building.type] ?? 0xffffff;
      const { r, g, b } = hexToRgb(colorHex);
      ctx.fillStyle = `rgb(${Math.min(255, r + 60)}, ${Math.min(255, g + 60)}, ${Math.min(255, b + 60)})`;
      ctx.fillRect(building.x, building.y, building.width, building.height);
    }

    // --- Draw agents as colored dots ---
    for (const agent of Object.values(state.agents)) {
      if (!agent.online) continue;
      ctx.fillStyle = agent.color;
      ctx.fillRect(agent.x, agent.y, 2, 2);
    }

    // --- Draw camera viewport (grid-space rectangle) ---
    const minX = Math.max(0, cameraBounds.minX);
    const minZ = Math.max(0, cameraBounds.minZ);
    const maxX = Math.min(GRID_WIDTH, cameraBounds.maxX);
    const maxZ = Math.min(GRID_HEIGHT, cameraBounds.maxZ);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 1;
    ctx.strokeRect(minX, minZ, maxX - minX, maxZ - minZ);
  }

  drawBaseGrid(_grid: GridCell[][]): void {
    // Handled in update()
  }
}
