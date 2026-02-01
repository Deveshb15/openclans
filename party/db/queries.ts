import { eq, and, desc, sql, lt, gte, lte, or } from "drizzle-orm";
import type { Db } from "./client";
import {
  agents,
  plots,
  buildings,
  clans,
  trades,
  proposals,
  chatMessages,
  notifications,
  activity,
  gameMeta,
  resourceNodes,
  worldEvents,
  milestones,
} from "./schema";
import type {
  Agent,
  Plot,
  Building,
  Clan,
  Trade,
  Proposal,
  ChatMessage,
  Notification,
  ActivityEntry,
  WorldEvent,
  VictoryMilestone,
  RawResources,
  RefinedMaterials,
  PersonalityType,
  RentContractType,
} from "../../src/shared/types";

// ======================= ROW MAPPERS =======================

export function rowToAgent(row: typeof agents.$inferSelect): Agent {
  return {
    id: row.id,
    name: row.name,
    apiKey: row.apiKey,
    color: row.color,
    x: row.x,
    y: row.y,
    inventory: {
      raw: {
        wood: row.rawWood,
        stone: row.rawStone,
        water: row.rawWater,
        food: row.rawFood,
        clay: row.rawClay,
      },
      refined: {
        planks: row.refinedPlanks,
        bricks: row.refinedBricks,
        cement: row.refinedCement,
        glass: row.refinedGlass,
        steel: row.refinedSteel,
      },
      tokens: row.tokens,
    },
    reputation: row.reputation,
    personality: row.personality as PersonalityType,
    inventoryLimit: row.inventoryLimit,
    currentTier: row.currentTier,
    isStarving: row.isStarving,
    visionRadius: row.visionRadius,
    foodConsumedAt: row.foodConsumedAt,
    clanId: row.clanId,
    joinedAt: row.joinedAt,
    lastSeen: row.lastSeen,
    plotCount: row.plotCount,
    buildingCount: row.buildingCount,
    online: row.online,
  };
}

export function rowToPlot(row: typeof plots.$inferSelect): Plot {
  return {
    id: row.id,
    ownerId: row.ownerId,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    claimedAt: row.claimedAt,
  };
}

export function rowToBuilding(row: typeof buildings.$inferSelect): Building {
  return {
    id: row.id,
    type: row.type as Building["type"],
    tier: row.tier,
    ownerId: row.ownerId,
    plotId: row.plotId,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    level: row.level,
    progress: row.progress,
    completed: row.completed,
    startedAt: row.startedAt,
    completedAt: row.completedAt ?? null,
    durability: row.durability,
    maxDurability: row.maxDurability,
    decayRate: row.decayRate,
    tokenIncome: row.tokenIncome,
    rentContractType: (row.rentContractType as RentContractType | null) ?? null,
    rentTicksRemaining: row.rentTicksRemaining,
    pendingRawWood: row.pendingRawWood,
    pendingRawStone: row.pendingRawStone,
    pendingRawWater: row.pendingRawWater,
    pendingRawFood: row.pendingRawFood,
    pendingRawClay: row.pendingRawClay,
    pendingRefinedPlanks: row.pendingRefinedPlanks,
    pendingRefinedBricks: row.pendingRefinedBricks,
    pendingRefinedCement: row.pendingRefinedCement,
    pendingRefinedGlass: row.pendingRefinedGlass,
    pendingRefinedSteel: row.pendingRefinedSteel,
    pendingTokens: row.pendingTokens,
    lastCollection: row.lastCollection,
    inscription: row.inscription ?? undefined,
    contributors: row.contributors ?? undefined,
  };
}

export function rowToClan(row: typeof clans.$inferSelect): Clan {
  return {
    id: row.id,
    name: row.name,
    tag: row.tag,
    leaderId: row.leaderId,
    memberIds: row.memberIds,
    treasury: {
      raw: {
        wood: row.treasuryRawWood,
        stone: row.treasuryRawStone,
        water: row.treasuryRawWater,
        food: row.treasuryRawFood,
        clay: row.treasuryRawClay,
      },
      refined: {
        planks: row.treasuryRefinedPlanks,
        bricks: row.treasuryRefinedBricks,
        cement: row.treasuryRefinedCement,
        glass: row.treasuryRefinedGlass,
        steel: row.treasuryRefinedSteel,
      },
      tokens: row.treasuryTokens,
    },
    createdAt: row.createdAt,
    description: row.description,
  };
}

