import { eq, and, lt, sql } from "drizzle-orm";
import type { Db } from "./client";
import {
  agents,
  buildings,
  plots,
  trades,
  notifications,
} from "./schema";
import type {
  Agent,
  Building,
  Trade,
  Resources,
  ResourceType,
} from "../../src/shared/types";
import {
  insertNotification,
  insertActivity,
  updateAgent,
  updateTrade,
  updateBuilding,
} from "./queries";
import { PRESTIGE } from "../../src/shared/constants";

/**
 * Accepts a trade: swap resources between seller and buyer atomically.
 * Deducts requesting from buyer, adds to seller. Adds offering to buyer.
 * Updates trade status, awards prestige, sends notifications.
 */
export async function acceptTrade(
  db: Db,
  trade: Trade,
  buyer: Agent,
  seller: Agent
): Promise<void> {
  const reqWood = trade.requesting.wood ?? 0;
  const reqStone = trade.requesting.stone ?? 0;
  const reqFood = trade.requesting.food ?? 0;
  const reqGold = trade.requesting.gold ?? 0;
  const offWood = trade.offering.wood ?? 0;
  const offStone = trade.offering.stone ?? 0;
  const offFood = trade.offering.food ?? 0;
  const offGold = trade.offering.gold ?? 0;

  // Deduct requesting from buyer, add offering
  await db
    .update(agents)
    .set({
      resourceWood: sql`${agents.resourceWood} - ${reqWood} + ${offWood}`,
      resourceStone: sql`${agents.resourceStone} - ${reqStone} + ${offStone}`,
      resourceFood: sql`${agents.resourceFood} - ${reqFood} + ${offFood}`,
      resourceGold: sql`${agents.resourceGold} - ${reqGold} + ${offGold}`,
      prestige: sql`${agents.prestige} + ${PRESTIGE.TRADE}`,
    })
    .where(eq(agents.id, buyer.id));

  // Add requesting to seller
  await db
    .update(agents)
    .set({
      resourceWood: sql`${agents.resourceWood} + ${reqWood}`,
      resourceStone: sql`${agents.resourceStone} + ${reqStone}`,
      resourceFood: sql`${agents.resourceFood} + ${reqFood}`,
      resourceGold: sql`${agents.resourceGold} + ${reqGold}`,
      prestige: sql`${agents.prestige} + ${PRESTIGE.TRADE}`,
    })
    .where(eq(agents.id, seller.id));

  // Update trade status
  await updateTrade(db, trade.id, {
    status: "accepted",
    buyerId: buyer.id,
    resolvedAt: Date.now(),
  });

  await insertNotification(
    db,
    seller.id,
    "trade_accepted",
    `${buyer.name} accepted your trade offer`
  );

  await insertActivity(
    db,
    "trade_accepted",
    buyer.id,
    buyer.name,
    `${buyer.name} accepted a trade from ${seller.name}`
  );
}

/**
 * Places a building: deduct resources, insert building, update agent counts/prestige.
 */
export async function placeBuilding(
  db: Db,
  building: Building,
  agent: Agent,
  cost: Resources
): Promise<void> {
  // Deduct resources from agent
  await db
    .update(agents)
    .set({
      resourceWood: sql`${agents.resourceWood} - ${cost.wood}`,
      resourceStone: sql`${agents.resourceStone} - ${cost.stone}`,
      resourceFood: sql`${agents.resourceFood} - ${cost.food}`,
      resourceGold: sql`${agents.resourceGold} - ${cost.gold}`,
      buildingCount: sql`${agents.buildingCount} + 1`,
      prestige: sql`${agents.prestige} + ${PRESTIGE.BUILD}`,
    })
    .where(eq(agents.id, agent.id));

  // Insert building
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

  await insertActivity(
    db,
    "building_placed",
    agent.id,
    agent.name,
    `${agent.name} started building a ${building.type} at (${building.x}, ${building.y})`
  );
}

/**
 * Transfers a plot and its buildings from one agent to another.
 */
