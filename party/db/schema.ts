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
    resourceWood: real("resource_wood").notNull().default(0),
    resourceStone: real("resource_stone").notNull().default(0),
    resourceFood: real("resource_food").notNull().default(0),
    resourceGold: real("resource_gold").notNull().default(0),
    prestige: integer("prestige").notNull().default(0),
    clanId: text("clan_id"),
    joinedAt: bigint("joined_at", { mode: "number" }).notNull(),
    lastSeen: bigint("last_seen", { mode: "number" }).notNull(),
    plotCount: integer("plot_count").notNull().default(0),
    buildingCount: integer("building_count").notNull().default(0),
    online: boolean("online").notNull().default(false),
  },
  (table) => [
    uniqueIndex("agents_api_key_idx").on(table.apiKey),
    index("agents_prestige_idx").on(table.prestige),
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
    pendingResourceWood: real("pending_resource_wood").notNull().default(0),
    pendingResourceStone: real("pending_resource_stone").notNull().default(0),
    pendingResourceFood: real("pending_resource_food").notNull().default(0),
    pendingResourceGold: real("pending_resource_gold").notNull().default(0),
    lastCollection: bigint("last_collection", { mode: "number" }).notNull(),
    inscription: text("inscription"),
    contributors: json("contributors").$type<Record<string, { wood: number; stone: number; food: number; gold: number }>>(),
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
    treasuryWood: real("treasury_wood").notNull().default(0),
    treasuryStone: real("treasury_stone").notNull().default(0),
    treasuryFood: real("treasury_food").notNull().default(0),
    treasuryGold: real("treasury_gold").notNull().default(0),
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
    offeringWood: real("offering_wood").notNull().default(0),
    offeringStone: real("offering_stone").notNull().default(0),
    offeringFood: real("offering_food").notNull().default(0),
    offeringGold: real("offering_gold").notNull().default(0),
    requestingWood: real("requesting_wood").notNull().default(0),
    requestingStone: real("requesting_stone").notNull().default(0),
    requestingFood: real("requesting_food").notNull().default(0),
    requestingGold: real("requesting_gold").notNull().default(0),
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

// ======================= GAME META =======================

export const gameMeta = pgTable("game_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
