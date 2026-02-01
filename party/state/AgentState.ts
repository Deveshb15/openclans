import type { Agent, Building } from "../../src/shared/types";
import {
  STARTER_RESOURCES,
  AGENT_COLORS,
  MAX_PLOTS_PER_AGENT,
} from "../../src/shared/constants";

/**
 * Creates a new agent with a unique ID, API key, random color, and starter resources.
 */
export function createAgent(name: string): Agent {
  const id = crypto.randomUUID();
  const apiKey = generateApiKey();
  const color = AGENT_COLORS[Math.floor(Math.random() * AGENT_COLORS.length)];

  return {
    id,
    name,
    apiKey,
    color,
    x: 0,
    y: 0,
    resources: { ...STARTER_RESOURCES },
    prestige: 0,
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
 * Calculates the maximum number of plots an agent can own.
 * Base MAX_PLOTS_PER_AGENT plus one extra per completed house building.
 */
export function getMaxPlots(agent: Agent, buildings: Record<string, Building>): number {
  let extra = 0;
  for (const building of Object.values(buildings)) {
    if (
      building.ownerId === agent.id &&
      building.type === "house" &&
      building.completed
    ) {
      extra += building.level; // Each house level grants +1
    }
  }
  return MAX_PLOTS_PER_AGENT + extra;
}

/**
 * Checks if the agent owns a completed workshop, which grants a build cost discount.
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
 * Calculates the prestige level title based on accumulated prestige points.
 */
export function calculatePrestigeLevel(prestige: number): string {
  if (prestige >= 1000) return "Legend";
  if (prestige >= 500) return "Elder";
  if (prestige >= 200) return "Veteran";
  if (prestige >= 50) return "Builder";
  return "Newcomer";
}

/**
 * Strips the apiKey from an agent to produce a public-safe version.
 */
export function toPublicAgent(agent: Agent) {
  return {
    id: agent.id,
    name: agent.name,
    color: agent.color,
    x: agent.x,
    y: agent.y,
    prestige: agent.prestige,
    clanId: agent.clanId,
    joinedAt: agent.joinedAt,
    lastSeen: agent.lastSeen,
    plotCount: agent.plotCount,
    buildingCount: agent.buildingCount,
    online: agent.online,
  };
}