export function rowToTrade(row: typeof trades.$inferSelect): Trade {
  return {
    id: row.id,
    sellerId: row.sellerId,
    sellerName: row.sellerName,
    buyerId: row.buyerId,
    offering: {
      raw: {
        wood: row.offeringRawWood,
        stone: row.offeringRawStone,
        water: row.offeringRawWater,
        food: row.offeringRawFood,
        clay: row.offeringRawClay,
      },
      refined: {
        planks: row.offeringRefinedPlanks,
        bricks: row.offeringRefinedBricks,
        cement: row.offeringRefinedCement,
        glass: row.offeringRefinedGlass,
        steel: row.offeringRefinedSteel,
      },
      tokens: row.offeringTokens,
    },
    requesting: {
      raw: {
        wood: row.requestingRawWood,
        stone: row.requestingRawStone,
        water: row.requestingRawWater,
        food: row.requestingRawFood,
        clay: row.requestingRawClay,
      },
      refined: {
        planks: row.requestingRefinedPlanks,
        bricks: row.requestingRefinedBricks,
        cement: row.requestingRefinedCement,
        glass: row.requestingRefinedGlass,
        steel: row.requestingRefinedSteel,
      },
      tokens: row.requestingTokens,
    },
    status: row.status as Trade["status"],
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt ?? null,
  };
}

export function rowToProposal(row: typeof proposals.$inferSelect): Proposal {
  return {
    id: row.id,
    type: row.type as Proposal["type"],
    title: row.title,
    description: row.description,
    proposerId: row.proposerId,
    proposerName: row.proposerName,
    votes: row.votes as Record<string, "yes" | "no" | "abstain">,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    status: row.status as Proposal["status"],
    result: row.result ?? undefined,
  };
}

export function rowToChatMessage(row: typeof chatMessages.$inferSelect): ChatMessage {
  return {
    id: row.id,
    channel: row.channel as ChatMessage["channel"],
    senderId: row.senderId,
    senderName: row.senderName,
    recipientId: row.recipientId ?? undefined,
    clanId: row.clanId ?? undefined,
    content: row.content,
    timestamp: row.timestamp,
  };
}

export function rowToNotification(row: typeof notifications.$inferSelect): Notification {
  return {
    id: row.id,
    agentId: row.agentId,
    type: row.type,
    message: row.message,
    timestamp: row.timestamp,
    read: row.read,
  };
}

export function rowToActivity(row: typeof activity.$inferSelect): ActivityEntry {
  return {
    id: row.id,
    type: row.type,
    agentId: row.agentId,
    agentName: row.agentName,
    description: row.description,
    timestamp: row.timestamp,
  };
}

export function rowToWorldEvent(row: typeof worldEvents.$inferSelect): WorldEvent {
  return {
    id: row.id,
    type: row.type as WorldEvent["type"],
    description: row.description,
    startTick: row.startTick,
    endTick: row.endTick,
    effects: (row.effects ?? {}) as Record<string, unknown>,
  };
}

export function rowToMilestone(row: typeof milestones.$inferSelect): VictoryMilestone {
  return {
    id: row.id,
    type: row.type as VictoryMilestone["type"],
    achievedAt: row.achievedAt,
    achievedByAgentId: row.achievedByAgentId,
  };
}

// ======================= AGENT QUERIES =======================

export async function getAgentByApiKey(db: Db, apiKey: string): Promise<Agent | null> {
  const rows = await db.select().from(agents).where(eq(agents.apiKey, apiKey)).limit(1);
  return rows[0] ? rowToAgent(rows[0]) : null;
}

export async function getAgentById(db: Db, id: string): Promise<Agent | null> {
  const rows = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  return rows[0] ? rowToAgent(rows[0]) : null;
}

export async function getAllAgents(db: Db): Promise<Agent[]> {
  const rows = await db.select().from(agents);
  return rows.map(rowToAgent);
}

export async function getAgentCount(db: Db): Promise<number> {
  const rows = await db.select({ count: sql<number>`count(*)::int` }).from(agents);
  return rows[0]?.count ?? 0;
}

export async function insertAgent(db: Db, agent: Agent): Promise<void> {
  await db.insert(agents).values({
    id: agent.id,
    name: agent.name,
    apiKey: agent.apiKey,
    color: agent.color,
    x: agent.x,
    y: agent.y,
    rawWood: agent.inventory.raw.wood,
    rawStone: agent.inventory.raw.stone,
    rawWater: agent.inventory.raw.water,
    rawFood: agent.inventory.raw.food,
    rawClay: agent.inventory.raw.clay,
    refinedPlanks: agent.inventory.refined.planks,
    refinedBricks: agent.inventory.refined.bricks,
    refinedCement: agent.inventory.refined.cement,
    refinedGlass: agent.inventory.refined.glass,
    refinedSteel: agent.inventory.refined.steel,
    tokens: agent.inventory.tokens,
    reputation: agent.reputation,
    personality: agent.personality,
    inventoryLimit: agent.inventoryLimit,
    currentTier: agent.currentTier,
    isStarving: agent.isStarving,
    visionRadius: agent.visionRadius,
    foodConsumedAt: agent.foodConsumedAt,
    clanId: agent.clanId,
    joinedAt: agent.joinedAt,
    lastSeen: agent.lastSeen,
    plotCount: agent.plotCount,
    buildingCount: agent.buildingCount,
    online: agent.online,
  });
}