export async function transferPlot(
  db: Db,
  plotId: string,
  sender: Agent,
  recipient: Agent,
  buildingsOnPlot: Building[]
): Promise<void> {
  // Transfer plot ownership
  await db.update(plots).set({ ownerId: recipient.id }).where(eq(plots.id, plotId));

  // Transfer buildings
  const buildingCount = buildingsOnPlot.length;
  if (buildingCount > 0) {
    await db
      .update(buildings)
      .set({ ownerId: recipient.id })
      .where(eq(buildings.plotId, plotId));
  }

  // Update sender counts
  await db
    .update(agents)
    .set({
      plotCount: sql`${agents.plotCount} - 1`,
      buildingCount: sql`${agents.buildingCount} - ${buildingCount}`,
    })
    .where(eq(agents.id, sender.id));

  // Update recipient counts
  await db
    .update(agents)
    .set({
      plotCount: sql`${agents.plotCount} + 1`,
      buildingCount: sql`${agents.buildingCount} + ${buildingCount}`,
    })
    .where(eq(agents.id, recipient.id));

  await insertNotification(
    db,
    recipient.id,
    "plot_transferred",
    `${sender.name} transferred a plot to you`
  );

  await insertActivity(
    db,
    "plot_transferred",
    sender.id,
    sender.name,
    `${sender.name} transferred a plot to ${recipient.name}`
  );
}

/**
 * Expires old open trades and refunds resources to sellers.
 */
export async function expireTradesAndRefund(
  db: Db,
  expiredTrades: Trade[]
): Promise<void> {
  const now = Date.now();
  for (const trade of expiredTrades) {
    // Refund offering to seller
    const offWood = trade.offering.wood ?? 0;
    const offStone = trade.offering.stone ?? 0;
    const offFood = trade.offering.food ?? 0;
    const offGold = trade.offering.gold ?? 0;

    await db
      .update(agents)
      .set({
        resourceWood: sql`${agents.resourceWood} + ${offWood}`,
        resourceStone: sql`${agents.resourceStone} + ${offStone}`,
        resourceFood: sql`${agents.resourceFood} + ${offFood}`,
        resourceGold: sql`${agents.resourceGold} + ${offGold}`,
      })
      .where(eq(agents.id, trade.sellerId));

    await updateTrade(db, trade.id, {
      status: "expired",
      resolvedAt: now,
    });

    await insertNotification(
      db,
      trade.sellerId,
      "trade_expired",
      "One of your trade offers has expired. Resources refunded."
    );
  }
}

/**
 * Collects pending resources from all agent's completed buildings.
 * Transfers floored amounts to agent, keeps fractional remainders.
 */
export async function collectResources(
  db: Db,
  agent: Agent,
  agentBuildings: Building[]
): Promise<{ collected: Resources; buildingsCollected: number }> {
  const now = Date.now();
  const collected: Resources = { wood: 0, stone: 0, food: 0, gold: 0 };
  let buildingsCollected = 0;

  for (const building of agentBuildings) {
    if (!building.completed) continue;

    const hasPending =
      building.pendingResources.wood > 0 ||
      building.pendingResources.stone > 0 ||
      building.pendingResources.food > 0 ||
      building.pendingResources.gold > 0;

    if (!hasPending) continue;

    const woodCollected = Math.floor(building.pendingResources.wood);
    const stoneCollected = Math.floor(building.pendingResources.stone);
    const foodCollected = Math.floor(building.pendingResources.food);
    const goldCollected = Math.floor(building.pendingResources.gold);

    collected.wood += woodCollected;
    collected.stone += stoneCollected;
    collected.food += foodCollected;
    collected.gold += goldCollected;

    // Reset pending (keep fractional remainder)
    await updateBuilding(db, building.id, {
      pendingResourceWood: building.pendingResources.wood - woodCollected,
      pendingResourceStone: building.pendingResources.stone - stoneCollected,
      pendingResourceFood: building.pendingResources.food - foodCollected,
      pendingResourceGold: building.pendingResources.gold - goldCollected,
      lastCollection: now,
    });

    buildingsCollected++;
  }

  // Add collected to agent
  if (buildingsCollected > 0) {
    await db
      .update(agents)
      .set({
        resourceWood: sql`${agents.resourceWood} + ${collected.wood}`,
        resourceStone: sql`${agents.resourceStone} + ${collected.stone}`,
        resourceFood: sql`${agents.resourceFood} + ${collected.food}`,
        resourceGold: sql`${agents.resourceGold} + ${collected.gold}`,
      })
      .where(eq(agents.id, agent.id));
  }

  return { collected, buildingsCollected };
}
