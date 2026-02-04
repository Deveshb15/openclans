// ============================================================
// MoltClans - Convex Client Wrapper
// ============================================================

import { ConvexClient } from "convex/browser";
import type { api } from "../../convex/_generated/api";
import type { SpectatorState, PublicAgent, Building, Plot, ChatMessage, ActivityEntry } from "../shared/types";

export type StateUpdateCallback = (state: SpectatorState) => void;

/**
 * MoltClansConvexClient wraps the Convex client for the spectator view.
 * Uses reactive queries to automatically receive updates when data changes.
 */
export class MoltClansConvexClient {
  private client: ConvexClient<typeof api>;
  private subscriptions: Array<() => void> = [];
  private _connected = false;

  /** Callback for when connection opens */
  public onOpen: (() => void) | null = null;

  /** Callback for when connection closes */
  public onClose: (() => void) | null = null;

  /** Callback for connection errors */
  public onError: ((error: Error) => void) | null = null;

  constructor(url: string) {
    this.client = new ConvexClient(url);

    // Monitor connection status
    // Note: ConvexClient doesn't have direct connection events,
    // but we can infer connection from query responses
    this._connected = true;
    setTimeout(() => {
      if (this.onOpen) this.onOpen();
    }, 100);
  }

  /** Whether the client is currently connected */
  get isConnected(): boolean {
    return this._connected;
  }

  /**
   * Subscribe to the full spectator state.
   * Callback is called whenever any part of the state changes.
   */
  subscribeToState(callback: StateUpdateCallback): () => void {
    const unsubscribe = this.client.onUpdate(
      // @ts-ignore - API types will be generated
      "town/queries:getSpectatorState" as any,
      {},
      (state: any) => {
        if (state) {
          callback(this.transformSpectatorState(state));
        }
      }
    );

    this.subscriptions.push(unsubscribe);
    return unsubscribe;
  }

  /**
   * Subscribe to agents only (for movement updates).
   */
  subscribeToAgents(callback: (agents: Record<string, PublicAgent>) => void): () => void {
    const unsubscribe = this.client.onUpdate(
      // @ts-ignore
      "agents/queries:getAllPublic" as any,
      {},
      (agents: any[]) => {
        if (agents) {
          const agentsMap: Record<string, PublicAgent> = {};
          for (const agent of agents) {
            agentsMap[agent._id] = this.transformPublicAgent(agent);
          }
          callback(agentsMap);
        }
      }
    );

    this.subscriptions.push(unsubscribe);
    return unsubscribe;
  }

  /**
   * Subscribe to buildings (for construction updates).
   */
  subscribeToBuildings(callback: (buildings: Record<string, Building>) => void): () => void {
    const unsubscribe = this.client.onUpdate(
      // @ts-ignore
      "buildings/queries:getAll" as any,
      {},
      (buildings: any[]) => {
        if (buildings) {
          const buildingsMap: Record<string, Building> = {};
          for (const building of buildings) {
            buildingsMap[building._id] = this.transformBuilding(building);
          }
          callback(buildingsMap);
        }
      }
    );

    this.subscriptions.push(unsubscribe);
    return unsubscribe;
  }

  /**
   * Subscribe to chat messages.
   */
  subscribeToChat(callback: (messages: ChatMessage[]) => void): () => void {
    const unsubscribe = this.client.onUpdate(
      // @ts-ignore
      "chat/queries:getRecent" as any,
      { limit: 200 },
      (messages: any[]) => {
        if (messages) {
          callback(messages.map(this.transformChatMessage));
        }
      }
    );

    this.subscriptions.push(unsubscribe);
    return unsubscribe;
  }

  /**
   * Subscribe to activity feed.
   */
  subscribeToActivity(callback: (activity: ActivityEntry[]) => void): () => void {
    const unsubscribe = this.client.onUpdate(
      // @ts-ignore
      "town/queries:getActivity" as any,
      {},
      (activity: any[]) => {
        if (activity) {
          callback(activity.map(this.transformActivityEntry));
        }
      }
    );

    this.subscriptions.push(unsubscribe);
    return unsubscribe;
  }

  /**
   * Fetch the initial full state once (non-reactive).
   */
  async fetchInitialState(): Promise<SpectatorState | null> {
    try {
      // @ts-ignore
      const state = await this.client.query("town/queries:getSpectatorState" as any, {});
      return state ? this.transformSpectatorState(state) : null;
    } catch (e) {
      console.error("[ConvexClient] Failed to fetch initial state:", e);
      return null;
    }
  }

