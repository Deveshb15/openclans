// ============================================================
// MoltClans - State Synchronization Bridge
// ============================================================

import { SimpleEmitter } from "../utils/SimpleEmitter";
import type { WSMessage } from "./MessageTypes";
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
 * StateSync bridges the server WebSocket state into the Phaser world.
 * It holds the authoritative client-side SpectatorState and emits
 * events that scenes and entities can listen to.
 */
export class StateSync extends SimpleEmitter {
  private state: SpectatorState | null = null;

  constructor() {
    super(); // SimpleEmitter has no required constructor, but call for clarity
  }

  /** Whether we've received at least one full state */
  get hasState(): boolean {
    return this.state !== null;
  }

  /** Read-only access to the current spectator state */
  getState(): SpectatorState | null {
    return this.state;
  }

  /** Replace the entire state with a full snapshot from the server */
  applyFullState(fullState: SpectatorState): void {
    this.state = fullState;
    this.emit("full-state", fullState);
  }

  /** Apply an incremental delta message */
  applyDelta(message: WSMessage): void {
    if (!this.state) return;

    switch (message.type) {
      case "full_state": {
        this.applyFullState(message.data as SpectatorState);
        break;
      }

      case "agent_joined": {
        const agent = message.data as PublicAgent;
        this.state.agents[agent.id] = agent;
        this.emit("agent-joined", agent);
        break;
      }

      case "agent_left": {
        const { agentId } = message.data as { agentId: string };
        const agent = this.state.agents[agentId];
        if (agent) {
          agent.online = false;
          this.emit("agent-left", agent);
        }
        break;
      }

      case "agent_moved": {
        const { agentId, x, y } = message.data as {
          agentId: string;
          x: number;
          y: number;
        };
        const agent = this.state.agents[agentId];
        if (agent) {
          agent.x = x;
          agent.y = y;
          this.emit("agent-moved", agent);
        }
        break;
      }

      case "plot_claimed": {
        const plot = message.data as Plot;
        this.state.plots[plot.id] = plot;
        // Update grid cells
        for (let dy = 0; dy < plot.height; dy++) {
          for (let dx = 0; dx < plot.width; dx++) {
            const gx = plot.x + dx;
            const gy = plot.y + dy;
            if (this.state.grid[gy] && this.state.grid[gy][gx]) {
              this.state.grid[gy][gx].plotId = plot.id;
            }
          }
        }
        this.emit("plot-claimed", plot);
        break;
      }

      case "plot_released": {
        const { plotId } = message.data as { plotId: string };
        const plot = this.state.plots[plotId];
        if (plot) {
          // Clear grid cells
          for (let dy = 0; dy < plot.height; dy++) {
            for (let dx = 0; dx < plot.width; dx++) {
              const gx = plot.x + dx;
              const gy = plot.y + dy;
              if (this.state.grid[gy] && this.state.grid[gy][gx]) {
                this.state.grid[gy][gx].plotId = null;
              }
            }
          }
          delete this.state.plots[plotId];
          this.emit("plot-released", plotId);
        }
        break;
      }

      case "building_placed": {
        const building = message.data as Building;
        this.state.buildings[building.id] = building;
        // Update grid cells
        for (let dy = 0; dy < building.height; dy++) {
          for (let dx = 0; dx < building.width; dx++) {
            const gx = building.x + dx;
            const gy = building.y + dy;
            if (this.state.grid[gy] && this.state.grid[gy][gx]) {
              this.state.grid[gy][gx].buildingId = building.id;
            }
          }
        }
        this.emit("building-placed", building);
        break;
      }

      case "building_progress": {
        const { buildingId, progress } = message.data as {
          buildingId: string;
          progress: number;
        };
        const building = this.state.buildings[buildingId];
        if (building) {
          building.progress = progress;
          this.emit("building-progress", building);
        }
        break;
      }

      case "building_completed": {
        const { buildingId } = message.data as { buildingId: string };
        const building = this.state.buildings[buildingId];
        if (building) {
          building.progress = 100;
          building.completed = true;
          building.completedAt = message.timestamp;
          this.emit("building-completed", building);
        }
        break;
      }

      case "building_upgraded": {
        const { buildingId, level } = message.data as {
          buildingId: string;
          level: number;
        };
        const building = this.state.buildings[buildingId];
        if (building) {
          building.level = level;
          this.emit("building-upgraded", building);
        }
        break;
      }

      case "building_demolished": {
        const { buildingId } = message.data as { buildingId: string };
        const building = this.state.buildings[buildingId];
        if (building) {
          // Clear grid cells
          for (let dy = 0; dy < building.height; dy++) {
            for (let dx = 0; dx < building.width; dx++) {
              const gx = building.x + dx;
              const gy = building.y + dy;
              if (this.state.grid[gy] && this.state.grid[gy][gx]) {
                this.state.grid[gy][gx].buildingId = null;
              }
            }
          }
          delete this.state.buildings[buildingId];
          this.emit("building-demolished", buildingId);
        }
        break;
      }

      case "chat_message": {
        const chatMsg = message.data as ChatMessage;
        this.state.chat.push(chatMsg);
        // Trim to prevent unbounded growth
        if (this.state.chat.length > 200) {
          this.state.chat = this.state.chat.slice(-200);
        }
        this.emit("chat-message", chatMsg);
        break;
      }

      case "trade_created": {
        const trade = message.data as Trade;
        this.state.trades[trade.id] = trade;
        this.emit("trade-created", trade);
        break;
      }

      case "trade_accepted": {
        const { tradeId, buyerId } = message.data as {
          tradeId: string;
          buyerId: string;
        };
        const trade = this.state.trades[tradeId];
        if (trade) {
          trade.status = "accepted";
          trade.buyerId = buyerId;
          trade.resolvedAt = message.timestamp;
          this.emit("trade-accepted", trade);
        }
        break;
      }

      case "trade_cancelled": {
        const { tradeId } = message.data as { tradeId: string };
        const trade = this.state.trades[tradeId];
        if (trade) {
          trade.status = "cancelled";
          trade.resolvedAt = message.timestamp;
          this.emit("trade-cancelled", trade);
        }
        break;
      }

      case "clan_created": {
        const clan = message.data as Clan;
        this.state.clans[clan.id] = clan;
        this.emit("clan-created", clan);
        break;
      }

      case "clan_joined": {
        const { clanId, agentId } = message.data as {
          clanId: string;
          agentId: string;
        };
        const clan = this.state.clans[clanId];
        if (clan && !clan.memberIds.includes(agentId)) {
          clan.memberIds.push(agentId);
        }
        const agent = this.state.agents[agentId];
        if (agent) {
          agent.clanId = clanId;
        }
        this.emit("clan-joined", { clanId, agentId });
        break;
      }

      case "clan_left": {
        const { clanId, agentId } = message.data as {
          clanId: string;
          agentId: string;
        };
        const clan = this.state.clans[clanId];
        if (clan) {
          clan.memberIds = clan.memberIds.filter((id) => id !== agentId);
        }
        const agent = this.state.agents[agentId];
        if (agent) {
          agent.clanId = null;
        }
        this.emit("clan-left", { clanId, agentId });
        break;
      }

      case "proposal_created": {
        const proposal = message.data as Proposal;
        this.state.proposals[proposal.id] = proposal;
        this.emit("proposal-created", proposal);
        break;
      }

      case "proposal_voted": {
        const { proposalId, agentId, vote } = message.data as {
          proposalId: string;
          agentId: string;
          vote: string;
        };
        const proposal = this.state.proposals[proposalId];
        if (proposal) {
          proposal.votes[agentId] = vote as "yes" | "no" | "abstain";
          this.emit("proposal-voted", proposal);
        }
        break;
      }

      case "proposal_resolved": {
        const { proposalId, status, result } = message.data as {
          proposalId: string;
          status: string;
          result?: string;
        };
        const proposal = this.state.proposals[proposalId];
        if (proposal) {
          proposal.status = status as "passed" | "failed" | "expired";
          if (result) proposal.result = result;
          this.emit("proposal-resolved", proposal);
        }
        break;
      }

      case "resources_collected": {
        // This updates agent resources but we don't have full
        // resource data in PublicAgent, so just emit the event
        this.emit("resources-collected", message.data);
        break;
      }

      case "activity": {
        const entry = message.data as ActivityEntry;
        this.state.activity.push(entry);
        if (this.state.activity.length > 100) {
          this.state.activity = this.state.activity.slice(-100);
        }
        this.emit("activity", entry);
        break;
      }

      case "agent_action": {
        this.emit("agent-action", message.data);
        break;
      }

      case "world_event": {
        const event = message.data as import("../shared/types").WorldEvent;
        if (this.state.worldEvents) {
          this.state.worldEvents.push(event);
        }
        this.emit("world-event", event);
        break;
      }

      case "milestone_achieved": {
        const milestone = message.data as import("../shared/types").VictoryMilestone;
        if (this.state.milestones) {
          this.state.milestones.push(milestone);
        }
        this.emit("milestone-achieved", milestone);
        break;
      }

      case "resource_gathered": {
        this.emit("resource-gathered", message.data);
        break;
      }

      case "item_refined": {
        this.emit("item-refined", message.data);
        break;
      }

      case "forest_cleared": {
        const { x, y } = message.data as { x: number; y: number };
        if (this.state.grid[y] && this.state.grid[y][x]) {
          this.state.grid[y][x].terrain = "plains" as import("../shared/types").TerrainType;
          this.state.grid[y][x].resourceNode = null;
        }
        this.emit("forest-cleared", message.data);
        break;
      }

      case "building_decayed": {
        const { buildingId } = message.data as { buildingId: string };
        const building = this.state.buildings[buildingId];
        if (building) {
          // Clear grid cells occupied by the building
          for (let dy = 0; dy < building.height; dy++) {
            for (let dx = 0; dx < building.width; dx++) {
              const gx = building.x + dx;
              const gy = building.y + dy;
              if (this.state.grid[gy] && this.state.grid[gy][gx]) {
                this.state.grid[gy][gx].buildingId = null;
              }
            }
          }
          delete this.state.buildings[buildingId];
          this.emit("building-decayed", buildingId);
        }
        break;
      }

      case "agent_starving": {
        const { agentId } = message.data as { agentId: string };
        const agent = this.state.agents[agentId];
        if (agent) {
          agent.isStarving = true;
          this.emit("agent-starving", agent);
        }
        break;
      }

      default:
        break;
    }
  }
}
