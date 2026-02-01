// ============================================================
// MoltClans - Activity Selector (picks next activity)
// ============================================================

import type { SpectatorState } from "../../shared/types";
import type { BehaviorState } from "./BehaviorTypes";

export interface ActivityResult {
  state: BehaviorState;
  targetX: number;
  targetY: number;
  targetBuildingId: string | null;
}

/**
 * Select the next activity for an agent based on current game state.
 * Priority: construction > collection > socializing > wandering > idle
 */
export function selectActivity(
  agentId: string,
  agentX: number,
  agentY: number,
  state: SpectatorState,
): ActivityResult {
  // 1. Check for under-construction buildings owned by this agent
  for (const building of Object.values(state.buildings)) {
    if (building.ownerId === agentId && !building.completed) {
      return {
        state: "WALKING_TO_BUILD",
        targetX: building.x,
        targetY: building.y,
        targetBuildingId: building.id,
      };
    }
  }

  // 2. Check for buildings with pending resources to collect
  for (const building of Object.values(state.buildings)) {
    if (building.ownerId !== agentId || !building.completed) continue;
    const totalPending =
      (building.pendingRawWood ?? 0) + (building.pendingRawStone ?? 0) +
      (building.pendingRawWater ?? 0) + (building.pendingRawFood ?? 0) +
      (building.pendingRawClay ?? 0) + (building.pendingRefinedPlanks ?? 0) +
      (building.pendingRefinedBricks ?? 0) + (building.pendingRefinedCement ?? 0) +
      (building.pendingRefinedGlass ?? 0) + (building.pendingRefinedSteel ?? 0) +
      (building.pendingTokens ?? 0);
    if (totalPending > 1) {
      return {
        state: "WALKING_TO_COLLECT",
        targetX: building.x,
        targetY: building.y,
        targetBuildingId: building.id,
      };
    }
  }

  // 3. Socializing — if other agents are nearby
  const nearbyAgents = Object.values(state.agents).filter((a) => {
    if (a.id === agentId || !a.online) return false;
    const dx = a.x - agentX;
    const dy = a.y - agentY;
    return Math.sqrt(dx * dx + dy * dy) < 15;
  });

  if (nearbyAgents.length > 0 && Math.random() < 0.3) {
    const target = nearbyAgents[Math.floor(Math.random() * nearbyAgents.length)];
    return {
      state: "SOCIALIZING",
      targetX: target.x,
      targetY: target.y,
      targetBuildingId: null,
    };
  }

  // 4. Wander to a random nearby point
  if (Math.random() < 0.5) {
    const wanderRange = 10;
    const wx = agentX + Math.floor(Math.random() * wanderRange * 2) - wanderRange;
    const wy = agentY + Math.floor(Math.random() * wanderRange * 2) - wanderRange;
    return {
      state: "WANDERING",
      targetX: Math.max(0, Math.min(127, wx)),
      targetY: Math.max(0, Math.min(127, wy)),
      targetBuildingId: null,
    };
  }

  // 5. Default: idle
  return {
    state: "IDLE",
    targetX: agentX,
    targetY: agentY,
    targetBuildingId: null,
  };
}