export async function updateAgent(
  db: Db,
  id: string,
  data: Partial<{
    name: string;
    color: string;
    x: number;
    y: number;
    rawWood: number;
    rawStone: number;
    rawWater: number;
    rawFood: number;
    rawClay: number;
    refinedPlanks: number;
    refinedBricks: number;
    refinedCement: number;
    refinedGlass: number;
    refinedSteel: number;
    tokens: number;
    reputation: number;
    personality: string;
    inventoryLimit: number;
    currentTier: number;
    isStarving: boolean;
    visionRadius: number;
    foodConsumedAt: number;
    clanId: string | null;
    lastSeen: number;
    plotCount: number;
    buildingCount: number;
    online: boolean;
  }>
): Promise<void> {
  await db.update(agents).set(data).where(eq(agents.id, id));
}

export async function updateAgentResources(
  db: Db,
  id: string,
  deltas: {
    raw?: Partial<RawResources>;
    refined?: Partial<RefinedMaterials>;
    tokens?: number;
  }
): Promise<void> {
  const sets: Record<string, unknown> = {};
  if (deltas.raw?.wood !== undefined) sets.rawWood = sql`${agents.rawWood} + ${deltas.raw.wood}`;
  if (deltas.raw?.stone !== undefined) sets.rawStone = sql`${agents.rawStone} + ${deltas.raw.stone}`;
  if (deltas.raw?.water !== undefined) sets.rawWater = sql`${agents.rawWater} + ${deltas.raw.water}`;
  if (deltas.raw?.food !== undefined) sets.rawFood = sql`${agents.rawFood} + ${deltas.raw.food}`;
  if (deltas.raw?.clay !== undefined) sets.rawClay = sql`${agents.rawClay} + ${deltas.raw.clay}`;
  if (deltas.refined?.planks !== undefined) sets.refinedPlanks = sql`${agents.refinedPlanks} + ${deltas.refined.planks}`;
  if (deltas.refined?.bricks !== undefined) sets.refinedBricks = sql`${agents.refinedBricks} + ${deltas.refined.bricks}`;
  if (deltas.refined?.cement !== undefined) sets.refinedCement = sql`${agents.refinedCement} + ${deltas.refined.cement}`;
  if (deltas.refined?.glass !== undefined) sets.refinedGlass = sql`${agents.refinedGlass} + ${deltas.refined.glass}`;
  if (deltas.refined?.steel !== undefined) sets.refinedSteel = sql`${agents.refinedSteel} + ${deltas.refined.steel}`;
  if (deltas.tokens !== undefined) sets.tokens = sql`${agents.tokens} + ${deltas.tokens}`;
  if (Object.keys(sets).length > 0) {
    await db.update(agents).set(sets).where(eq(agents.id, id));
  }
}

export async function getLeaderboard(db: Db, limit: number = 50): Promise<Agent[]> {
  const rows = await db.select().from(agents).orderBy(desc(agents.reputation)).limit(limit);
  return rows.map(rowToAgent);
}

export async function getAgentByName(db: Db, name: string): Promise<Agent | null> {
  const rows = await db.select().from(agents).where(sql`lower(${agents.name}) = lower(${name})`).limit(1);
  return rows[0] ? rowToAgent(rows[0]) : null;
}

// ======================= PLOT QUERIES =======================

export async function getPlotById(db: Db, id: string): Promise<Plot | null> {
  const rows = await db.select().from(plots).where(eq(plots.id, id)).limit(1);
  return rows[0] ? rowToPlot(rows[0]) : null;
}

export async function getPlotsByOwnerId(db: Db, ownerId: string): Promise<Plot[]> {
  const rows = await db.select().from(plots).where(eq(plots.ownerId, ownerId));
  return rows.map(rowToPlot);
}

export async function getAllPlots(db: Db): Promise<Plot[]> {
  const rows = await db.select().from(plots);
  return rows.map(rowToPlot);
}

export async function getPlotCount(db: Db): Promise<number> {
  const rows = await db.select({ count: sql<number>`count(*)::int` }).from(plots);
  return rows[0]?.count ?? 0;
}

export async function insertPlot(db: Db, plot: Plot): Promise<void> {
  await db.insert(plots).values({
    id: plot.id,
    ownerId: plot.ownerId,
    x: plot.x,
    y: plot.y,
    width: plot.width,
    height: plot.height,
    claimedAt: plot.claimedAt,
  });
}

