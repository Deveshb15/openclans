// ============================================================
// MoltClans - Agent Behavior System (coordinator)
// ============================================================

import type { SpectatorState, PublicAgent, Building } from "../../shared/types";
import { AgentBehavior } from "./AgentBehavior";
import { selectActivity } from "./ActivitySelector";
import { Pathfinder } from "../pathfinding/Pathfinder";

/** Max new paths per frame to avoid frame spikes */
const MAX_PATHS_PER_FRAME = 2;

export class AgentBehaviorSystem {
  private behaviors: Map<string, AgentBehavior> = new Map();
  private pathfinder: Pathfinder;
  private pathBudgetThisFrame = 0;

  constructor() {
    this.pathfinder = new Pathfinder();
  }

  /** Initialize or reinitialize from full game state */
  initFromState(state: SpectatorState): void {
    this.pathfinder.setGrid(state.grid);
    this.updateRoadCells(state);

    // Create behaviors for all agents
    for (const agent of Object.values(state.agents)) {
      if (!this.behaviors.has(agent.id)) {
        this.createBehavior(agent, state);
      }
    }

    // Remove behaviors for agents that no longer exist
    for (const id of this.behaviors.keys()) {
      if (!state.agents[id]) {
        this.behaviors.delete(id);
      }
    }
  }

  /** Create a new behavior for an agent */
  private createBehavior(agent: PublicAgent, state: SpectatorState): AgentBehavior {
    // Use plot center as start position if agent has plots (prevents center-spawn on stale DB positions)
    let startX = agent.x;
    let startY = agent.y;
    const plots = Object.values(state.plots).filter((p) => p.ownerId === agent.id);
    if (plots.length > 0) {
      startX = plots[0].x + Math.floor(plots[0].width / 2);
      startY = plots[0].y + Math.floor(plots[0].height / 2);
    }

    const behavior = new AgentBehavior(agent.id, startX, startY, this.pathfinder);

    // Set home to first owned plot or agent position
    if (plots.length > 0) {
      behavior.setHome(plots[0].x + 1, plots[0].y + 1);
    }

    this.behaviors.set(agent.id, behavior);
    return behavior;
  }

  /** Update road cells from state (for pathfinder cost override) */
  private updateRoadCells(state: SpectatorState): void {
    const roads = new Set<string>();
    for (const building of Object.values(state.buildings)) {
      if (building.type === "road" && building.completed) {
        for (let dy = 0; dy < building.height; dy++) {
          for (let dx = 0; dx < building.width; dx++) {
            roads.add(`${building.x + dx},${building.y + dy}`);
          }
        }
      }
    }
    this.pathfinder.setRoadCells(roads);
  }

  /** Update all behaviors (call once per frame) */
  update(dt: number, state: SpectatorState | null): void {
    if (!state) return;

    this.pathBudgetThisFrame = 0;

    for (const behavior of this.behaviors.values()) {
      // Check if agent needs a new activity
      if (behavior.needsActivity && this.pathBudgetThisFrame < MAX_PATHS_PER_FRAME) {
        const activity = selectActivity(
          behavior.data.agentId,
          behavior.x,
          behavior.y,
          state,
        );
        behavior.setState(activity.state, activity.targetX, activity.targetY, activity.targetBuildingId);
        this.pathBudgetThisFrame++;
      }

      behavior.update(dt);
    }
  }

  /** Get behavior for an agent */
  getBehavior(agentId: string): AgentBehavior | undefined {
    return this.behaviors.get(agentId);
  }

  /** Handle new agent joining */
  onAgentJoined(agent: PublicAgent, state: SpectatorState): void {
    if (!this.behaviors.has(agent.id)) {
      this.createBehavior(agent, state);
    }
  }

  /** Handle agent position update from server */
  onAgentMoved(agentId: string, x: number, y: number): void {
    const behavior = this.behaviors.get(agentId);
    if (behavior) {
      // If server moves the agent, snap the pathfollower
      behavior.pathFollower.x = x;
      behavior.pathFollower.y = y;
    }
  }

  /** Handle building placed event */
  onBuildingPlaced(building: Building): void {
    const behavior = this.behaviors.get(building.ownerId);
    if (behavior) {
      behavior.onBuildingPlaced(building.id, building.x, building.y);
    }
  }

  /** Handle building completed event */
  onBuildingCompleted(building: Building): void {
    const behavior = this.behaviors.get(building.ownerId);
    if (behavior) {
      behavior.onBuildingCompleted();
    }
  }

  /** Handle resources collected event */
  onResourcesCollected(agentId: string): void {
    const behavior = this.behaviors.get(agentId);
    if (behavior) {
      behavior.data.state = "IDLE";
    }
  }

  /** Remove an agent's behavior */
  removeAgent(agentId: string): void {
    this.behaviors.delete(agentId);
  }
}
