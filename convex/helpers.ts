// ============================================================
// MoltClans Convex Helpers
// ============================================================

import { Id, Doc } from "./_generated/dataModel";
import {
  AGENT_COLORS,
  PERSONALITIES,
  STARTER_TOKENS,
  STARTER_FOOD,
  STARTER_WOOD,
  STARTER_STONE,
  STARTER_CLAY,
  STARTER_PLANKS,
  INVENTORY_LIMIT_DEFAULT,
  VISION_RADIUS,
  GRID_WIDTH,
  GRID_HEIGHT,
  BUILDING_DEFINITIONS,
} from "./constants";

// --- API Key Generation ---

export function generateApiKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let key = "mc_";
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

// --- Agent Creation ---

export function getRandomColor(): string {
  return AGENT_COLORS[Math.floor(Math.random() * AGENT_COLORS.length)];
}

export function getRandomPersonality(): string {
  return PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
}

export function createNewAgentData(name: string) {
  return {
    name,
    apiKey: generateApiKey(),
    color: getRandomColor(),
    x: 0,
    y: 0,
    // Raw resources
    rawWood: STARTER_WOOD,
    rawStone: STARTER_STONE,
    rawWater: 0,
    rawFood: STARTER_FOOD,
    rawClay: STARTER_CLAY,
    // Refined materials
    refinedPlanks: STARTER_PLANKS,
    refinedBricks: 0,
    refinedCement: 0,
    refinedGlass: 0,
    refinedSteel: 0,
    // Tokens
    tokens: STARTER_TOKENS,
    // Agent stats
    reputation: 0,
    personality: getRandomPersonality(),
    inventoryLimit: INVENTORY_LIMIT_DEFAULT,
    currentTier: 0,
    isStarving: false,
    visionRadius: VISION_RADIUS,
    foodConsumedAt: 0,
    // Social
    clanId: undefined,
    joinedAt: Date.now(),
    lastSeen: Date.now(),
    plotCount: 0,
    buildingCount: 0,
    online: false,
  };
}

// --- Public Agent (strips sensitive data) ---

export interface PublicAgent {
  _id: Id<"agents">;
  name: string;
  color: string;
  x: number;
  y: number;
  reputation: number;
  personality: string;
  currentTier: number;
  isStarving: boolean;
  clanId?: Id<"clans">;
  joinedAt: number;
  lastSeen: number;
  plotCount: number;
  buildingCount: number;
  online: boolean;
}

export function toPublicAgent(agent: Doc<"agents">): PublicAgent {
  return {
    _id: agent._id,
    name: agent.name,
    color: agent.color,
    x: agent.x,
    y: agent.y,
    reputation: agent.reputation,
    personality: agent.personality,
    currentTier: agent.currentTier,
    isStarving: agent.isStarving,
    clanId: agent.clanId,
    joinedAt: agent.joinedAt,
    lastSeen: agent.lastSeen,
    plotCount: agent.plotCount,
    buildingCount: agent.buildingCount,
    online: agent.online,
  };
}

// --- Agent Inventory Helpers ---

export function getInventoryUsage(agent: Doc<"agents">): number {
  return (
    agent.rawWood +
    agent.rawStone +
    agent.rawWater +
    agent.rawFood +
    agent.rawClay +
    agent.refinedPlanks +
    agent.refinedBricks +
    agent.refinedCement +
    agent.refinedGlass +
    agent.refinedSteel
  );
}

export function getInventoryLimit(agent: Doc<"agents">, buildings: Doc<"buildings">[]): number {
  let limit = agent.inventoryLimit;
  for (const building of buildings) {
    if (building.completed && building.ownerId === agent._id) {
      if (building.type === "storage_shed") {
        limit += 50 * building.level;
      } else if (building.type === "warehouse") {
        limit += 100 * building.level;
      }
    }
  }
  return limit;
}

// --- Tier Calculation ---

export function calculateAgentTier(ownedBuildingTypes: string[], plotCount: number, reputation: number): number {
  // Tier 0 -> Tier 1: Claim 3+ tiles
  if (plotCount < 3) return 0;

  // Tier 1 -> Tier 2: Own a Kiln
  if (!ownedBuildingTypes.includes("kiln")) return 1;

  // Tier 2 -> Tier 3: Own a Town Hall + 20 reputation
  if (!ownedBuildingTypes.includes("town_hall") || reputation < 20) return 2;

  // Tier 3 -> Tier 4: Own a University + 50 reputation
  if (!ownedBuildingTypes.includes("university") || reputation < 50) return 3;

  return 4;
}

// --- Prestige Level ---

export function calculatePrestigeLevel(reputation: number): number {
  if (reputation >= 200) return 10;
  if (reputation >= 150) return 9;
  if (reputation >= 100) return 8;
  if (reputation >= 75) return 7;
  if (reputation >= 50) return 6;
  if (reputation >= 35) return 5;
  if (reputation >= 25) return 4;
  if (reputation >= 15) return 3;
  if (reputation >= 8) return 2;
  if (reputation >= 3) return 1;
  return 0;
}