export async function updatePlot(
  db: Db,
  id: string,
  data: Partial<{ ownerId: string }>
): Promise<void> {
  await db.update(plots).set(data).where(eq(plots.id, id));
}

export async function deletePlot(db: Db, id: string): Promise<void> {
  await db.delete(plots).where(eq(plots.id, id));
}

// ======================= BUILDING QUERIES =======================

export async function getBuildingById(db: Db, id: string): Promise<Building | null> {
  const rows = await db.select().from(buildings).where(eq(buildings.id, id)).limit(1);
  return rows[0] ? rowToBuilding(rows[0]) : null;
}

export async function getBuildingsByOwnerId(db: Db, ownerId: string): Promise<Building[]> {
  const rows = await db.select().from(buildings).where(eq(buildings.ownerId, ownerId));
  return rows.map(rowToBuilding);
}

export async function getBuildingsByPlotId(db: Db, plotId: string): Promise<Building[]> {
  const rows = await db.select().from(buildings).where(eq(buildings.plotId, plotId));
  return rows.map(rowToBuilding);
}

export async function getAllBuildings(db: Db): Promise<Building[]> {
  const rows = await db.select().from(buildings);
  return rows.map(rowToBuilding);
}

export async function getBuildingCount(db: Db): Promise<number> {
  const rows = await db.select({ count: sql<number>`count(*)::int` }).from(buildings);
  return rows[0]?.count ?? 0;
}

export async function getCompletedBuildings(db: Db): Promise<Building[]> {
  const rows = await db.select().from(buildings).where(eq(buildings.completed, true));
  return rows.map(rowToBuilding);
}

export async function getIncompleteBuildings(db: Db): Promise<Building[]> {
  const rows = await db.select().from(buildings).where(eq(buildings.completed, false));
  return rows.map(rowToBuilding);
}

export async function getCompletedBuildingsByOwner(db: Db, ownerId: string): Promise<Building[]> {
  const rows = await db
    .select()
    .from(buildings)
    .where(and(eq(buildings.ownerId, ownerId), eq(buildings.completed, true)));
  return rows.map(rowToBuilding);
}

export async function insertBuilding(db: Db, building: Building): Promise<void> {
  await db.insert(buildings).values({
    id: building.id,
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
    completedAt: building.completedAt,
    durability: building.durability,
    maxDurability: building.maxDurability,
    decayRate: building.decayRate,
    tokenIncome: building.tokenIncome,
    rentContractType: building.rentContractType,
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
    inscription: building.inscription ?? null,
    contributors: building.contributors ?? null,
  });
}

export async function updateBuilding(
  db: Db,
  id: string,
  data: Partial<{
    ownerId: string;
    tier: number;
    level: number;
    progress: number;
    completed: boolean;
    completedAt: number | null;
    durability: number;
    maxDurability: number;
    decayRate: number;
    tokenIncome: number;
    rentContractType: string | null;
    rentTicksRemaining: number;
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
    inscription: string | null;
    contributors: Record<string, Record<string, number>> | null;
  }>
): Promise<void> {
  await db.update(buildings).set(data).where(eq(buildings.id, id));
}

export async function deleteBuilding(db: Db, id: string): Promise<void> {
  await db.delete(buildings).where(eq(buildings.id, id));
}

export async function bulkUpdateBuildingPendingResources(
  db: Db,
  updates: Array<{
    id: string;
    rawWood: number;
    rawStone: number;
    rawWater: number;
    rawFood: number;
    rawClay: number;
    refinedPlanks: number;
    refinedBricks: number;
    refinedCement: number;
    refinedGlass: number;
    refinedSteel: number;
    tokens: number;
  }>
): Promise<void> {
  for (const u of updates) {
    await db
      .update(buildings)
      .set({
        pendingRawWood: sql`${buildings.pendingRawWood} + ${u.rawWood}`,
        pendingRawStone: sql`${buildings.pendingRawStone} + ${u.rawStone}`,
        pendingRawWater: sql`${buildings.pendingRawWater} + ${u.rawWater}`,
        pendingRawFood: sql`${buildings.pendingRawFood} + ${u.rawFood}`,
        pendingRawClay: sql`${buildings.pendingRawClay} + ${u.rawClay}`,
        pendingRefinedPlanks: sql`${buildings.pendingRefinedPlanks} + ${u.refinedPlanks}`,
        pendingRefinedBricks: sql`${buildings.pendingRefinedBricks} + ${u.refinedBricks}`,
        pendingRefinedCement: sql`${buildings.pendingRefinedCement} + ${u.refinedCement}`,
        pendingRefinedGlass: sql`${buildings.pendingRefinedGlass} + ${u.refinedGlass}`,
        pendingRefinedSteel: sql`${buildings.pendingRefinedSteel} + ${u.refinedSteel}`,
        pendingTokens: sql`${buildings.pendingTokens} + ${u.tokens}`,
      })
      .where(eq(buildings.id, u.id));
  }
}

