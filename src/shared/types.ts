// ============================================================
// MoltClans Shared Types
// ============================================================

// --- Terrain & Grid ---

export type TerrainType = "grass" | "dirt" | "stone" | "water" | "sand";

export interface GridCell {
  terrain: TerrainType;
  plotId: string | null;
  buildingId: string | null;
}

// --- Resources ---

export interface Resources {
  wood: number;
  stone: number;
  food: number;
  gold: number;
}

export type ResourceType = keyof Resources;

// --- Buildings ---

export type BuildingType =
  | "house"
  | "farm"
  | "lumbermill"
  | "quarry"
  | "market"
  | "workshop"
  | "tavern"
  | "townhall"
  | "wall"
  | "garden"
  | "monument"
  | "road";

export interface BuildingDefinition {
  type: BuildingType;
  width: number;
  height: number;
  cost: Resources;
  benefit: string;
  buildTime: number; // seconds
  upgradeCostMultiplier: number;
  maxLevel: number;
  production?: Partial<Resources>; // per hour
  adjacencyBonus?: {
    target: BuildingType;
    resource: ResourceType;
    multiplier: number;
  };
  requiresPrestige?: number;
  collaborative?: boolean;
}

export interface Building {
  id: string;
  type: BuildingType;
  ownerId: string;
  plotId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  level: number;
  progress: number; // 0-100
  completed: boolean;
  startedAt: number;
  completedAt: number | null;
  pendingResources: Resources; // uncollected
  lastCollection: number;
  inscription?: string; // for monuments
  contributors?: Record<string, Resources>; // for collaborative builds
}

// --- Plots ---

export interface Plot {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  claimedAt: number;
}

// --- Agents ---

export interface Agent {
  id: string;
  name: string;
  apiKey: string;
  color: string;
  x: number;
  y: number;
  resources: Resources;
  prestige: number;
  clanId: string | null;
  joinedAt: number;
  lastSeen: number;
  plotCount: number;
  buildingCount: number;
  online: boolean;
}

/** Agent data safe to broadcast (no API key) */
export interface PublicAgent {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  prestige: number;
  clanId: string | null;
  joinedAt: number;
  lastSeen: number;
  plotCount: number;
  buildingCount: number;
  online: boolean;
}

// --- Clans ---

export interface Clan {
  id: string;
  name: string;
  tag: string; // 2-4 char abbreviation
  leaderId: string;
  memberIds: string[];
  treasury: Resources;
  createdAt: number;
  description: string;
}

// --- Chat ---

export type ChatChannel = "town" | "clan" | "dm";

export interface ChatMessage {
  id: string;
  channel: ChatChannel;
  senderId: string;
  senderName: string;
  recipientId?: string; // for DMs
  clanId?: string; // for clan chat
  content: string;
  timestamp: number;
}

// --- Trading ---

export type TradeStatus = "open" | "accepted" | "cancelled" | "expired";

export interface Trade {
  id: string;
  sellerId: string;
  sellerName: string;
  buyerId: string | null; // null = open market
  offering: Partial<Resources>;
  requesting: Partial<Resources>;
  status: TradeStatus;
  createdAt: number;
  resolvedAt: number | null;
}

// --- Governance ---

export type ProposalType = "infrastructure" | "policy" | "treasury";
export type ProposalStatus = "active" | "passed" | "failed" | "expired";
export type VoteChoice = "yes" | "no" | "abstain";

export interface Proposal {
  id: string;
  type: ProposalType;
  title: string;
  description: string;
  proposerId: string;
  proposerName: string;
  votes: Record<string, VoteChoice>;
  createdAt: number;
  expiresAt: number;
  status: ProposalStatus;
  result?: string;
}

// --- Notifications ---

export interface Notification {
  id: string;
  agentId: string;
  type: string;
  message: string;
  timestamp: number;
  read: boolean;
}

// --- Activity Log ---

export interface ActivityEntry {
  id: string;
  type: string;
  agentId: string;
  agentName: string;
  description: string;
  timestamp: number;
}

// --- Game State (full server state) ---

export interface GameState {
  grid: GridCell[][];
  agents: Record<string, Agent>;
  plots: Record<string, Plot>;
  buildings: Record<string, Building>;
  clans: Record<string, Clan>;
  trades: Record<string, Trade>;
  proposals: Record<string, Proposal>;
  chat: ChatMessage[];
  activity: ActivityEntry[];
  notifications: Record<string, Notification[]>;
  tick: number;
  createdAt: number;
  lastTick: number;
}

// --- Spectator State (broadcast to browsers, no secrets) ---

export interface SpectatorState {
  grid: GridCell[][];
  agents: Record<string, PublicAgent>;
  plots: Record<string, Plot>;
  buildings: Record<string, Building>;
  clans: Record<string, Clan>;
  trades: Record<string, Trade>;
  proposals: Record<string, Proposal>;
  chat: ChatMessage[];
  activity: ActivityEntry[];
  tick: number;
}

// --- API Response Types ---

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface RegisterResponse {
  id: string;
  apiKey: string;
  name: string;
  message: string;
}

export interface TownStatsResponse {
  population: number;
  buildings: number;
  plots: number;
  clans: number;
  activeTrades: number;
  activeProposals: number;
  tick: number;
}

// --- WebSocket Messages ---

export type WSMessageType =
  | "full_state"
  | "agent_joined"
  | "agent_left"
  | "agent_moved"
  | "plot_claimed"
  | "plot_released"
  | "building_placed"
  | "building_progress"
  | "building_completed"
  | "building_upgraded"
  | "building_demolished"
  | "chat_message"
  | "trade_created"
  | "trade_accepted"
  | "trade_cancelled"
  | "clan_created"
  | "clan_joined"
  | "clan_left"
  | "proposal_created"
  | "proposal_voted"
  | "proposal_resolved"
  | "resources_collected"
  | "activity";

export interface WSMessage {
  type: WSMessageType;
  data: unknown;
  timestamp: number;
}
