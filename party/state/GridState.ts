import type { GridCell, TerrainType, Building, ResourceNode } from "../../src/shared/types";

/**
 * Simple pseudo-noise function using layered sine waves.
 */
function noise2D(x: number, y: number, seed: number = 42): number {
  const s = seed * 0.1;
  const v =
    Math.sin(x * 0.05 + s) * 0.25 +
    Math.sin(y * 0.07 + s * 1.3) * 0.25 +
    Math.sin((x + y) * 0.03 + s * 0.7) * 0.2 +
    Math.sin((x * 0.11 + y * 0.13) + s * 2.1) * 0.15 +
    Math.sin(x * 0.17 - y * 0.19 + s * 0.3) * 0.15;
  return (v + 1) / 2;
}

/**
 * Generates a 50x50 terrain grid with 7 terrain types and resource nodes.
 * - Mountains form ranges (impassable)
 * - Water forms rivers/lakes (impassable) with riverbank borders
 * - Forests ring edges and cluster in groves
 * - Fertile land near rivers
 * - Desert in corners
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
      const isPassable = terrain !== "mountain" && terrain !== "water";
      const resourceNode = generateResourceNode(x, y, terrain);
      row.push({
        terrain,
        plotId: null,
        buildingId: null,
        resourceNode,
        isPassable,
        isCleared: terrain !== "forest",
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
  const dx = x - centerX;
  const dy = y - centerY;
  const distFromCenter = Math.sqrt(dx * dx + dy * dy) / maxDist;

  // River: diagonal band from NW to SE through center
  const riverDist = Math.abs((x - centerX) - (y - centerY)) / Math.sqrt(2);
  const riverWidth = 1.2 + noise2D(x, y, 99) * 1.0;

  // Ford crossings: passable riverbank gaps at NW, center, and SE positions
  const riverParam = ((x - centerX) + (y - centerY)) / 2;
  const fordPositions = [-10, 0, 10];
  const FORD_HALF_WIDTH = 1.5;
  const isFord = fordPositions.some(fp => Math.abs(riverParam - fp) < FORD_HALF_WIDTH);

  if (riverDist < riverWidth) {
    if (isFord) return "riverbank";       // Ford: passable crossing
    if (riverDist > riverWidth - 0.8) return "riverbank";
    return "water";
  }

  // Fertile land near river
  if (riverDist < riverWidth + 2.5) {
    const fertileChance = noise2D(x, y, 77);
    if (fertileChance > 0.4) return "fertile";
  }

  const n = noise2D(x, y, 42);
  const n2 = noise2D(x, y, 137);
  const n3 = noise2D(x, y, 200);

  // Mountain ranges (form ridges at edges)
  if (distFromCenter > 0.55 && n3 > 0.65) {
    return "mountain";
  }

  // Desert in corners
  const cornerDist = Math.min(
    Math.sqrt(x * x + y * y),
    Math.sqrt((width - x) * (width - x) + y * y),
    Math.sqrt(x * x + (height - y) * (height - y)),
    Math.sqrt((width - x) * (width - x) + (height - y) * (height - y))
  );
  if (cornerDist < width * 0.2 && n > 0.4) {
    return "desert";
  }

  // Forest groves
  if (distFromCenter > 0.3 && n2 > 0.55) {
    return "forest";
  }
  // Forest ring at edges
  if (distFromCenter > 0.6 && n > 0.3 && n3 < 0.65) {
    return "forest";
  }

  // Small water ponds at edges
  if (distFromCenter > 0.5 && n > 0.8) {
    return "water";
  }

  // Center: mostly plains, with some useful terrain
  if (distFromCenter < 0.25) {
    if (n < 0.15) return "fertile";
    if (n2 > 0.75 && n3 < 0.5) return "forest"; // small forest groves near center
    return "plains";
  }

  // Mid area
  if (distFromCenter < 0.45) {
    if (n < 0.1) return "fertile";
    return "plains";
  }

  // Outer area
  if (n < 0.15) return "desert";
  return "plains";
}

/**
 * Generates a resource node for a tile based on terrain type.
 */
