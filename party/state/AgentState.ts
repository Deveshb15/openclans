import type { Agent, Building, PersonalityType, PublicAgent } from "../../src/shared/types";
import {
  STARTER_TOKENS,
  STARTER_FOOD,
  AGENT_COLORS,
  PERSONALITIES,
  INVENTORY_LIMIT_DEFAULT,
  VISION_RADIUS,
} from "../../src/shared/constants";

/**
 * Creates a new agent with starter resources matching the new game rules.
 * Starts with 100 tokens, 30 food, 20 wood, 10 clay, 5 planks, random personality, tier 0.
 */
export function createAgent(name: string): Agent {
  const id = crypto.randomUUID();
  const apiKey = generateApiKey();
  const color = AGENT_COLORS[Math.floor(Math.random() * AGENT_COLORS.length)];
  const personality = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)] as PersonalityType;

  return {
    id,
    name,
    apiKey,
    color,
    x: 0,
    y: 0,
    inventory: {
      raw: { wood: 20, stone: 0, water: 0, food: STARTER_FOOD, clay: 10 },
      refined: { planks: 5, bricks: 0, cement: 0, glass: 0, steel: 0 },
      tokens: STARTER_TOKENS,
    },
    reputation: 0,
    personality,
    inventoryLimit: INVENTORY_LIMIT_DEFAULT,
    currentTier: 0,
    isStarving: false,
    visionRadius: VISION_RADIUS,
    foodConsumedAt: 0,
    clanId: null,
    joinedAt: Date.now(),
    lastSeen: Date.now(),
    plotCount: 0,
    buildingCount: 0,
    online: false,
  };
}

/**
 * Generates a secure random API key string.
 */
function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const segments: string[] = [];
  for (let s = 0; s < 4; s++) {
    let segment = "";
    for (let i = 0; i < 8; i++) {
      segment += chars[Math.floor(Math.random() * chars.length)];
    }
    segments.push(segment);
  }
  return "mc_" + segments.join("-");
}

/**
 * Compute agent tier from owned buildings + reputation.
 * - Tier 0: default
 * - Tier 1: 3+ tiles claimed
 * - Tier 2: owns a Kiln
 * - Tier 3: owns Town Hall AND reputation >= 20
 * - Tier 4: owns University AND reputation >= 50
 */
export function getAgentTier(agent: Agent, buildings: Record<string, Building>): number {
  let ownsKiln = false;
  let ownsTownHall = false;
  let ownsUniversity = false;

  for (const building of Object.values(buildings)) {
    if (building.ownerId !== agent.id || !building.completed) continue;
    if (building.type === "kiln") ownsKiln = true;
    if (building.type === "town_hall") ownsTownHall = true;
    if (building.type === "university") ownsUniversity = true;
  }

  if (ownsUniversity && agent.reputation >= 50) return 4;
  if (ownsTownHall && agent.reputation >= 20) return 3;
  if (ownsKiln) return 2;
  if (agent.plotCount >= 3) return 1;
  return 0;
}

/**
 * Calculate max plots for agent. Base 20 + extras from storage buildings.
 */
export function getMaxPlots(agent: Agent, buildings: Record<string, Building>): number {
  let extra = 0;
  for (const building of Object.values(buildings)) {
    if (building.ownerId === agent.id && building.completed) {
      if (building.type === "wooden_hut" || building.type === "stone_house") {
        extra += 10 * building.level;
      }
    }
  }
  return 200 + extra;
}

/**
 * Calculate inventory limit including storage buildings.
 */
export function getInventoryLimit(agent: Agent, buildings: Record<string, Building>): number {
  let extra = 0;
  for (const building of Object.values(buildings)) {
    if (building.ownerId !== agent.id || !building.completed) continue;
    if (building.type === "storage_shed") extra += 50 * building.level;
    if (building.type === "warehouse") extra += 100 * building.level;
  }
  return INVENTORY_LIMIT_DEFAULT + extra;
}

/**
 * Get current inventory usage (total items).
 */
export function getInventoryUsage(agent: Agent): number {
  const raw = agent.inventory.raw;
  const refined = agent.inventory.refined;
  return (
    raw.wood + raw.stone + raw.water + raw.food + raw.clay +
    refined.planks + refined.bricks + refined.cement + refined.glass + refined.steel
  );
}

/**
 * Check if agent can act (not starving).
 */
export function canAct(agent: Agent): boolean {
  return !agent.isStarving;
}

/**
 * Checks if the agent owns a completed workshop for build cost discount.
 */
export function hasWorkshopDiscount(
  agent: Agent,
  buildings: Record<string, Building>
): boolean {
  for (const building of Object.values(buildings)) {
    if (
      building.ownerId === agent.id &&
      building.type === "workshop" &&
      building.completed
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Calculates the reputation level title.
 */
export function calculatePrestigeLevel(reputation: number): string {
  if (reputation >= 100) return "Legend";
  if (reputation >= 50) return "Elder";
  if (reputation >= 30) return "Veteran";
  if (reputation >= 10) return "Builder";
  return "Newcomer";
}

/**
 * Strips the apiKey from an agent to produce a public-safe version.
 */
export function toPublicAgent(agent: Agent, buildings: Record<string, Building>): PublicAgent {
  return {
    id: agent.id,
    name: agent.name,
    color: agent.color,
    x: agent.x,
    y: agent.y,
    reputation: agent.reputation,
    personality: agent.personality,
    currentTier: getAgentTier(agent, buildings),
    isStarving: agent.isStarving,
    clanId: agent.clanId,
    joinedAt: agent.joinedAt,
    lastSeen: agent.lastSeen,
    plotCount: agent.plotCount,
    buildingCount: agent.buildingCount,
    online: agent.online,
  };
}