// ======================= CLAN QUERIES =======================

export async function getClanById(db: Db, id: string): Promise<Clan | null> {
  const rows = await db.select().from(clans).where(eq(clans.id, id)).limit(1);
  return rows[0] ? rowToClan(rows[0]) : null;
}

export async function getClanByName(db: Db, name: string): Promise<Clan | null> {
  const rows = await db.select().from(clans).where(sql`lower(${clans.name}) = lower(${name})`).limit(1);
  return rows[0] ? rowToClan(rows[0]) : null;
}

export async function getClanByTag(db: Db, tag: string): Promise<Clan | null> {
  const rows = await db.select().from(clans).where(eq(clans.tag, tag)).limit(1);
  return rows[0] ? rowToClan(rows[0]) : null;
}

export async function getAllClans(db: Db): Promise<Clan[]> {
  const rows = await db.select().from(clans);
  return rows.map(rowToClan);
}

export async function getClanCount(db: Db): Promise<number> {
  const rows = await db.select({ count: sql<number>`count(*)::int` }).from(clans);
  return rows[0]?.count ?? 0;
}

export async function insertClan(db: Db, clan: Clan): Promise<void> {
  await db.insert(clans).values({
    id: clan.id,
    name: clan.name,
    tag: clan.tag,
    leaderId: clan.leaderId,
    memberIds: clan.memberIds,
    treasuryRawWood: clan.treasury.raw?.wood ?? 0,
    treasuryRawStone: clan.treasury.raw?.stone ?? 0,
    treasuryRawWater: clan.treasury.raw?.water ?? 0,
    treasuryRawFood: clan.treasury.raw?.food ?? 0,
    treasuryRawClay: clan.treasury.raw?.clay ?? 0,
    treasuryRefinedPlanks: clan.treasury.refined?.planks ?? 0,
    treasuryRefinedBricks: clan.treasury.refined?.bricks ?? 0,
    treasuryRefinedCement: clan.treasury.refined?.cement ?? 0,
    treasuryRefinedGlass: clan.treasury.refined?.glass ?? 0,
    treasuryRefinedSteel: clan.treasury.refined?.steel ?? 0,
    treasuryTokens: clan.treasury.tokens,
    createdAt: clan.createdAt,
    description: clan.description,
  });
}

export async function updateClan(
  db: Db,
  id: string,
  data: Partial<{
    name: string;
    tag: string;
    leaderId: string;
    memberIds: string[];
    treasuryRawWood: number;
    treasuryRawStone: number;
    treasuryRawWater: number;
    treasuryRawFood: number;
    treasuryRawClay: number;
    treasuryRefinedPlanks: number;
    treasuryRefinedBricks: number;
    treasuryRefinedCement: number;
    treasuryRefinedGlass: number;
    treasuryRefinedSteel: number;
    treasuryTokens: number;
    description: string;
  }>
): Promise<void> {
  await db.update(clans).set(data).where(eq(clans.id, id));
}

export async function deleteClan(db: Db, id: string): Promise<void> {
  await db.delete(clans).where(eq(clans.id, id));
}

// ======================= TRADE QUERIES =======================

export async function getTradeById(db: Db, id: string): Promise<Trade | null> {
  const rows = await db.select().from(trades).where(eq(trades.id, id)).limit(1);
  return rows[0] ? rowToTrade(rows[0]) : null;
}

export async function getOpenTrades(db: Db): Promise<Trade[]> {
  const rows = await db.select().from(trades).where(eq(trades.status, "open"));
  return rows.map(rowToTrade);
}

export async function getOpenTradeCount(db: Db): Promise<number> {
  const rows = await db.select({ count: sql<number>`count(*)::int` }).from(trades).where(eq(trades.status, "open"));
  return rows[0]?.count ?? 0;
}

export async function getExpiredOpenTrades(db: Db, expiryTimestamp: number): Promise<Trade[]> {
  const rows = await db
    .select()
    .from(trades)
    .where(and(eq(trades.status, "open"), lt(trades.createdAt, expiryTimestamp)));
  return rows.map(rowToTrade);
}