function generateResourceNode(x: number, y: number, terrain: TerrainType): ResourceNode | null {
  const chance = noise2D(x * 3, y * 3, 300);

  switch (terrain) {
    case "forest":
      return {
        type: "tree",
        maxAmount: 20,
        currentAmount: 20,
        respawnTicks: 15,
        depletedAt: null,
      };
    case "mountain":
      if (chance > 0.3) {
        return {
          type: "stone_deposit",
          maxAmount: 30,
          currentAmount: 30,
          respawnTicks: 999999,
          depletedAt: null,
        };
      }
      return null;
    case "riverbank":
      return {
        type: "clay_deposit",
        maxAmount: 15,
        currentAmount: 15,
        respawnTicks: 10,
        depletedAt: null,
      };
    case "water":
      return {
        type: "water_source",
        maxAmount: 999,
        currentAmount: 999,
        respawnTicks: 0,
        depletedAt: null,
      };
    case "fertile":
      return {
        type: "fertile_soil",
        maxAmount: 12,
        currentAmount: 12,
        respawnTicks: 8,
        depletedAt: null,
      };
    case "plains": {
      const d = Math.sqrt((x - 25) ** 2 + (y - 25) ** 2) / Math.sqrt(25 * 25 + 25 * 25);
      if (d > 0.2 && d < 0.5 && chance > 0.85) {
        return {
          type: "stone_deposit",
          maxAmount: 15,
          currentAmount: 15,
          respawnTicks: 999999,
          depletedAt: null,
        };
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * Checks if a tile is passable.
 */
export function isPassable(grid: GridCell[][], x: number, y: number): boolean {
  if (x < 0 || y < 0 || y >= grid.length || x >= grid[0].length) return false;
  return grid[y][x].isPassable;
}

/**
 * Gets all tiles within a given radius of a point.
 */
export function getTilesInRadius(
  grid: GridCell[][],
  cx: number,
  cy: number,
  radius: number
): Array<{ x: number; y: number; cell: GridCell }> {
  const results: Array<{ x: number; y: number; cell: GridCell }> = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || ny >= grid.length || nx >= grid[0].length) continue;
      if (Math.sqrt(dx * dx + dy * dy) <= radius) {
        results.push({ x: nx, y: ny, cell: grid[ny][nx] });
      }
    }
  }
  return results;
}

/**
 * Clear a forest tile — converts to plains, removes tree resource node.
 */
export function clearForestTile(grid: GridCell[][], x: number, y: number): boolean {
  if (x < 0 || y < 0 || y >= grid.length || x >= grid[0].length) return false;
  const cell = grid[y][x];
  if (cell.terrain !== "forest") return false;
  cell.terrain = "plains";
  cell.resourceNode = null;
  cell.isPassable = true;
  cell.isCleared = true;
  return true;
}

/**
 * Get the resource node at a specific tile.
 */
export function getResourceNodeAt(grid: GridCell[][], x: number, y: number): ResourceNode | null {
  if (x < 0 || y < 0 || y >= grid.length || x >= grid[0].length) return null;
  return grid[y][x].resourceNode;
}

/**
 * Find the nearest resource of a given type.
 */
export function getNearestResourceOfType(
  grid: GridCell[][],
  cx: number,
  cy: number,
  nodeType: string,
  maxRadius: number = 15
): { x: number; y: number } | null {
  let bestDist = Infinity;
  let best: { x: number; y: number } | null = null;

  for (let dy = -maxRadius; dy <= maxRadius; dy++) {
    for (let dx = -maxRadius; dx <= maxRadius; dx++) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || ny >= grid.length || nx >= grid[0].length) continue;
      const node = grid[ny][nx].resourceNode;
      if (node && node.type === nodeType && node.currentAmount > 0) {
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist < bestDist) {
          bestDist = dist;
          best = { x: nx, y: ny };
        }
      }
    }
  }

  return best;
}

/**
 * Checks if a rectangular area on the grid is free for placement.
 */
export function isAreaFree(
  grid: GridCell[][],
  x: number,
  y: number,
  w: number,
  h: number
): boolean {
  if (x < 0 || y < 0 || x + w > grid[0].length || y + h > grid.length) {
    return false;
  }

  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const cell = grid[y + dy][x + dx];
      if (!cell.isPassable) return false;
      if (cell.plotId !== null) return false;
      if (cell.buildingId !== null) return false;
    }
  }

  return true;
}

/**
 * Checks if a rectangular area within a plot is free for a building.
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
      if (!cell.isCleared) return false;
    }
  }

  return true;
}

/**
 * Finds adjacent buildings around a rectangular area.
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

  for (let dy = -1; dy <= h; dy++) {
    for (let dx = -1; dx <= w; dx++) {
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
      if (y + dy < grid.length && x + dx < grid[0].length) {
        grid[y + dy][x + dx].plotId = plotId;
      }
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
      if (y + dy < grid.length && x + dx < grid[0].length) {
        if (grid[y + dy][x + dx].plotId === plotId) {
          grid[y + dy][x + dx].plotId = null;
        }
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
      if (y + dy < grid.length && x + dx < grid[0].length) {
        grid[y + dy][x + dx].buildingId = buildingId;
      }
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
      if (y + dy < grid.length && x + dx < grid[0].length) {
        if (grid[y + dy][x + dx].buildingId === buildingId) {
          grid[y + dy][x + dx].buildingId = null;
        }
      }
    }
  }
}

/**
 * Scans the grid for rectangular areas free for plot placement.
 */
export function findAvailablePlotAreas(
  grid: GridCell[][],
  minSize: number,
  maxSize: number,
  maxResults: number = 50
): Array<{ x: number; y: number; maxWidth: number; maxHeight: number }> {
  const results: Array<{ x: number; y: number; maxWidth: number; maxHeight: number }> = [];
  const step = 2;

  for (let y = 0; y < grid.length - minSize && results.length < maxResults; y += step) {
    for (let x = 0; x < grid[0].length - minSize && results.length < maxResults; x += step) {
      if (isAreaFree(grid, x, y, minSize, minSize)) {
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
