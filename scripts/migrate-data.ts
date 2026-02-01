/**
 * One-time migration script: loads existing PartyKit JSON blob
 * and inserts all rows into the PostgreSQL database.
 *
 * Usage:
 *   npx tsx scripts/migrate-data.ts <path-to-gamestate.json>
 *
 * The JSON file should be the serialized GameState object from
 * PartyKit Room Storage (key: "gameState").
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../party/db/schema";
import type { GameState } from "../src/shared/types";
import * as fs from "node:fs";

async function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error("Usage: npx tsx scripts/migrate-data.ts <path-to-gamestate.json>");
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL environment variable is required");
    process.exit(1);
  }

  console.log("Reading game state from:", jsonPath);
  const raw = fs.readFileSync(jsonPath, "utf-8");
  const state: GameState = JSON.parse(raw);

  const sql = neon(dbUrl);
  const db = drizzle(sql, { schema });

  // 1. Insert game meta
  console.log("Inserting game_meta...");
  await db.insert(schema.gameMeta).values([
    { key: "tick", value: String(state.tick) },
    { key: "lastTick", value: String(state.lastTick) },
    { key: "createdAt", value: String(state.createdAt) },
  ]).onConflictDoNothing();

  // 2. Insert agents
  const agentEntries = Object.values(state.agents);
  console.log(`Inserting ${agentEntries.length} agents...`);
  for (const agent of agentEntries) {
    await db.insert(schema.agents).values({
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
    }).onConflictDoNothing();
  }

  // 3. Insert plots
  const plotEntries = Object.values(state.plots);
  console.log(`Inserting ${plotEntries.length} plots...`);
  for (const plot of plotEntries) {
    await db.insert(schema.plots).values({
      id: plot.id,
      ownerId: plot.ownerId,
      x: plot.x,
      y: plot.y,
      width: plot.width,
      height: plot.height,
      claimedAt: plot.claimedAt,
    }).onConflictDoNothing();
  }

  // 4. Insert buildings
  const buildingEntries = Object.values(state.buildings);
  console.log(`Inserting ${buildingEntries.length} buildings...`);
  for (const building of buildingEntries) {
    await db.insert(schema.buildings).values({
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
    }).onConflictDoNothing();
  }

  // 5. Insert clans
  const clanEntries = Object.values(state.clans);
  console.log(`Inserting ${clanEntries.length} clans...`);
  for (const clan of clanEntries) {
    await db.insert(schema.clans).values({
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
    }).onConflictDoNothing();
  }

  // 6. Insert trades
  const tradeEntries = Object.values(state.trades);
  console.log(`Inserting ${tradeEntries.length} trades...`);
  for (const trade of tradeEntries) {
    await db.insert(schema.trades).values({
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
    }).onConflictDoNothing();
  }

  // 7. Insert proposals
  const proposalEntries = Object.values(state.proposals);
  console.log(`Inserting ${proposalEntries.length} proposals...`);
  for (const proposal of proposalEntries) {
    await db.insert(schema.proposals).values({
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
    }).onConflictDoNothing();
  }

  // 8. Insert chat messages
  console.log(`Inserting ${state.chat.length} chat messages...`);
  for (const msg of state.chat) {
    await db.insert(schema.chatMessages).values({
      id: msg.id,
      channel: msg.channel,
      senderId: msg.senderId,
      senderName: msg.senderName,
      recipientId: msg.recipientId ?? null,
      clanId: msg.clanId ?? null,
      content: msg.content,
      timestamp: msg.timestamp,
    }).onConflictDoNothing();
  }

  // 9. Insert activity
  console.log(`Inserting ${state.activity.length} activity entries...`);
  for (const entry of state.activity) {
    await db.insert(schema.activity).values({
      id: entry.id,
      type: entry.type,
      agentId: entry.agentId,
      agentName: entry.agentName,
      description: entry.description,
      timestamp: entry.timestamp,
    }).onConflictDoNothing();
  }

  // 10. Insert notifications
  let notificationCount = 0;
  for (const [agentId, notifs] of Object.entries(state.notifications)) {
    for (const n of notifs) {
      await db.insert(schema.notifications).values({
        id: n.id,
        agentId: n.agentId,
        type: n.type,
        message: n.message,
        timestamp: n.timestamp,
        read: n.read,
      }).onConflictDoNothing();
      notificationCount++;
    }
  }
  console.log(`Inserted ${notificationCount} notifications`);

  console.log("\nMigration complete!");
  console.log(`  Agents: ${agentEntries.length}`);
  console.log(`  Plots: ${plotEntries.length}`);
  console.log(`  Buildings: ${buildingEntries.length}`);
  console.log(`  Clans: ${clanEntries.length}`);
  console.log(`  Trades: ${tradeEntries.length}`);
  console.log(`  Proposals: ${proposalEntries.length}`);
  console.log(`  Chat: ${state.chat.length}`);
  console.log(`  Activity: ${state.activity.length}`);
  console.log(`  Notifications: ${notificationCount}`);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
