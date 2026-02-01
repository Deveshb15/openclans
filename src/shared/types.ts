// ============================================================
// MoltClans Shared Types — v2.0 Game Rules Overhaul
// ============================================================

// --- Terrain & Grid ---

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

// --- Resources ---

export interface RawResources {
  wood: number;
  stone: number;
  water: number;
  food: number;
  clay: number;
}

export interface RefinedMaterials {
  planks: number;
  bricks: number;
  cement: number;
  glass: number;
  steel: number;
}

export interface AgentInventory {
  raw: RawResources;
  refined: RefinedMaterials;
  tokens: number;
}

export type RawResourceType = keyof RawResources;
export type RefinedMaterialType = keyof RefinedMaterials;

/** Legacy compat — references to "Resources" now mean the combined inventory */
export interface Resources {
  wood: number;
  stone: number;
  food: number;
  gold: number;
}
export type ResourceType = keyof Resources;

// --- Personality ---

export type PersonalityType = "builder" | "trader" | "politician" | "explorer" | "hoarder" | "diplomat";

// --- Buildings ---

export type BuildingType =
  // Tier 1
  | "wooden_hut"
  | "farm"
  | "sawmill"
  | "storage_shed"
  | "dirt_road"
  | "well"
  // Tier 2
  | "kiln"
  | "stone_house"
  | "marketplace"
  | "stone_wall"
  | "warehouse"
  | "paved_road"
  | "workshop"
  | "inn"
  // Tier 3
  | "cement_works"
  | "town_hall"
  | "apartment_block"
  | "bank"
  | "university"
  | "hospital"
  | "commercial_tower"
  | "forge"
  | "embassy"
  // Tier 4
  | "skyscraper"
  | "grand_bazaar"
  | "mint"
  | "monument"
  | "spaceport";

export interface BuildingCost {
  raw: Partial<RawResources>;
  refined: Partial<RefinedMaterials>;
  tokens: number;
}

export interface RentContract {
  type: RentContractType;
  ticksRemaining: number;
  incomeMultiplier: number;
}

export type RentContractType = "sprint" | "standard" | "long_term";

export interface RefiningRecipe {
  name: string;
  inputs: Partial<RawResources>;
  outputs: Partial<RefinedMaterials>;
  requiresStructure: BuildingType | null;
  handCraftable: boolean;
  handYieldMultiplier: number;
}

export interface BuildingDefinition {
  type: BuildingType;
  tier: number;
  width: number;
  height: number;
  cost: BuildingCost;
  benefit: string;
  buildTime: number; // seconds (instant for most since we use tick-based now)
  maxLevel: number;
  tokenIncome: number; // tokens per tick
  production?: Partial<RawResources>; // raw resources per tick
  durability: number;
  maxDurability: number;
  decayRate: number;
  gateRequirement?: BuildingType; // must own this building to unlock
  reputationGate?: number;
  residential?: boolean; // can have rent contracts
  refineryRecipe?: string; // recipe name this building enables
  adjacencyBonus?: {
    target: BuildingType;
    bonusPercent: number;
  };
  areaOfEffect?: number; // radius in tiles
}

export interface Building {
  id: string;
  type: BuildingType;
  tier: number;
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
  durability: number;
  maxDurability: number;
  decayRate: number;
  tokenIncome: number;
  rentContractType: RentContractType | null;
  rentTicksRemaining: number;
  // Pending resources (uncollected production)
  pendingRawWood: number;
  pendingRawStone: number;
  pendingRawWater: number;
  pendingRawFood: number;
  pendingRawClay: number;
  pendingRefinedPlanks: number;
  pendingRefinedBricks: number;
  pendingRefinedCement: number;
  pendingRefinedGlass: number;
  pendingRefinedSteel: number;
  pendingTokens: number;
  lastCollection: number;
  inscription?: string;
  contributors?: Record<string, Partial<RawResources>>;
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
  inventory: AgentInventory;
  reputation: number;
  personality: PersonalityType;
  inventoryLimit: number;
  currentTier: number;
  isStarving: boolean;
  visionRadius: number;
  foodConsumedAt: number;
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
  reputation: number;
  personality: PersonalityType;
  currentTier: number;
  isStarving: boolean;
  clanId: string | null;
  joinedAt: number;
  lastSeen: number;
  plotCount: number;
  buildingCount: number;
  online: boolean;
}

// --- Clans ---

export interface ClanTreasury {
  raw: Partial<RawResources>;
  refined: Partial<RefinedMaterials>;
  tokens: number;
}

export interface Clan {
  id: string;
  name: string;
  tag: string;
  leaderId: string;
  memberIds: string[];
  treasury: ClanTreasury;
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
  recipientId?: string;
  clanId?: string;
  content: string;
  timestamp: number;
}

// --- Trading ---

export type TradeStatus = "open" | "accepted" | "cancelled" | "expired";

export interface TradeResources {
  raw: Partial<RawResources>;
  refined: Partial<RefinedMaterials>;
  tokens: number;
}

export interface Trade {
  id: string;
  sellerId: string;
  sellerName: string;
  buyerId: string | null;
  offering: TradeResources;
  requesting: TradeResources;
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

// --- World Events ---

export type WorldEventType =
  | "resource_boom"
  | "drought"
  | "new_land_discovery"
  | "trade_festival"
  | "earthquake"
  | "migration_wave";

export interface WorldEvent {
  id: string;
  type: WorldEventType;
  description: string;
  startTick: number;
  endTick: number;
  effects: Record<string, unknown>;
}

// --- Victory Milestones ---

export type MilestoneType =
  | "first_town"
  | "population_100"
  | "world_gdp_10000"
  | "grand_monument"
  | "spaceport";

export interface VictoryMilestone {
  id: string;
  type: MilestoneType;
  achievedAt: number;
  achievedByAgentId: string;
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
  worldEvents: WorldEvent[];
  milestones: VictoryMilestone[];
  tick: number;
  publicTreasury: number;
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
  worldGDP: number;
  publicTreasury: number;
  activeEvents: WorldEvent[];
  milestones: VictoryMilestone[];
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
  | "building_decayed"
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
  | "activity"
  | "agent_action"
  | "world_event"
  | "milestone_achieved"
  | "resource_gathered"
  | "item_refined"
  | "forest_cleared"
  | "agent_starving";

export interface WSMessage {
  type: WSMessageType;
  data: unknown;
  timestamp: number;
}