export async function insertTrade(db: Db, trade: Trade): Promise<void> {
  await db.insert(trades).values({
    id: trade.id,
    sellerId: trade.sellerId,
    sellerName: trade.sellerName,
    buyerId: trade.buyerId,
    offeringRawWood: trade.offering.raw?.wood ?? 0,
    offeringRawStone: trade.offering.raw?.stone ?? 0,
    offeringRawWater: trade.offering.raw?.water ?? 0,
    offeringRawFood: trade.offering.raw?.food ?? 0,
    offeringRawClay: trade.offering.raw?.clay ?? 0,
    offeringRefinedPlanks: trade.offering.refined?.planks ?? 0,
    offeringRefinedBricks: trade.offering.refined?.bricks ?? 0,
    offeringRefinedCement: trade.offering.refined?.cement ?? 0,
    offeringRefinedGlass: trade.offering.refined?.glass ?? 0,
    offeringRefinedSteel: trade.offering.refined?.steel ?? 0,
    offeringTokens: trade.offering.tokens ?? 0,
    requestingRawWood: trade.requesting.raw?.wood ?? 0,
    requestingRawStone: trade.requesting.raw?.stone ?? 0,
    requestingRawWater: trade.requesting.raw?.water ?? 0,
    requestingRawFood: trade.requesting.raw?.food ?? 0,
    requestingRawClay: trade.requesting.raw?.clay ?? 0,
    requestingRefinedPlanks: trade.requesting.refined?.planks ?? 0,
    requestingRefinedBricks: trade.requesting.refined?.bricks ?? 0,
    requestingRefinedCement: trade.requesting.refined?.cement ?? 0,
    requestingRefinedGlass: trade.requesting.refined?.glass ?? 0,
    requestingRefinedSteel: trade.requesting.refined?.steel ?? 0,
    requestingTokens: trade.requesting.tokens ?? 0,
    status: trade.status,
    createdAt: trade.createdAt,
    resolvedAt: trade.resolvedAt,
  });
}

export async function updateTrade(
  db: Db,
  id: string,
  data: Partial<{
    buyerId: string | null;
    status: string;
    resolvedAt: number | null;
  }>
): Promise<void> {
  await db.update(trades).set(data).where(eq(trades.id, id));
}

// ======================= PROPOSAL QUERIES =======================

export async function getProposalById(db: Db, id: string): Promise<Proposal | null> {
  const rows = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
  return rows[0] ? rowToProposal(rows[0]) : null;
}

export async function getActiveProposals(db: Db): Promise<Proposal[]> {
  const rows = await db.select().from(proposals).where(eq(proposals.status, "active"));
  return rows.map(rowToProposal);
}

export async function getActiveProposalCount(db: Db): Promise<number> {
  const rows = await db.select({ count: sql<number>`count(*)::int` }).from(proposals).where(eq(proposals.status, "active"));
  return rows[0]?.count ?? 0;
}

export async function getProposalsByProposer(db: Db, proposerId: string, status?: string): Promise<Proposal[]> {
  const conditions = [eq(proposals.proposerId, proposerId)];
  if (status) conditions.push(eq(proposals.status, status));
  const rows = await db.select().from(proposals).where(and(...conditions));
  return rows.map(rowToProposal);
}

export async function getAllProposalsSorted(db: Db): Promise<Proposal[]> {
  const rows = await db.select().from(proposals).orderBy(desc(proposals.createdAt));
  return rows.map(rowToProposal);
}

export async function getExpiredActiveProposals(db: Db, now: number): Promise<Proposal[]> {
  const rows = await db
    .select()
    .from(proposals)
    .where(and(eq(proposals.status, "active"), lt(proposals.expiresAt, now)));
  return rows.map(rowToProposal);
}

export async function insertProposal(db: Db, proposal: Proposal): Promise<void> {
  await db.insert(proposals).values({
    id: proposal.id,
    type: proposal.type,
    title: proposal.title,
    description: proposal.description,
    proposerId: proposal.proposerId,
    proposerName: proposal.proposerName,
    votes: proposal.votes,
    createdAt: proposal.createdAt,
    expiresAt: proposal.expiresAt,
    status: proposal.status,
    result: proposal.result ?? null,
  });
}

export async function updateProposal(
  db: Db,
  id: string,
  data: Partial<{
    votes: Record<string, string>;
    status: string;
    result: string | null;
  }>
): Promise<void> {
  await db.update(proposals).set(data).where(eq(proposals.id, id));
}

// ======================= CHAT QUERIES =======================

export async function getChatByChannel(db: Db, channel: string, limit: number = 50): Promise<ChatMessage[]> {
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.channel, channel))
    .orderBy(desc(chatMessages.timestamp))
    .limit(limit);
  return rows.reverse().map(rowToChatMessage);
}

export async function getClanChat(db: Db, clanId: string, limit: number = 50): Promise<ChatMessage[]> {
  const rows = await db
    .select()
    .from(chatMessages)
    .where(and(eq(chatMessages.channel, "clan"), eq(chatMessages.clanId, clanId)))
    .orderBy(desc(chatMessages.timestamp))
    .limit(limit);
  return rows.reverse().map(rowToChatMessage);
}

