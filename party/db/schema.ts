import {
  pgTable,
  text,
  integer,
  real,
  boolean,
  bigint,
  json,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ======================= AGENTS =======================

export const agents = pgTable(
  "agents",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    apiKey: text("api_key").notNull(),
    color: text("color").notNull(),
    x: integer("x").notNull().default(0),
    y: integer("y").notNull().default(0),
    // Raw resources
    rawWood: real("raw_wood").notNull().default(0),
    rawStone: real("raw_stone").notNull().default(0),
    rawWater: real("raw_water").notNull().default(0),
    rawFood: real("raw_food").notNull().default(0),
    rawClay: real("raw_clay").notNull().default(0),
    // Refined materials
    refinedPlanks: real("refined_planks").notNull().default(0),
    refinedBricks: real("refined_bricks").notNull().default(0),
    refinedCement: real("refined_cement").notNull().default(0),
    refinedGlass: real("refined_glass").notNull().default(0),
    refinedSteel: real("refined_steel").notNull().default(0),
    // Tokens
    tokens: real("tokens").notNull().default(0),
    // Agent stats
    reputation: integer("reputation").notNull().default(0),
    personality: text("personality").notNull().default("builder"),
    inventoryLimit: integer("inventory_limit").notNull().default(100),
    currentTier: integer("current_tier").notNull().default(0),
    isStarving: boolean("is_starving").notNull().default(false),
    visionRadius: integer("vision_radius").notNull().default(5),
    foodConsumedAt: bigint("food_consumed_at", { mode: "number" }).notNull().default(0),
    // Social
    clanId: text("clan_id"),
    joinedAt: bigint("joined_at", { mode: "number" }).notNull(),
    lastSeen: bigint("last_seen", { mode: "number" }).notNull(),
    plotCount: integer("plot_count").notNull().default(0),
    buildingCount: integer("building_count").notNull().default(0),
    online: boolean("online").notNull().default(false),
  },
  (table) => [
    uniqueIndex("agents_api_key_idx").on(table.apiKey),
    index("agents_reputation_idx").on(table.reputation),
    index("agents_clan_id_idx").on(table.clanId),
  ]
);

// ======================= PLOTS =======================

export const plots = pgTable(
  "plots",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    claimedAt: bigint("claimed_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("plots_owner_id_idx").on(table.ownerId),
    index("plots_xy_idx").on(table.x, table.y),
  ]
);

// ======================= BUILDINGS =======================

export const buildings = pgTable(
  "buildings",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    tier: integer("tier").notNull().default(1),
    ownerId: text("owner_id").notNull(),
    plotId: text("plot_id").notNull(),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    level: integer("level").notNull().default(1),
    progress: real("progress").notNull().default(0),
    completed: boolean("completed").notNull().default(false),
    startedAt: bigint("started_at", { mode: "number" }).notNull(),
    completedAt: bigint("completed_at", { mode: "number" }),
    // Durability
    durability: real("durability").notNull().default(50),
    maxDurability: real("max_durability").notNull().default(50),
    decayRate: real("decay_rate").notNull().default(1),
    // Economy
    tokenIncome: real("token_income").notNull().default(0),
    rentContractType: text("rent_contract_type"),
    rentTicksRemaining: integer("rent_ticks_remaining").notNull().default(0),
    // Pending raw resources
    pendingRawWood: real("pending_raw_wood").notNull().default(0),
    pendingRawStone: real("pending_raw_stone").notNull().default(0),
    pendingRawWater: real("pending_raw_water").notNull().default(0),
    pendingRawFood: real("pending_raw_food").notNull().default(0),
    pendingRawClay: real("pending_raw_clay").notNull().default(0),
    // Pending refined materials
    pendingRefinedPlanks: real("pending_refined_planks").notNull().default(0),
    pendingRefinedBricks: real("pending_refined_bricks").notNull().default(0),
    pendingRefinedCement: real("pending_refined_cement").notNull().default(0),
    pendingRefinedGlass: real("pending_refined_glass").notNull().default(0),
    pendingRefinedSteel: real("pending_refined_steel").notNull().default(0),
    // Pending tokens
    pendingTokens: real("pending_tokens").notNull().default(0),
    lastCollection: bigint("last_collection", { mode: "number" }).notNull(),
    inscription: text("inscription"),
    contributors: json("contributors").$type<Record<string, Record<string, number>>>(),
  },
  (table) => [
    index("buildings_owner_id_idx").on(table.ownerId),
    index("buildings_plot_id_idx").on(table.plotId),
    index("buildings_completed_idx").on(table.completed),
  ]
);

// ======================= CLANS =======================

export const clans = pgTable(
  "clans",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    tag: text("tag").notNull().unique(),
    leaderId: text("leader_id").notNull(),
    memberIds: json("member_ids").notNull().$type<string[]>(),
    // Treasury - raw
    treasuryRawWood: real("treasury_raw_wood").notNull().default(0),
    treasuryRawStone: real("treasury_raw_stone").notNull().default(0),
    treasuryRawWater: real("treasury_raw_water").notNull().default(0),
    treasuryRawFood: real("treasury_raw_food").notNull().default(0),
    treasuryRawClay: real("treasury_raw_clay").notNull().default(0),
    // Treasury - refined
    treasuryRefinedPlanks: real("treasury_refined_planks").notNull().default(0),
    treasuryRefinedBricks: real("treasury_refined_bricks").notNull().default(0),
    treasuryRefinedCement: real("treasury_refined_cement").notNull().default(0),
    treasuryRefinedGlass: real("treasury_refined_glass").notNull().default(0),
    treasuryRefinedSteel: real("treasury_refined_steel").notNull().default(0),
    // Treasury - tokens
    treasuryTokens: real("treasury_tokens").notNull().default(0),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    description: text("description").notNull().default(""),
  },
  (table) => [
    index("clans_leader_id_idx").on(table.leaderId),
  ]
);