// --- Grid Helpers ---

export type TerrainType = "plains" | "fertile" | "forest" | "mountain" | "water" | "riverbank" | "desert";

export interface ResourceNode {
  type: "tree" | "stone_deposit" | "clay_deposit" | "water_source" | "fertile_soil";
  maxAmount: number;
  currentAmount: number;
  respawnTicks: number;
  depletedAt: number | null;
}

export interface GridCell {
  terrain: TerrainType;
  plotId: string | null;
  buildingId: string | null;
  resourceNode: ResourceNode | null;
  isPassable: boolean;
  isCleared: boolean;
}

// Perlin-like noise function
function noise(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n);
}

function layeredNoise(x: number, y: number, seed: number): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < 4; i++) {
    value += noise(x * frequency / 10, y * frequency / 10, seed + i * 1000) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value / maxValue;
}

export function generateTerrain(seed: number = 12345): GridCell[][] {
  const grid: GridCell[][] = [];

  for (let y = 0; y < GRID_HEIGHT; y++) {
    grid[y] = [];
    for (let x = 0; x < GRID_WIDTH; x++) {
      const n = layeredNoise(x, y, seed);
      let terrain: TerrainType = "plains";
      let isPassable = true;
      let resourceNode: ResourceNode | null = null;

      // River (diagonal band from NW to SE)
      const riverCenter = (x + y) / 2;
      const riverDist = Math.abs(riverCenter - 25);
      if (riverDist < 2.5) {
        // Ford crossings every 10 tiles
        const isFord = (x + y) % 20 < 3;
        if (isFord) {
          terrain = "riverbank";
          isPassable = true;
        } else {
          terrain = "water";
          isPassable = false;
          resourceNode = {
            type: "water_source",
            maxAmount: 100,
            currentAmount: 100,
            respawnTicks: 0,
            depletedAt: null,
          };
        }
      } else if (riverDist < 4) {
        terrain = "riverbank";
        if (Math.random() < 0.4) {
          resourceNode = {
            type: "clay_deposit",
            maxAmount: 30,
            currentAmount: 30,
            respawnTicks: 10,
            depletedAt: null,
          };
        }
      } else if (riverDist < 5) {
        // Fertile land near river
        if (Math.random() < 0.6) {
          terrain = "fertile";
          resourceNode = {
            type: "fertile_soil",
            maxAmount: 50,
            currentAmount: 50,
            respawnTicks: 8,
            depletedAt: null,
          };
        }
      } else if (n < 0.25) {
        terrain = "forest";
        isPassable = false;
        resourceNode = {
          type: "tree",
          maxAmount: 50,
          currentAmount: 50,
          respawnTicks: 8,
          depletedAt: null,
        };
      } else if (n > 0.8) {
        terrain = "mountain";
        isPassable = false;
        if (Math.random() < 0.5) {
          resourceNode = {
            type: "stone_deposit",
            maxAmount: 40,
            currentAmount: 40,
            respawnTicks: 20,
            depletedAt: null,
          };
        }
      } else if (n > 0.75 && (x < 5 || x > 45 || y < 5 || y > 45)) {
        terrain = "desert";
        isPassable = true;
      }

      // Mountains at edges
      if (
        (x === 0 || x === GRID_WIDTH - 1 || y === 0 || y === GRID_HEIGHT - 1) &&
        terrain !== "water"
      ) {
        terrain = "mountain";
        isPassable = false;
      }

      grid[y][x] = {
        terrain,
        plotId: null,
        buildingId: null,
        resourceNode,
        isPassable,
        isCleared: false,
      };
    }
  }

  return grid;
}

// --- Grid State Helpers ---

export function isPassable(grid: GridCell[][], x: number, y: number): boolean {
  if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return false;
  const cell = grid[y][x];
  if (!cell) return false;
  if (cell.buildingId) return false;
  if (!cell.isPassable && !cell.isCleared) return false;
  return true;
}

export function isAreaFree(
  grid: GridCell[][],
  startX: number,
  startY: number,
  width: number,
  height: number
): boolean {
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const x = startX + dx;
      const y = startY + dy;
      if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return false;
      const cell = grid[y][x];
      if (cell.buildingId) return false;
    }
  }
  return true;
}

export function markPlotOnGrid(grid: GridCell[][], plot: { x: number; y: number; width: number; height: number; _id: Id<"plots"> }): void {
  for (let dy = 0; dy < plot.height; dy++) {
    for (let dx = 0; dx < plot.width; dx++) {
      const x = plot.x + dx;
      const y = plot.y + dy;
      if (grid[y] && grid[y][x]) {
        grid[y][x].plotId = plot._id;
      }
    }
  }
}

