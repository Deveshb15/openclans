// ============================================================
// MoltClans - State Synchronization Bridge
// ============================================================

import { SimpleEmitter } from "../utils/SimpleEmitter";
import type { MoltClansConvexClient } from "./ConvexClient";
import type {
  SpectatorState,
  PublicAgent,
  Building,
  Plot,
  Clan,
  Trade,
  Proposal,
  ChatMessage,
  ActivityEntry,
  GridCell,
} from "../shared/types";

/**
 * StateSync bridges the Convex real-time state into the game world.
 * It holds the authoritative client-side SpectatorState and emits
 * events that scenes and entities can listen to.
 *
 * With Convex, we use reactive queries that automatically push updates
 * when data changes, eliminating the need for WebSocket delta messages.
 */
export class StateSync extends SimpleEmitter {
  private state: SpectatorState | null = null;
  private convexClient: MoltClansConvexClient | null = null;
  private subscriptions: Array<() => void> = [];

  constructor() {
    super();
  }

  /** Whether we've received at least one full state */
  get hasState(): boolean {
    return this.state !== null;
  }

  /** Read-only access to the current spectator state */
  getState(): SpectatorState | null {
    return this.state;
  }

  /**
   * Connect to Convex and start receiving real-time updates.
   */
  connect(convexClient: MoltClansConvexClient): void {
    this.convexClient = convexClient;

    // Subscribe to full spectator state
    const unsubscribeState = convexClient.subscribeToState((newState) => {
      this.handleStateUpdate(newState);
    });
    this.subscriptions.push(unsubscribeState);
  }

  /**
   * Disconnect from all subscriptions.
   */
  disconnect(): void {
    for (const unsubscribe of this.subscriptions) {
      unsubscribe();
    }
    this.subscriptions = [];
    this.convexClient = null;
  }

  /**
   * Handle a full state update from Convex.
   * Compare with previous state to emit appropriate delta events.
   */
  private handleStateUpdate(newState: SpectatorState): void {
    const prevState = this.state;
    this.state = newState;

    // If this is the first state, emit full-state event
    if (!prevState) {
      this.emit("full-state", newState);
      return;
    }

    // Compare and emit delta events for changed entities
    this.diffAgents(prevState.agents, newState.agents);
    this.diffPlots(prevState.plots, newState.plots);
    this.diffBuildings(prevState.buildings, newState.buildings);
    this.diffClans(prevState.clans, newState.clans);
    this.diffTrades(prevState.trades, newState.trades);
    this.diffProposals(prevState.proposals, newState.proposals);
    this.diffChat(prevState.chat, newState.chat);
    this.diffActivity(prevState.activity, newState.activity);
  }

  private diffAgents(
    prev: Record<string, PublicAgent>,
    next: Record<string, PublicAgent>
  ): void {
    // Check for new/changed agents
    for (const [id, agent] of Object.entries(next)) {
      const prevAgent = prev[id];
      if (!prevAgent) {
        this.emit("agent-joined", agent);
      } else {
        // Check for position changes
        if (prevAgent.x !== agent.x || prevAgent.y !== agent.y) {
          this.emit("agent-moved", agent);
        }
        // Check for online status changes
        if (prevAgent.online && !agent.online) {
          this.emit("agent-left", agent);
        }
        // Check for starving status
        if (!prevAgent.isStarving && agent.isStarving) {
          this.emit("agent-starving", agent);
        }
      }
    }
  }

  private diffPlots(
    prev: Record<string, Plot>,
    next: Record<string, Plot>
  ): void {
    // Check for new plots
    for (const [id, plot] of Object.entries(next)) {
      if (!prev[id]) {
        // Update grid cells
        for (let dy = 0; dy < plot.height; dy++) {
          for (let dx = 0; dx < plot.width; dx++) {
            const gx = plot.x + dx;
            const gy = plot.y + dy;
            if (this.state?.grid[gy] && this.state.grid[gy][gx]) {
              this.state.grid[gy][gx].plotId = plot.id;
            }
          }
        }
        this.emit("plot-claimed", plot);
      }
    }

    // Check for removed plots
    for (const [id, plot] of Object.entries(prev)) {
      if (!next[id]) {
        // Clear grid cells
        for (let dy = 0; dy < plot.height; dy++) {
          for (let dx = 0; dx < plot.width; dx++) {
            const gx = plot.x + dx;
            const gy = plot.y + dy;
            if (this.state?.grid[gy] && this.state.grid[gy][gx]) {
              this.state.grid[gy][gx].plotId = null;
            }
          }
        }
        this.emit("plot-released", id);
      }
    }
  }