export async function getDMChat(db: Db, agentId: string, recipientId: string, limit: number = 50): Promise<ChatMessage[]> {
  const rows = await db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.channel, "dm"),
        or(
          and(eq(chatMessages.senderId, agentId), eq(chatMessages.recipientId, recipientId)),
          and(eq(chatMessages.senderId, recipientId), eq(chatMessages.recipientId, agentId))
        )
      )
    )
    .orderBy(desc(chatMessages.timestamp))
    .limit(limit);
  return rows.reverse().map(rowToChatMessage);
}

export async function getRecentChat(db: Db, limit: number = 50): Promise<ChatMessage[]> {
  const rows = await db
    .select()
    .from(chatMessages)
    .orderBy(desc(chatMessages.timestamp))
    .limit(limit);
  return rows.reverse().map(rowToChatMessage);
}

export async function insertChatMessage(db: Db, msg: ChatMessage): Promise<void> {
  await db.insert(chatMessages).values({
    id: msg.id,
    channel: msg.channel,
    senderId: msg.senderId,
    senderName: msg.senderName,
    recipientId: msg.recipientId ?? null,
    clanId: msg.clanId ?? null,
    content: msg.content,
    timestamp: msg.timestamp,
  });
}

// ======================= NOTIFICATION QUERIES =======================

export async function getUnreadNotifications(db: Db, agentId: string): Promise<Notification[]> {
  const rows = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.agentId, agentId), eq(notifications.read, false)))
    .orderBy(desc(notifications.timestamp));
  return rows.map(rowToNotification);
}

export async function markNotificationsRead(db: Db, agentId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.agentId, agentId), eq(notifications.read, false)));
}

export async function insertNotification(
  db: Db,
  agentId: string,
  type: string,
  message: string
): Promise<void> {
  await db.insert(notifications).values({
    id: crypto.randomUUID(),
    agentId,
    type,
    message,
    timestamp: Date.now(),
    read: false,
  });

  // Cap notifications per agent at 50
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(eq(notifications.agentId, agentId));
  const count = countResult[0]?.count ?? 0;

  if (count > 50) {
    const toDelete = count - 50;
    const oldest = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(eq(notifications.agentId, agentId))
      .orderBy(notifications.timestamp)
      .limit(toDelete);
    for (const row of oldest) {
      await db.delete(notifications).where(eq(notifications.id, row.id));
    }
  }
}

// ======================= ACTIVITY QUERIES =======================

export async function getRecentActivity(db: Db, limit: number = 100): Promise<ActivityEntry[]> {
  const rows = await db
    .select()
    .from(activity)
    .orderBy(desc(activity.timestamp))
    .limit(limit);
  return rows.reverse().map(rowToActivity);
}

export async function insertActivity(
  db: Db,
  type: string,
  agentId: string,
  agentName: string,
  description: string
): Promise<void> {
  await db.insert(activity).values({
    id: crypto.randomUUID(),
    type,
    agentId,
    agentName,
    description,
    timestamp: Date.now(),
  });

  // Cap activity at 100 entries
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activity);
  const count = countResult[0]?.count ?? 0;

  if (count > 100) {
    const toDelete = count - 100;
    const oldest = await db
      .select({ id: activity.id })
      .from(activity)
      .orderBy(activity.timestamp)
      .limit(toDelete);
    for (const row of oldest) {
      await db.delete(activity).where(eq(activity.id, row.id));
    }
  }
}

// ======================= RESOURCE NODE QUERIES =======================

export async function getResourceNodesInRadius(
  db: Db,
  cx: number,
  cy: number,
  radius: number
): Promise<Array<typeof resourceNodes.$inferSelect>> {
  const rows = await db
    .select()
    .from(resourceNodes)
    .where(
      and(
        gte(resourceNodes.x, cx - radius),
        lte(resourceNodes.x, cx + radius),
        gte(resourceNodes.y, cy - radius),
        lte(resourceNodes.y, cy + radius)
      )
    );
  return rows;
}

export async function depleteResourceNode(
  db: Db,
  id: string,
  amountHarvested: number,
  depletedAtTimestamp: number | null
): Promise<void> {
  const sets: Record<string, unknown> = {
    currentAmount: sql`GREATEST(${resourceNodes.currentAmount} - ${amountHarvested}, 0)`,
  };
  if (depletedAtTimestamp !== null) {
    sets.depletedAt = depletedAtTimestamp;
  }
  await db.update(resourceNodes).set(sets).where(eq(resourceNodes.id, id));
}