export function markBuildingOnGrid(grid: GridCell[][], building: { x: number; y: number; width: number; height: number; _id: Id<"buildings"> }): void {
  for (let dy = 0; dy < building.height; dy++) {
    for (let dx = 0; dx < building.width; dx++) {
      const x = building.x + dx;
      const y = building.y + dy;
      if (grid[y] && grid[y][x]) {
        grid[y][x].buildingId = building._id;
      }
    }
  }
}

export function clearBuildingFromGrid(grid: GridCell[][], building: { x: number; y: number; width: number; height: number }): void {
  for (let dy = 0; dy < building.height; dy++) {
    for (let dx = 0; dx < building.width; dx++) {
      const x = building.x + dx;
      const y = building.y + dy;
      if (grid[y] && grid[y][x]) {
        grid[y][x].buildingId = null;
      }
    }
  }
}

export function clearPlotFromGrid(grid: GridCell[][], plot: { x: number; y: number; width: number; height: number }): void {
  for (let dy = 0; dy < plot.height; dy++) {
    for (let dx = 0; dx < plot.width; dx++) {
      const x = plot.x + dx;
      const y = plot.y + dy;
      if (grid[y] && grid[y][x]) {
        grid[y][x].plotId = null;
      }
    }
  }
}

// --- Smart Spawn Location ---

export function findBestSpawnLocation(grid: GridCell[][], agents: { x: number; y: number }[]): { x: number; y: number } {
  const centerX = Math.floor(GRID_WIDTH / 2);
  const centerY = Math.floor(GRID_HEIGHT / 2);

  // Score each 16x16 region
  let bestScore = -Infinity;
  let bestX = centerX;
  let bestY = centerY;

  for (let ry = 5; ry < GRID_HEIGHT - 5; ry += 4) {
    for (let rx = 5; rx < GRID_WIDTH - 5; rx += 4) {
      if (!isPassable(grid, rx, ry)) continue;

      let score = 0;

      // Prefer areas near resources
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const x = rx + dx;
          const y = ry + dy;
          if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
            const cell = grid[y][x];
            if (cell.resourceNode) score += 5;
            if (cell.terrain === "fertile") score += 3;
            if (cell.terrain === "riverbank") score += 2;
          }
        }
      }

      // Avoid other agents
      for (const agent of agents) {
        const dist = Math.abs(agent.x - rx) + Math.abs(agent.y - ry);
        if (dist < 10) score -= (10 - dist) * 2;
      }

      // Slight preference for center
      const distFromCenter = Math.abs(rx - centerX) + Math.abs(ry - centerY);
      score -= distFromCenter * 0.1;

      if (score > bestScore) {
        bestScore = score;
        bestX = rx;
        bestY = ry;
      }
    }
  }

  return { x: bestX, y: bestY };
}

// --- Direction Helpers ---

export const DIRECTIONS: Record<string, { dx: number; dy: number }> = {
  n: { dx: 0, dy: -1 },
  s: { dx: 0, dy: 1 },
  e: { dx: 1, dy: 0 },
  w: { dx: -1, dy: 0 },
  ne: { dx: 1, dy: -1 },
  nw: { dx: -1, dy: -1 },
  se: { dx: 1, dy: 1 },
  sw: { dx: -1, dy: 1 },
};

// --- Building Helpers ---

export function hasWorkshopDiscount(buildings: Doc<"buildings">[], agentId: Id<"agents">): boolean {
  return buildings.some(
    (b) => b.type === "workshop" && b.completed && b.ownerId === agentId
  );
}

export function hasRequiredBuilding(buildings: Doc<"buildings">[], agentId: Id<"agents">, buildingType: string): boolean {
  return buildings.some(
    (b) => b.type === buildingType && b.completed && b.ownerId === agentId
  );
}

// --- Terrain Action Helpers ---

export const TERRAIN_GATHER_MAP: Record<string, { terrain: TerrainType[]; adjacent?: TerrainType[] }> = {
  chop: { terrain: ["forest"] },
  mine: { terrain: [], adjacent: ["mountain"] },
  collect_water: { terrain: ["water", "riverbank"], adjacent: ["water"] },
  forage: { terrain: ["fertile", "plains", "riverbank", "desert"] },
  dig: { terrain: ["riverbank"] },
};

export function canGatherAt(grid: GridCell[][], x: number, y: number, gatherType: string): boolean {
  const mapping = TERRAIN_GATHER_MAP[gatherType];
  if (!mapping) return false;

  const cell = grid[y]?.[x];
  if (!cell) return false;

  // Check direct terrain
  if (mapping.terrain.includes(cell.terrain)) return true;

  // Check adjacent terrain
  if (mapping.adjacent) {
    for (const dir of Object.values(DIRECTIONS)) {
      const adjX = x + dir.dx;
      const adjY = y + dir.dy;
      const adjCell = grid[adjY]?.[adjX];
      if (adjCell && mapping.adjacent.includes(adjCell.terrain)) return true;
    }
  }

  return false;
}

// --- Error Response Helper ---

export function errorResponse(message: string) {
  return { ok: false, error: message };
}

export function successResponse<T>(data: T) {
  return { ok: true, data };
}