  private diffBuildings(
    prev: Record<string, Building>,
    next: Record<string, Building>
  ): void {
    // Check for new/changed buildings
    for (const [id, building] of Object.entries(next)) {
      const prevBuilding = prev[id];
      if (!prevBuilding) {
        // Update grid cells
        for (let dy = 0; dy < building.height; dy++) {
          for (let dx = 0; dx < building.width; dx++) {
            const gx = building.x + dx;
            const gy = building.y + dy;
            if (this.state?.grid[gy] && this.state.grid[gy][gx]) {
              this.state.grid[gy][gx].buildingId = building.id;
            }
          }
        }
        this.emit("building-placed", building);
      } else {
        // Check for progress changes
        if (prevBuilding.progress !== building.progress) {
          this.emit("building-progress", building);
        }
        // Check for completion
        if (!prevBuilding.completed && building.completed) {
          this.emit("building-completed", building);
        }
        // Check for level changes
        if (prevBuilding.level !== building.level) {
          this.emit("building-upgraded", building);
        }
      }
    }

    // Check for removed buildings
    for (const [id, building] of Object.entries(prev)) {
      if (!next[id]) {
        // Clear grid cells
        for (let dy = 0; dy < building.height; dy++) {
          for (let dx = 0; dx < building.width; dx++) {
            const gx = building.x + dx;
            const gy = building.y + dy;
            if (this.state?.grid[gy] && this.state.grid[gy][gx]) {
              this.state.grid[gy][gx].buildingId = null;
            }
          }
        }
        // Determine if it was demolished or decayed
        this.emit("building-demolished", id);
      }
    }
  }

  private diffClans(
    prev: Record<string, Clan>,
    next: Record<string, Clan>
  ): void {
    for (const [id, clan] of Object.entries(next)) {
      const prevClan = prev[id];
      if (!prevClan) {
        this.emit("clan-created", clan);
      } else {
        // Check for member changes
        const prevMembers = new Set(prevClan.memberIds);
        const nextMembers = new Set(clan.memberIds);

        for (const memberId of nextMembers) {
          if (!prevMembers.has(memberId)) {
            this.emit("clan-joined", { clanId: id, agentId: memberId });
          }
        }

        for (const memberId of prevMembers) {
          if (!nextMembers.has(memberId)) {
            this.emit("clan-left", { clanId: id, agentId: memberId });
          }
        }
      }
    }
  }

  private diffTrades(
    prev: Record<string, Trade>,
    next: Record<string, Trade>
  ): void {
    for (const [id, trade] of Object.entries(next)) {
      const prevTrade = prev[id];
      if (!prevTrade) {
        this.emit("trade-created", trade);
      } else if (prevTrade.status !== trade.status) {
        if (trade.status === "accepted") {
          this.emit("trade-accepted", trade);
        } else if (trade.status === "cancelled") {
          this.emit("trade-cancelled", trade);
        }
      }
    }
  }

  private diffProposals(
    prev: Record<string, Proposal>,
    next: Record<string, Proposal>
  ): void {
    for (const [id, proposal] of Object.entries(next)) {
      const prevProposal = prev[id];
      if (!prevProposal) {
        this.emit("proposal-created", proposal);
      } else {
        // Check for vote changes
        const prevVoteCount = Object.keys(prevProposal.votes).length;
        const nextVoteCount = Object.keys(proposal.votes).length;
        if (nextVoteCount > prevVoteCount) {
          this.emit("proposal-voted", proposal);
        }

        // Check for status changes
        if (prevProposal.status !== proposal.status) {
          this.emit("proposal-resolved", proposal);
        }
      }
    }
  }

  private diffChat(prev: ChatMessage[], next: ChatMessage[]): void {
    // Find new messages
    const prevIds = new Set(prev.map((m) => m.id));
    for (const message of next) {
      if (!prevIds.has(message.id)) {
        this.emit("chat-message", message);
      }
    }
  }

  private diffActivity(prev: ActivityEntry[], next: ActivityEntry[]): void {
    // Find new activity entries
    const prevIds = new Set(prev.map((e) => e.id));
    for (const entry of next) {
      if (!prevIds.has(entry.id)) {
        this.emit("activity", entry);
      }
    }
  }

  /** Replace the entire state with a full snapshot (legacy/manual use) */
  applyFullState(fullState: SpectatorState): void {
    this.state = fullState;
    this.emit("full-state", fullState);
  }
}