// ======================= TRADES =======================

export const trades = pgTable(
  "trades",
  {
    id: text("id").primaryKey(),
    sellerId: text("seller_id").notNull(),
    sellerName: text("seller_name").notNull(),
    buyerId: text("buyer_id"),
    // Offering - raw
    offeringRawWood: real("offering_raw_wood").notNull().default(0),
    offeringRawStone: real("offering_raw_stone").notNull().default(0),
    offeringRawWater: real("offering_raw_water").notNull().default(0),
    offeringRawFood: real("offering_raw_food").notNull().default(0),
    offeringRawClay: real("offering_raw_clay").notNull().default(0),
    // Offering - refined
    offeringRefinedPlanks: real("offering_refined_planks").notNull().default(0),
    offeringRefinedBricks: real("offering_refined_bricks").notNull().default(0),
    offeringRefinedCement: real("offering_refined_cement").notNull().default(0),
    offeringRefinedGlass: real("offering_refined_glass").notNull().default(0),
    offeringRefinedSteel: real("offering_refined_steel").notNull().default(0),
    // Offering - tokens
    offeringTokens: real("offering_tokens").notNull().default(0),
    // Requesting - raw
    requestingRawWood: real("requesting_raw_wood").notNull().default(0),
    requestingRawStone: real("requesting_raw_stone").notNull().default(0),
    requestingRawWater: real("requesting_raw_water").notNull().default(0),
    requestingRawFood: real("requesting_raw_food").notNull().default(0),
    requestingRawClay: real("requesting_raw_clay").notNull().default(0),
    // Requesting - refined
    requestingRefinedPlanks: real("requesting_refined_planks").notNull().default(0),
    requestingRefinedBricks: real("requesting_refined_bricks").notNull().default(0),
    requestingRefinedCement: real("requesting_refined_cement").notNull().default(0),
    requestingRefinedGlass: real("requesting_refined_glass").notNull().default(0),
    requestingRefinedSteel: real("requesting_refined_steel").notNull().default(0),
    // Requesting - tokens
    requestingTokens: real("requesting_tokens").notNull().default(0),
    status: text("status").notNull().default("open"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    resolvedAt: bigint("resolved_at", { mode: "number" }),
  },
  (table) => [
    index("trades_seller_id_idx").on(table.sellerId),
    index("trades_status_idx").on(table.status),
    index("trades_created_at_idx").on(table.createdAt),
  ]
);

// ======================= PROPOSALS =======================

export const proposals = pgTable(
  "proposals",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    proposerId: text("proposer_id").notNull(),
    proposerName: text("proposer_name").notNull(),
    votes: json("votes").notNull().$type<Record<string, string>>().default({}),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
    status: text("status").notNull().default("active"),
    result: text("result"),
  },
  (table) => [
    index("proposals_proposer_id_idx").on(table.proposerId),
    index("proposals_status_idx").on(table.status),
  ]
);

// ======================= CHAT MESSAGES =======================

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    channel: text("channel").notNull(),
    senderId: text("sender_id").notNull(),
    senderName: text("sender_name").notNull(),
    recipientId: text("recipient_id"),
    clanId: text("clan_id"),
    content: text("content").notNull(),
    timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  },
  (table) => [
    index("chat_sender_id_idx").on(table.senderId),
    index("chat_clan_id_idx").on(table.clanId),
    index("chat_channel_timestamp_idx").on(table.channel, table.timestamp),
  ]
);

// ======================= NOTIFICATIONS =======================

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id").notNull(),
    type: text("type").notNull(),
    message: text("message").notNull(),
    timestamp: bigint("timestamp", { mode: "number" }).notNull(),
    read: boolean("read").notNull().default(false),
  },
  (table) => [
    index("notifications_agent_read_idx").on(table.agentId, table.read),
  ]
);

// ======================= ACTIVITY =======================

export const activity = pgTable(
  "activity",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    agentId: text("agent_id").notNull(),
    agentName: text("agent_name").notNull(),
    description: text("description").notNull(),
    timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  },
  (table) => [
    index("activity_timestamp_idx").on(table.timestamp),
  ]
);

// ======================= RESOURCE NODES =======================

export const resourceNodes = pgTable(
  "resource_nodes",
  {
    id: text("id").primaryKey(),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    type: text("type").notNull(), // "tree" | "stone_deposit" | "clay_deposit" | "water_source" | "fertile_soil"
    maxAmount: real("max_amount").notNull(),
    currentAmount: real("current_amount").notNull(),
    respawnTicks: integer("respawn_ticks").notNull().default(15),
    depletedAt: bigint("depleted_at", { mode: "number" }),
  },
  (table) => [
    index("resource_nodes_xy_idx").on(table.x, table.y),
    index("resource_nodes_type_idx").on(table.type),
  ]
);

// ======================= WORLD EVENTS =======================

export const worldEvents = pgTable(
  "world_events",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    description: text("description").notNull(),
    startTick: integer("start_tick").notNull(),
    endTick: integer("end_tick").notNull(),
    effects: json("effects").$type<Record<string, unknown>>().default({}),
  },
  (table) => [
    index("world_events_start_tick_idx").on(table.startTick),
  ]
);

// ======================= MILESTONES =======================

export const milestones = pgTable(
  "milestones",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull().unique(),
    achievedAt: bigint("achieved_at", { mode: "number" }).notNull(),
    achievedByAgentId: text("achieved_by_agent_id").notNull(),
  }
);

// ======================= GAME META =======================

export const gameMeta = pgTable("game_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