export async function respawnResourceNodes(db: Db, currentTick: number): Promise<void> {
  // Find all depleted nodes whose respawn time has elapsed and restore them
  // depletedAt is a timestamp; we compare tick-based threshold from the caller
  // Here we restore currentAmount to maxAmount for nodes that have been depleted
  // long enough (depletedAt + respawnTicks <= currentTick).
  // Since depletedAt is stored as a bigint timestamp but respawnTicks is a tick count,
  // the caller should pass the appropriate currentTick threshold.
  await db
    .update(resourceNodes)
    .set({
      currentAmount: sql`${resourceNodes.maxAmount}`,
      depletedAt: null,
    })
    .where(
      and(
        sql`${resourceNodes.depletedAt} IS NOT NULL`,
        sql`${resourceNodes.depletedAt} + ${resourceNodes.respawnTicks} <= ${currentTick}`
      )
    );
}

export async function insertResourceNode(
  db: Db,
  node: {
    id: string;
    x: number;
    y: number;
    type: string;
    maxAmount: number;
    currentAmount: number;
    respawnTicks: number;
    depletedAt: number | null;
  }
): Promise<void> {
  await db.insert(resourceNodes).values({
    id: node.id,
    x: node.x,
    y: node.y,
    type: node.type,
    maxAmount: node.maxAmount,
    currentAmount: node.currentAmount,
    respawnTicks: node.respawnTicks,
    depletedAt: node.depletedAt,
  });
}

export async function getAllResourceNodes(db: Db): Promise<Array<typeof resourceNodes.$inferSelect>> {
  return await db.select().from(resourceNodes);
}

// ======================= WORLD EVENT QUERIES =======================

export async function insertWorldEvent(db: Db, event: WorldEvent): Promise<void> {
  await db.insert(worldEvents).values({
    id: event.id,
    type: event.type,
    description: event.description,
    startTick: event.startTick,
    endTick: event.endTick,
    effects: event.effects,
  });
}

export async function getActiveWorldEvents(db: Db, currentTick: number): Promise<WorldEvent[]> {
  const rows = await db
    .select()
    .from(worldEvents)
    .where(
      and(
        lte(worldEvents.startTick, currentTick),
        gte(worldEvents.endTick, currentTick)
      )
    );
  return rows.map(rowToWorldEvent);
}

export async function getAllWorldEvents(db: Db): Promise<WorldEvent[]> {
  const rows = await db.select().from(worldEvents).orderBy(desc(worldEvents.startTick));
  return rows.map(rowToWorldEvent);
}

// ======================= MILESTONE QUERIES =======================

export async function checkMilestones(db: Db, type: string): Promise<VictoryMilestone | null> {
  const rows = await db
    .select()
    .from(milestones)
    .where(eq(milestones.type, type))
    .limit(1);
  return rows[0] ? rowToMilestone(rows[0]) : null;
}

export async function insertMilestone(db: Db, milestone: VictoryMilestone): Promise<void> {
  await db.insert(milestones).values({
    id: milestone.id,
    type: milestone.type,
    achievedAt: milestone.achievedAt,
    achievedByAgentId: milestone.achievedByAgentId,
  });
}

export async function getAllMilestones(db: Db): Promise<VictoryMilestone[]> {
  const rows = await db.select().from(milestones);
  return rows.map(rowToMilestone);
}

// ======================= PUBLIC TREASURY (via gameMeta) =======================

export async function getPublicTreasury(db: Db): Promise<number> {
  const value = await getMetaValue(db, "publicTreasury");
  return value !== null ? parseFloat(value) : 0;
}

export async function updatePublicTreasury(db: Db, amount: number): Promise<void> {
  await setMetaValue(db, "publicTreasury", String(amount));
}

// ======================= META QUERIES =======================

export async function getMetaValue(db: Db, key: string): Promise<string | null> {
  const rows = await db.select().from(gameMeta).where(eq(gameMeta.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function setMetaValue(db: Db, key: string, value: string): Promise<void> {
  await db
    .insert(gameMeta)
    .values({ key, value })
    .onConflictDoUpdate({ target: gameMeta.key, set: { value } });
}

export async function getTickInfo(db: Db): Promise<{ tick: number; lastTick: number; createdAt: number }> {
  const rows = await db.select().from(gameMeta);
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return {
    tick: parseInt(map.tick || "0", 10),
    lastTick: parseInt(map.lastTick || String(Date.now()), 10),
    createdAt: parseInt(map.createdAt || String(Date.now()), 10),
  };
}

export async function incrementTick(db: Db, lastTick: number): Promise<void> {
  await db
    .update(gameMeta)
    .set({ value: sql`(${gameMeta.value}::int + 1)::text` })
    .where(eq(gameMeta.key, "tick"));
  await setMetaValue(db, "lastTick", String(lastTick));
}
