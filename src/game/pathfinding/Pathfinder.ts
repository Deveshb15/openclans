// ============================================================
// MoltClans - A* Pathfinder on 128x128 Grid
// ============================================================

import { BinaryHeap } from "./BinaryHeap";
import { GRID_WIDTH, GRID_HEIGHT } from "../../shared/constants";
import type { GridCell, TerrainType } from "../../shared/types";

/** Movement cost by terrain type */
const TERRAIN_COST: Record<TerrainType, number> = {
  grass: 1.0,
  dirt: 1.2,
  stone: 1.5,
  sand: 1.8,
  water: Infinity,
};

/** Road cost override (buildings of type "road" marked on grid) */
const ROAD_COST = 0.5;

const SQRT2 = Math.sqrt(2);
const MAX_ITERATIONS = 5000;

interface PathNode {
  x: number;
  y: number;
  g: number; // cost from start
  f: number; // g + heuristic
  parent: PathNode | null;
}

/** 8-directional neighbor offsets */
const NEIGHBORS = [
  { dx: 0, dy: -1, diag: false },
  { dx: 1, dy: -1, diag: true },
  { dx: 1, dy: 0, diag: false },
  { dx: 1, dy: 1, diag: true },
  { dx: 0, dy: 1, diag: false },
  { dx: -1, dy: 1, diag: true },
  { dx: -1, dy: 0, diag: false },
  { dx: -1, dy: -1, diag: true },
];

export interface PathResult {
  path: Array<{ x: number; y: number }>;
  found: boolean;
}

export class Pathfinder {
  private grid: GridCell[][] = [];
  private roadCells: Set<string> = new Set();

  /** Update the grid reference (call on full state) */
  setGrid(grid: GridCell[][]): void {
    this.grid = grid;
  }

  /** Mark cells as roads for reduced movement cost */
  setRoadCells(roads: Set<string>): void {
    this.roadCells = roads;
  }

  /** Get cost for a cell */
  private getCost(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= GRID_WIDTH || y >= GRID_HEIGHT) return Infinity;
    const cell = this.grid[y]?.[x];
    if (!cell) return Infinity;

    // Road override
    if (this.roadCells.has(`${x},${y}`)) return ROAD_COST;

    // Occupied by a non-road building
    if (cell.buildingId) return Infinity;

    return TERRAIN_COST[cell.terrain] ?? 1.0;
  }

  /** Heuristic: octile distance */
  private heuristic(ax: number, ay: number, bx: number, by: number): number {
    const dx = Math.abs(ax - bx);
    const dy = Math.abs(ay - by);
    return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
  }

  /**
   * Find a path from (startX, startY) to (endX, endY).
   * Returns the path as an array of grid positions, or empty if no path found.
   */
  findPath(startX: number, startY: number, endX: number, endY: number): PathResult {
    startX = Math.floor(startX);
    startY = Math.floor(startY);
    endX = Math.floor(endX);
    endY = Math.floor(endY);

    // Quick exit if target is impassable — find nearest passable
    if (this.getCost(endX, endY) === Infinity) {
      const nearest = this.findNearestPassable(endX, endY);
      if (!nearest) return { path: [], found: false };
      endX = nearest.x;
      endY = nearest.y;
    }

    if (startX === endX && startY === endY) {
      return { path: [{ x: startX, y: startY }], found: true };
    }

    const open = new BinaryHeap<PathNode>((n) => n.f);
    const closed = new Set<string>();

    const startNode: PathNode = {
      x: startX,
      y: startY,
      g: 0,
      f: this.heuristic(startX, startY, endX, endY),
      parent: null,
    };
    open.push(startNode);

    const gScores = new Map<string, number>();
    gScores.set(`${startX},${startY}`, 0);

    let iterations = 0;

    while (open.size > 0 && iterations < MAX_ITERATIONS) {
      iterations++;
      const current = open.pop()!;
      const key = `${current.x},${current.y}`;

      if (current.x === endX && current.y === endY) {
        return { path: this.reconstructPath(current), found: true };
      }

      if (closed.has(key)) continue;
      closed.add(key);

      for (const { dx, dy, diag } of NEIGHBORS) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        const nKey = `${nx},${ny}`;

        if (closed.has(nKey)) continue;

        const cost = this.getCost(nx, ny);
        if (cost === Infinity) continue;

        const moveCost = diag ? SQRT2 * cost : cost;
        const newG = current.g + moveCost;

        const existingG = gScores.get(nKey);
        if (existingG !== undefined && newG >= existingG) continue;

        gScores.set(nKey, newG);

        const node: PathNode = {
          x: nx,
          y: ny,
          g: newG,
          f: newG + this.heuristic(nx, ny, endX, endY),
          parent: current,
        };
        open.push(node);
      }
    }

    return { path: [], found: false };
  }

  /** Find nearest passable cell to a target */
  private findNearestPassable(x: number, y: number): { x: number; y: number } | null {
    for (let r = 1; r <= 10; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (this.getCost(nx, ny) < Infinity) {
            return { x: nx, y: ny };
          }
        }
      }
    }
    return null;
  }

  /** Reconstruct path from end node */
  private reconstructPath(node: PathNode): Array<{ x: number; y: number }> {
    const path: Array<{ x: number; y: number }> = [];
    let current: PathNode | null = node;
    while (current) {
      path.unshift({ x: current.x, y: current.y });
      current = current.parent;
    }
    return this.smoothPath(path);
  }

  /** Remove redundant waypoints on straight lines */
  private smoothPath(path: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
    if (path.length <= 2) return path;

    const smoothed: Array<{ x: number; y: number }> = [path[0]];

    for (let i = 1; i < path.length - 1; i++) {
      const prev = path[i - 1];
      const curr = path[i];
      const next = path[i + 1];

      // Keep if direction changes
      const dx1 = curr.x - prev.x;
      const dy1 = curr.y - prev.y;
      const dx2 = next.x - curr.x;
      const dy2 = next.y - curr.y;

      if (dx1 !== dx2 || dy1 !== dy2) {
        smoothed.push(curr);
      }
    }

    smoothed.push(path[path.length - 1]);
    return smoothed;
  }
}
