import { eq, and, desc, sql, lt, lte, or } from "drizzle-orm";
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
  Resources,
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
    resources: {
      wood: row.resourceWood,
      stone: row.resourceStone,
      food: row.resourceFood,
      gold: row.resourceGold,
    },
    prestige: row.prestige,
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
    pendingResources: {
      wood: row.pendingResourceWood,
      stone: row.pendingResourceStone,
      food: row.pendingResourceFood,
      gold: row.pendingResourceGold,
    },
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
      wood: row.treasuryWood,
      stone: row.treasuryStone,
      food: row.treasuryFood,
      gold: row.treasuryGold,
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
      wood: row.offeringWood,
      stone: row.offeringStone,
      food: row.offeringFood,
      gold: row.offeringGold,
    },
    requesting: {
      wood: row.requestingWood,
      stone: row.requestingStone,
      food: row.requestingFood,
      gold: row.requestingGold,
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
    resourceWood: agent.resources.wood,
    resourceStone: agent.resources.stone,
    resourceFood: agent.resources.food,
    resourceGold: agent.resources.gold,
    prestige: agent.prestige,
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
    resourceWood: number;
    resourceStone: number;
    resourceFood: number;
    resourceGold: number;
    prestige: number;
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
  deltas: Partial<Resources>
): Promise<void> {
  const sets: Record<string, unknown> = {};
  if (deltas.wood !== undefined) sets.resourceWood = sql`${agents.resourceWood} + ${deltas.wood}`;
  if (deltas.stone !== undefined) sets.resourceStone = sql`${agents.resourceStone} + ${deltas.stone}`;
  if (deltas.food !== undefined) sets.resourceFood = sql`${agents.resourceFood} + ${deltas.food}`;
  if (deltas.gold !== undefined) sets.resourceGold = sql`${agents.resourceGold} + ${deltas.gold}`;
  if (Object.keys(sets).length > 0) {
    await db.update(agents).set(sets).where(eq(agents.id, id));
  }
}

export async function getLeaderboard(db: Db, limit: number = 50): Promise<Agent[]> {
  const rows = await db.select().from(agents).orderBy(desc(agents.prestige)).limit(limit);
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
    pendingResourceWood: building.pendingResources.wood,
    pendingResourceStone: building.pendingResources.stone,
    pendingResourceFood: building.pendingResources.food,
    pendingResourceGold: building.pendingResources.gold,
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
    level: number;
    progress: number;
    completed: boolean;
    completedAt: number | null;
    pendingResourceWood: number;
    pendingResourceStone: number;
    pendingResourceFood: number;
    pendingResourceGold: number;
    lastCollection: number;
    inscription: string | null;
    contributors: Record<string, { wood: number; stone: number; food: number; gold: number }> | null;
  }>
): Promise<void> {
  await db.update(buildings).set(data).where(eq(buildings.id, id));
}

export async function deleteBuilding(db: Db, id: string): Promise<void> {
  await db.delete(buildings).where(eq(buildings.id, id));
}

export async function bulkUpdateBuildingPendingResources(
  db: Db,
  updates: Array<{ id: string; wood: number; stone: number; food: number; gold: number }>
): Promise<void> {
  // Use individual updates batched together since Neon HTTP doesn't support multi-statement
  for (const u of updates) {
    await db
      .update(buildings)
      .set({
        pendingResourceWood: sql`${buildings.pendingResourceWood} + ${u.wood}`,
        pendingResourceStone: sql`${buildings.pendingResourceStone} + ${u.stone}`,
        pendingResourceFood: sql`${buildings.pendingResourceFood} + ${u.food}`,
        pendingResourceGold: sql`${buildings.pendingResourceGold} + ${u.gold}`,
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
    treasuryWood: clan.treasury.wood,
    treasuryStone: clan.treasury.stone,
    treasuryFood: clan.treasury.food,
    treasuryGold: clan.treasury.gold,
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
    treasuryWood: number;
    treasuryStone: number;
    treasuryFood: number;
    treasuryGold: number;
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
    offeringWood: trade.offering.wood ?? 0,
    offeringStone: trade.offering.stone ?? 0,
    offeringFood: trade.offering.food ?? 0,
    offeringGold: trade.offering.gold ?? 0,
    requestingWood: trade.requesting.wood ?? 0,
    requestingStone: trade.requesting.stone ?? 0,
    requestingFood: trade.requesting.food ?? 0,
    requestingGold: trade.requesting.gold ?? 0,
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
    // Delete oldest notifications beyond the cap
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
