import type { GridCell, TerrainType, Building } from "../../src/shared/types";

/**
 * Simple pseudo-noise function using layered sine waves.
 * Not true Perlin noise, but produces organic-feeling terrain variation.
 */
function noise2D(x: number, y: number, seed: number = 42): number {
  const s = seed * 0.1;
  const v =
    Math.sin(x * 0.05 + s) * 0.25 +
    Math.sin(y * 0.07 + s * 1.3) * 0.25 +
    Math.sin((x + y) * 0.03 + s * 0.7) * 0.2 +
    Math.sin((x * 0.11 + y * 0.13) + s * 2.1) * 0.15 +
    Math.sin(x * 0.17 - y * 0.19 + s * 0.3) * 0.15;
  // Normalize to 0..1
  return (v + 1) / 2;
}

/**
 * Generates a 2D terrain grid with procedural terrain.
 * Center is mostly grassland, edges are varied, and a diagonal river
 * cuts from northwest to southeast.
 */
export function generateTerrain(width: number, height: number): GridCell[][] {
  const grid: GridCell[][] = [];
  const centerX = width / 2;
  const centerY = height / 2;
  const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);

  for (let y = 0; y < height; y++) {
    const row: GridCell[] = [];
    for (let x = 0; x < width; x++) {
      const terrain = pickTerrain(x, y, width, height, centerX, centerY, maxDist);
      row.push({
        terrain,
        plotId: null,
        buildingId: null,
      });
    }
    grid.push(row);
  }

  return grid;
}

function pickTerrain(
  x: number,
  y: number,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  maxDist: number
): TerrainType {
  // Distance from center normalized 0..1
  const dx = x - centerX;
  const dy = y - centerY;
  const distFromCenter = Math.sqrt(dx * dx + dy * dy) / maxDist;

  // River: diagonal band from NW to SE
  // The river follows the line y = x shifted to pass through center
  // Distance from the line y = x (in grid coords, shifted to center)
  const riverDist = Math.abs((x - centerX) - (y - centerY)) / Math.sqrt(2);
  const riverWidth = 2.5 + noise2D(x, y, 99) * 2; // 2.5-4.5 cells wide
  if (riverDist < riverWidth) {
    // River bank: sand on edges
    if (riverDist > riverWidth - 1.2) {
      return "sand";
    }
    return "water";
  }

  // Get noise value for this position
  const n = noise2D(x, y, 42);
  const n2 = noise2D(x, y, 137);

  // Center-weighted: more grass near center, more variety at edges
  if (distFromCenter < 0.3) {
    // Inner area: mostly grass
    if (n < 0.15) return "dirt";
    if (n < 0.2) return "sand";
    return "grass";
  } else if (distFromCenter < 0.55) {
    // Mid area: grass dominant but more dirt/stone
    if (n < 0.15) return "stone";
    if (n < 0.3) return "dirt";
    if (n < 0.35) return "sand";
    return "grass";
  } else {
    // Outer/edge area: varied terrain
    if (n < 0.2) return "stone";
    if (n < 0.35) return "dirt";
    if (n < 0.45) return "sand";
    if (n2 < 0.1) return "water"; // small ponds at edges
    return "grass";
  }
}

/**
 * Checks if a rectangular area on the grid is free for placement.
 * Returns true if all cells in the area are non-water, have no plot, and have no building.
 */
export function isAreaFree(
  grid: GridCell[][],
  x: number,
  y: number,
  w: number,
  h: number
): boolean {
  // Bounds check
  if (x < 0 || y < 0 || x + w > grid[0].length || y + h > grid.length) {
    return false;
  }

  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const cell = grid[y + dy][x + dx];
      if (cell.terrain === "water") return false;
      if (cell.plotId !== null) return false;
      if (cell.buildingId !== null) return false;
    }
  }

  return true;
}

/**
 * Checks if a rectangular area within a plot is free for a building.
 * All cells must belong to the given plotId and have no buildingId.
 */