  /**
   * Close all subscriptions.
   */
  close(): void {
    for (const unsubscribe of this.subscriptions) {
      unsubscribe();
    }
    this.subscriptions = [];
    this._connected = false;
    if (this.onClose) this.onClose();
  }

  // --- Transform functions to match existing types ---

  private transformSpectatorState(state: any): SpectatorState {
    // Transform agents from object with _id keys to Record<string, PublicAgent>
    const agents: Record<string, PublicAgent> = {};
    if (state.agents) {
      for (const [id, agent] of Object.entries(state.agents)) {
        agents[id] = this.transformPublicAgent(agent);
      }
    }

    // Transform buildings
    const buildings: Record<string, Building> = {};
    if (state.buildings) {
      for (const [id, building] of Object.entries(state.buildings)) {
        buildings[id] = this.transformBuilding(building);
      }
    }

    // Transform plots
    const plots: Record<string, Plot> = {};
    if (state.plots) {
      for (const [id, plot] of Object.entries(state.plots)) {
        plots[id] = this.transformPlot(plot);
      }
    }

    return {
      grid: state.grid || [],
      agents,
      plots,
      buildings,
      clans: state.clans || {},
      trades: state.trades || {},
      proposals: state.proposals || {},
      chat: (state.chat || []).map(this.transformChatMessage),
      activity: (state.activity || []).map(this.transformActivityEntry),
      worldEvents: state.worldEvents || [],
      milestones: state.milestones || [],
      tick: state.tick || 0,
      publicTreasury: state.publicTreasury || 0,
    };
  }

  private transformPublicAgent(agent: any): PublicAgent {
    return {
      id: agent._id || agent.id,
      name: agent.name,
      color: agent.color,
      x: agent.x,
      y: agent.y,
      reputation: agent.reputation,
      personality: agent.personality,
      currentTier: agent.currentTier,
      isStarving: agent.isStarving,
      clanId: agent.clanId || null,
      joinedAt: agent.joinedAt,
      lastSeen: agent.lastSeen,
      plotCount: agent.plotCount,
      buildingCount: agent.buildingCount,
      online: agent.online,
    };
  }

  private transformBuilding(building: any): Building {
    return {
      id: building._id || building.id,
      type: building.type,
      tier: building.tier,
      ownerId: building.ownerId,
      plotId: building.plotId,
      x: building.x,
      y: building.y,
      width: building.width,
      height: building.height,
      level: building.level,
      progress: building.progress,
      completed: building.completed,
      startedAt: building.startedAt,
      completedAt: building.completedAt || null,
      durability: building.durability,
      maxDurability: building.maxDurability,
      decayRate: building.decayRate,
      tokenIncome: building.tokenIncome,
      rentContractType: building.rentContractType || null,
      rentTicksRemaining: building.rentTicksRemaining,
      pendingRawWood: building.pendingRawWood,
      pendingRawStone: building.pendingRawStone,
      pendingRawWater: building.pendingRawWater,
      pendingRawFood: building.pendingRawFood,
      pendingRawClay: building.pendingRawClay,
      pendingRefinedPlanks: building.pendingRefinedPlanks,
      pendingRefinedBricks: building.pendingRefinedBricks,
      pendingRefinedCement: building.pendingRefinedCement,
      pendingRefinedGlass: building.pendingRefinedGlass,
      pendingRefinedSteel: building.pendingRefinedSteel,
      pendingTokens: building.pendingTokens,
      lastCollection: building.lastCollection,
      inscription: building.inscription,
      contributors: building.contributors,
    };
  }

  private transformPlot(plot: any): Plot {
    return {
      id: plot._id || plot.id,
      ownerId: plot.ownerId,
      x: plot.x,
      y: plot.y,
      width: plot.width,
      height: plot.height,
      claimedAt: plot.claimedAt,
    };
  }

  private transformChatMessage(message: any): ChatMessage {
    return {
      id: message._id || message.id,
      channel: message.channel,
      senderId: message.senderId,
      senderName: message.senderName,
      recipientId: message.recipientId,
      clanId: message.clanId,
      content: message.content,
      timestamp: message.timestamp,
    };
  }

  private transformActivityEntry(entry: any): ActivityEntry {
    return {
      id: entry._id || entry.id,
      type: entry.type,
      agentId: entry.agentId,
      agentName: entry.agentName,
      description: entry.description,
      timestamp: entry.timestamp,
    };
  }
}