export function isAreaFreeForBuilding(
  grid: GridCell[][],
  x: number,
  y: number,
  w: number,
  h: number,
  plotId: string
): boolean {
  if (x < 0 || y < 0 || x + w > grid[0].length || y + h > grid.length) {
    return false;
  }

  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const cell = grid[y + dy][x + dx];
      if (cell.plotId !== plotId) return false;
      if (cell.buildingId !== null) return false;
    }
  }

  return true;
}

/**
 * Finds all buildings that are adjacent (touching) the given rectangular area.
 * Checks one cell outside each edge of the rectangle.
 */
export function getAdjacentBuildings(
  grid: GridCell[][],
  buildings: Record<string, Building>,
  x: number,
  y: number,
  w: number,
  h: number
): Building[] {
  const adjacentIds = new Set<string>();
  const maxY = grid.length;
  const maxX = grid[0].length;

  // Check all cells in a 1-cell border around the rectangle
  for (let dy = -1; dy <= h; dy++) {
    for (let dx = -1; dx <= w; dx++) {
      // Skip interior cells
      if (dx >= 0 && dx < w && dy >= 0 && dy < h) continue;

      const cx = x + dx;
      const cy = y + dy;

      if (cx < 0 || cy < 0 || cx >= maxX || cy >= maxY) continue;

      const cell = grid[cy][cx];
      if (cell.buildingId && !adjacentIds.has(cell.buildingId)) {
        adjacentIds.add(cell.buildingId);
      }
    }
  }

  return Array.from(adjacentIds)
    .map((id) => buildings[id])
    .filter((b): b is Building => b !== undefined);
}

/**
 * Marks grid cells with a plot ID.
 */
export function markPlotOnGrid(
  grid: GridCell[][],
  plotId: string,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      grid[y + dy][x + dx].plotId = plotId;
    }
  }
}

/**
 * Clears a plot ID from grid cells.
 */
export function clearPlotFromGrid(
  grid: GridCell[][],
  plotId: string,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      if (grid[y + dy][x + dx].plotId === plotId) {
        grid[y + dy][x + dx].plotId = null;
      }
    }
  }
}

/**
 * Marks grid cells with a building ID.
 */
export function markBuildingOnGrid(
  grid: GridCell[][],
  buildingId: string,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      grid[y + dy][x + dx].buildingId = buildingId;
    }
  }
}

/**
 * Clears a building ID from grid cells.
 */
export function clearBuildingFromGrid(
  grid: GridCell[][],
  buildingId: string,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      if (grid[y + dy][x + dx].buildingId === buildingId) {
        grid[y + dy][x + dx].buildingId = null;
      }
    }
  }
}

/**
 * Scans the grid for rectangular areas that are free for plot placement.
 * Returns a list of candidate positions (not exhaustive, samples the grid).
 */
export function findAvailablePlotAreas(
  grid: GridCell[][],
  minSize: number,
  maxSize: number,
  maxResults: number = 50
): Array<{ x: number; y: number; maxWidth: number; maxHeight: number }> {
  const results: Array<{ x: number; y: number; maxWidth: number; maxHeight: number }> = [];
  const step = 4; // sample every 4 cells for performance

  for (let y = 0; y < grid.length - minSize && results.length < maxResults; y += step) {
    for (let x = 0; x < grid[0].length - minSize && results.length < maxResults; x += step) {
      if (isAreaFree(grid, x, y, minSize, minSize)) {
        // Find max width/height from this point
        let maxW = minSize;
        let maxH = minSize;

        for (let w = minSize + 1; w <= maxSize && x + w <= grid[0].length; w++) {
          if (isAreaFree(grid, x, y, w, minSize)) {
            maxW = w;
          } else {
            break;
          }
        }

        for (let h = minSize + 1; h <= maxSize && y + h <= grid.length; h++) {
          if (isAreaFree(grid, x, y, minSize, h)) {
            maxH = h;
          } else {
            break;
          }
        }

        results.push({ x, y, maxWidth: maxW, maxHeight: maxH });
      }
    }
  }

  return results;
}
