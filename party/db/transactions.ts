import { eq, sql } from "drizzle-orm";
import type { Db } from "./client";
import {
  agents,
  buildings,
  plots,
  trades,
  resourceNodes,
  gameMeta,
} from "./schema";
import type {
  Agent,
  Building,
  Plot,
  Trade,
  BuildingCost,
  BuildingDefinition,
  RawResourceType,
  RefinedMaterialType,
  RefiningRecipe,
} from "../../src/shared/types";
import {
  insertNotification,
  insertActivity,
  updateAgent,
  updateTrade,
  updateBuilding,
  deleteBuilding,
  setMetaValue,
  getMetaValue,
} from "./queries";
import { PRESTIGE, TAX_RATE } from "../../src/shared/constants";

// ======================= HELPERS =======================

/** Mapping from TradeResources raw keys to agent schema columns */
const RAW_AGENT_COLS = {
  wood: "rawWood",
  stone: "rawStone",
  water: "rawWater",
  food: "rawFood",
  clay: "rawClay",
} as const;

/** Mapping from TradeResources refined keys to agent schema columns */
const REFINED_AGENT_COLS = {
  planks: "refinedPlanks",
  bricks: "refinedBricks",
  cement: "refinedCement",
  glass: "refinedGlass",
  steel: "refinedSteel",
} as const;

/** Mapping from trade offering raw keys to trade schema columns */
const OFFERING_RAW_COLS = {
  wood: "offeringRawWood",
  stone: "offeringRawStone",
  water: "offeringRawWater",
  food: "offeringRawFood",
  clay: "offeringRawClay",
} as const;

const OFFERING_REFINED_COLS = {
  planks: "offeringRefinedPlanks",
  bricks: "offeringRefinedBricks",
  cement: "offeringRefinedCement",
  glass: "offeringRefinedGlass",
  steel: "offeringRefinedSteel",
} as const;

const REQUESTING_RAW_COLS = {
  wood: "requestingRawWood",
  stone: "requestingRawStone",
  water: "requestingRawWater",
  food: "requestingRawFood",
  clay: "requestingRawClay",
} as const;

const REQUESTING_REFINED_COLS = {
  planks: "requestingRefinedPlanks",
  bricks: "requestingRefinedBricks",
  cement: "requestingRefinedCement",
  glass: "requestingRefinedGlass",
  steel: "requestingRefinedSteel",
} as const;

/** Pending resource column names on buildings schema */
const PENDING_RAW_COLS = {
  wood: "pendingRawWood",
  stone: "pendingRawStone",
  water: "pendingRawWater",
  food: "pendingRawFood",
  clay: "pendingRawClay",
} as const;

const PENDING_REFINED_COLS = {
  planks: "pendingRefinedPlanks",
  bricks: "pendingRefinedBricks",
  cement: "pendingRefinedCement",
  glass: "pendingRefinedGlass",
  steel: "pendingRefinedSteel",
} as const;

/** Map resource node type to the raw resource it yields */
const NODE_TO_RAW: Record<string, RawResourceType> = {
  tree: "wood",
  stone_deposit: "stone",
  clay_deposit: "clay",
  water_source: "water",
  fertile_soil: "food",
};

/** Total count of all raw + refined + token amounts in a trade offering/requesting */
function tradeResourceTotal(res: {
  raw: Partial<Record<RawResourceType, number>>;
  refined: Partial<Record<RefinedMaterialType, number>>;
  tokens: number;
}): number {
  let total = res.tokens ?? 0;
  for (const v of Object.values(res.raw)) total += v ?? 0;
  for (const v of Object.values(res.refined)) total += v ?? 0;
  return total;
}

// ======================= TRANSACTIONS =======================

/**
 * Accepts a trade: swap resources between seller and buyer atomically.
 * Deducts requesting from buyer, adds offering to buyer.
 * Adds requesting to seller (they already escrowed their offering).
 * Updates trade status, awards prestige, sends notifications.
 */
export async function acceptTrade(
  db: Db,
  trade: Trade,
  buyer: Agent,
  seller: Agent
): Promise<void> {
  // Extract offering amounts
  const offRawWood = trade.offering.raw.wood ?? 0;
  const offRawStone = trade.offering.raw.stone ?? 0;
  const offRawWater = trade.offering.raw.water ?? 0;
  const offRawFood = trade.offering.raw.food ?? 0;
  const offRawClay = trade.offering.raw.clay ?? 0;
  const offRefinedPlanks = trade.offering.refined.planks ?? 0;
  const offRefinedBricks = trade.offering.refined.bricks ?? 0;
  const offRefinedCement = trade.offering.refined.cement ?? 0;
  const offRefinedGlass = trade.offering.refined.glass ?? 0;
  const offRefinedSteel = trade.offering.refined.steel ?? 0;
  const offTokens = trade.offering.tokens ?? 0;

  // Extract requesting amounts
  const reqRawWood = trade.requesting.raw.wood ?? 0;
  const reqRawStone = trade.requesting.raw.stone ?? 0;
  const reqRawWater = trade.requesting.raw.water ?? 0;
  const reqRawFood = trade.requesting.raw.food ?? 0;
  const reqRawClay = trade.requesting.raw.clay ?? 0;
  const reqRefinedPlanks = trade.requesting.refined.planks ?? 0;
  const reqRefinedBricks = trade.requesting.refined.bricks ?? 0;
  const reqRefinedCement = trade.requesting.refined.cement ?? 0;
  const reqRefinedGlass = trade.requesting.refined.glass ?? 0;
  const reqRefinedSteel = trade.requesting.refined.steel ?? 0;
  const reqTokens = trade.requesting.tokens ?? 0;

  // Buyer: deduct requesting, add offering
  await db
    .update(agents)
    .set({
      rawWood: sql`${agents.rawWood} - ${reqRawWood} + ${offRawWood}`,
      rawStone: sql`${agents.rawStone} - ${reqRawStone} + ${offRawStone}`,
      rawWater: sql`${agents.rawWater} - ${reqRawWater} + ${offRawWater}`,
      rawFood: sql`${agents.rawFood} - ${reqRawFood} + ${offRawFood}`,
      rawClay: sql`${agents.rawClay} - ${reqRawClay} + ${offRawClay}`,
      refinedPlanks: sql`${agents.refinedPlanks} - ${reqRefinedPlanks} + ${offRefinedPlanks}`,
      refinedBricks: sql`${agents.refinedBricks} - ${reqRefinedBricks} + ${offRefinedBricks}`,
      refinedCement: sql`${agents.refinedCement} - ${reqRefinedCement} + ${offRefinedCement}`,
      refinedGlass: sql`${agents.refinedGlass} - ${reqRefinedGlass} + ${offRefinedGlass}`,
      refinedSteel: sql`${agents.refinedSteel} - ${reqRefinedSteel} + ${offRefinedSteel}`,
      tokens: sql`${agents.tokens} - ${reqTokens} + ${offTokens}`,
      reputation: sql`${agents.reputation} + ${PRESTIGE.TRADE}`,
    })
    .where(eq(agents.id, buyer.id));

  // Seller: add requesting (offering was already escrowed)
  await db
    .update(agents)
    .set({
      rawWood: sql`${agents.rawWood} + ${reqRawWood}`,
      rawStone: sql`${agents.rawStone} + ${reqRawStone}`,
      rawWater: sql`${agents.rawWater} + ${reqRawWater}`,
      rawFood: sql`${agents.rawFood} + ${reqRawFood}`,
      rawClay: sql`${agents.rawClay} + ${reqRawClay}`,
      refinedPlanks: sql`${agents.refinedPlanks} + ${reqRefinedPlanks}`,
      refinedBricks: sql`${agents.refinedBricks} + ${reqRefinedBricks}`,
      refinedCement: sql`${agents.refinedCement} + ${reqRefinedCement}`,
      refinedGlass: sql`${agents.refinedGlass} + ${reqRefinedGlass}`,
      refinedSteel: sql`${agents.refinedSteel} + ${reqRefinedSteel}`,
      tokens: sql`${agents.tokens} + ${reqTokens}`,
      reputation: sql`${agents.reputation} + ${PRESTIGE.TRADE}`,
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
 * Places a building: deduct building cost (raw + refined + tokens) from agent,
 * insert building row with all new columns, update agent counts/reputation.
 */
export async function placeBuilding(
  db: Db,
  building: Building,
  agent: Agent,
  cost: BuildingCost,
  def: BuildingDefinition
): Promise<void> {
  // Deduct cost from agent and update position
  const costRawWood = cost.raw.wood ?? 0;
  const costRawStone = cost.raw.stone ?? 0;
  const costRawWater = cost.raw.water ?? 0;
  const costRawFood = cost.raw.food ?? 0;
  const costRawClay = cost.raw.clay ?? 0;
  const costRefinedPlanks = cost.refined.planks ?? 0;
  const costRefinedBricks = cost.refined.bricks ?? 0;
  const costRefinedCement = cost.refined.cement ?? 0;
  const costRefinedGlass = cost.refined.glass ?? 0;
  const costRefinedSteel = cost.refined.steel ?? 0;
  const costTokens = cost.tokens ?? 0;

  await db
    .update(agents)
    .set({
      rawWood: sql`${agents.rawWood} - ${costRawWood}`,
      rawStone: sql`${agents.rawStone} - ${costRawStone}`,
      rawWater: sql`${agents.rawWater} - ${costRawWater}`,
      rawFood: sql`${agents.rawFood} - ${costRawFood}`,
      rawClay: sql`${agents.rawClay} - ${costRawClay}`,
      refinedPlanks: sql`${agents.refinedPlanks} - ${costRefinedPlanks}`,
      refinedBricks: sql`${agents.refinedBricks} - ${costRefinedBricks}`,
      refinedCement: sql`${agents.refinedCement} - ${costRefinedCement}`,
      refinedGlass: sql`${agents.refinedGlass} - ${costRefinedGlass}`,
      refinedSteel: sql`${agents.refinedSteel} - ${costRefinedSteel}`,
      tokens: sql`${agents.tokens} - ${costTokens}`,
      buildingCount: sql`${agents.buildingCount} + 1`,
      reputation: sql`${agents.reputation} + ${PRESTIGE.BUILD}`,
      x: building.x,
      y: building.y,
    })
    .where(eq(agents.id, agent.id));

  // Insert building with all new columns
  await db.insert(buildings).values({
    id: building.id,
    type: building.type,
    tier: def.tier,
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
    durability: def.durability,
    maxDurability: def.maxDurability,
    decayRate: def.decayRate,
    tokenIncome: def.tokenIncome,
    pendingRawWood: 0,
    pendingRawStone: 0,
    pendingRawWater: 0,
    pendingRawFood: 0,
    pendingRawClay: 0,
    pendingRefinedPlanks: 0,
    pendingRefinedBricks: 0,
    pendingRefinedCement: 0,
    pendingRefinedGlass: 0,
    pendingRefinedSteel: 0,
    pendingTokens: 0,
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
  plot: Plot,
  sender: Agent,
  recipient: Agent,
  buildingsOnPlot: Building[]
): Promise<void> {
  const tileCount = plot.width * plot.height;

  // Transfer plot ownership
  await db.update(plots).set({ ownerId: recipient.id }).where(eq(plots.id, plot.id));

  // Transfer buildings
  const buildingCount = buildingsOnPlot.length;
  if (buildingCount > 0) {
    await db
      .update(buildings)
      .set({ ownerId: recipient.id })
      .where(eq(buildings.plotId, plot.id));
  }

  // Update sender counts
  await db
    .update(agents)
    .set({
      plotCount: sql`${agents.plotCount} - ${tileCount}`,
      buildingCount: sql`${agents.buildingCount} - ${buildingCount}`,
    })
    .where(eq(agents.id, sender.id));

  // Update recipient counts
  await db
    .update(agents)
    .set({
      plotCount: sql`${agents.plotCount} + ${tileCount}`,
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
 * Expires old open trades and refunds all resource types to sellers.
 */
export async function expireTradesAndRefund(
  db: Db,
  expiredTrades: Trade[]
): Promise<void> {
  const now = Date.now();
  for (const trade of expiredTrades) {
    // Refund offering to seller
    const offRawWood = trade.offering.raw.wood ?? 0;
    const offRawStone = trade.offering.raw.stone ?? 0;
    const offRawWater = trade.offering.raw.water ?? 0;
    const offRawFood = trade.offering.raw.food ?? 0;
    const offRawClay = trade.offering.raw.clay ?? 0;
    const offRefinedPlanks = trade.offering.refined.planks ?? 0;
    const offRefinedBricks = trade.offering.refined.bricks ?? 0;
    const offRefinedCement = trade.offering.refined.cement ?? 0;
    const offRefinedGlass = trade.offering.refined.glass ?? 0;
    const offRefinedSteel = trade.offering.refined.steel ?? 0;
    const offTokens = trade.offering.tokens ?? 0;

    await db
      .update(agents)
      .set({
        rawWood: sql`${agents.rawWood} + ${offRawWood}`,
        rawStone: sql`${agents.rawStone} + ${offRawStone}`,
        rawWater: sql`${agents.rawWater} + ${offRawWater}`,
        rawFood: sql`${agents.rawFood} + ${offRawFood}`,
        rawClay: sql`${agents.rawClay} + ${offRawClay}`,
        refinedPlanks: sql`${agents.refinedPlanks} + ${offRefinedPlanks}`,
        refinedBricks: sql`${agents.refinedBricks} + ${offRefinedBricks}`,
        refinedCement: sql`${agents.refinedCement} + ${offRefinedCement}`,
        refinedGlass: sql`${agents.refinedGlass} + ${offRefinedGlass}`,
        refinedSteel: sql`${agents.refinedSteel} + ${offRefinedSteel}`,
        tokens: sql`${agents.tokens} + ${offTokens}`,
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
 * Collects all 11 pending resource types + pendingTokens from an agent's
 * completed buildings into the agent's inventory. Floors amounts and keeps
 * fractional remainders on the building.
 */
export async function collectResources(
  db: Db,
  agent: Agent,
  agentBuildings: Building[]
): Promise<{
  collectedRaw: Record<RawResourceType, number>;
  collectedRefined: Record<RefinedMaterialType, number>;
  collectedTokens: number;
  buildingsCollected: number;
}> {
  const now = Date.now();
  const collectedRaw: Record<RawResourceType, number> = { wood: 0, stone: 0, water: 0, food: 0, clay: 0 };
  const collectedRefined: Record<RefinedMaterialType, number> = { planks: 0, bricks: 0, cement: 0, glass: 0, steel: 0 };
  let collectedTokens = 0;
  let buildingsCollected = 0;

  for (const building of agentBuildings) {
    if (!building.completed) continue;

    const hasPending =
      building.pendingRawWood > 0 ||
      building.pendingRawStone > 0 ||
      building.pendingRawWater > 0 ||
      building.pendingRawFood > 0 ||
      building.pendingRawClay > 0 ||
      building.pendingRefinedPlanks > 0 ||
      building.pendingRefinedBricks > 0 ||
      building.pendingRefinedCement > 0 ||
      building.pendingRefinedGlass > 0 ||
      building.pendingRefinedSteel > 0 ||
      building.pendingTokens > 0;

    if (!hasPending) continue;

    // Floor each pending amount; keep fractional remainder
    const rawWoodCollected = Math.floor(building.pendingRawWood);
    const rawStoneCollected = Math.floor(building.pendingRawStone);
    const rawWaterCollected = Math.floor(building.pendingRawWater);
    const rawFoodCollected = Math.floor(building.pendingRawFood);
    const rawClayCollected = Math.floor(building.pendingRawClay);
    const refinedPlanksCollected = Math.floor(building.pendingRefinedPlanks);
    const refinedBricksCollected = Math.floor(building.pendingRefinedBricks);
    const refinedCementCollected = Math.floor(building.pendingRefinedCement);
    const refinedGlassCollected = Math.floor(building.pendingRefinedGlass);
    const refinedSteelCollected = Math.floor(building.pendingRefinedSteel);
    const tokensCollected = Math.floor(building.pendingTokens);

    collectedRaw.wood += rawWoodCollected;
    collectedRaw.stone += rawStoneCollected;
    collectedRaw.water += rawWaterCollected;
    collectedRaw.food += rawFoodCollected;
    collectedRaw.clay += rawClayCollected;
    collectedRefined.planks += refinedPlanksCollected;
    collectedRefined.bricks += refinedBricksCollected;
    collectedRefined.cement += refinedCementCollected;
    collectedRefined.glass += refinedGlassCollected;
    collectedRefined.steel += refinedSteelCollected;
    collectedTokens += tokensCollected;

    // Reset pending (keep fractional remainder)
    await updateBuilding(db, building.id, {
      pendingRawWood: building.pendingRawWood - rawWoodCollected,
      pendingRawStone: building.pendingRawStone - rawStoneCollected,
      pendingRawWater: building.pendingRawWater - rawWaterCollected,
      pendingRawFood: building.pendingRawFood - rawFoodCollected,
      pendingRawClay: building.pendingRawClay - rawClayCollected,
      pendingRefinedPlanks: building.pendingRefinedPlanks - refinedPlanksCollected,
      pendingRefinedBricks: building.pendingRefinedBricks - refinedBricksCollected,
      pendingRefinedCement: building.pendingRefinedCement - refinedCementCollected,
      pendingRefinedGlass: building.pendingRefinedGlass - refinedGlassCollected,
      pendingRefinedSteel: building.pendingRefinedSteel - refinedSteelCollected,
      pendingTokens: building.pendingTokens - tokensCollected,
      lastCollection: now,
    });

    buildingsCollected++;
  }

  // Add collected resources to agent
  if (buildingsCollected > 0) {
    await db
      .update(agents)
      .set({
        rawWood: sql`${agents.rawWood} + ${collectedRaw.wood}`,
        rawStone: sql`${agents.rawStone} + ${collectedRaw.stone}`,
        rawWater: sql`${agents.rawWater} + ${collectedRaw.water}`,
        rawFood: sql`${agents.rawFood} + ${collectedRaw.food}`,
        rawClay: sql`${agents.rawClay} + ${collectedRaw.clay}`,
        refinedPlanks: sql`${agents.refinedPlanks} + ${collectedRefined.planks}`,
        refinedBricks: sql`${agents.refinedBricks} + ${collectedRefined.bricks}`,
        refinedCement: sql`${agents.refinedCement} + ${collectedRefined.cement}`,
        refinedGlass: sql`${agents.refinedGlass} + ${collectedRefined.glass}`,
        refinedSteel: sql`${agents.refinedSteel} + ${collectedRefined.steel}`,
        tokens: sql`${agents.tokens} + ${collectedTokens}`,
      })
      .where(eq(agents.id, agent.id));
  }

  return { collectedRaw, collectedRefined, collectedTokens, buildingsCollected };
}

/**
 * Gathers a raw resource from a resource node into the agent's inventory.
 * Deducts from the resource node's currentAmount; adds to the agent's
 * corresponding raw resource column. Respects inventoryLimit.
 *
 * @param gatherType - The resource node type (e.g. "tree", "stone_deposit")
 * @param resourceAmount - How much to gather this action
 * @returns The actual amount gathered (may be clamped by node or inventory)
 */
export async function gatherResource(
  db: Db,
  agent: Agent,
  gatherType: string,
  resourceAmount: number
): Promise<{ gathered: number; resourceType: RawResourceType }> {
  const rawType = NODE_TO_RAW[gatherType];
  if (!rawType) {
    throw new Error(`Unknown gather type: ${gatherType}`);
  }

  // Look up the resource node at or near the agent
  const nodeRows = await db
    .select()
    .from(resourceNodes)
    .where(
      sql`${resourceNodes.type} = ${gatherType} AND ${resourceNodes.x} = ${agent.x} AND ${resourceNodes.y} = ${agent.y}`
    )
    .limit(1);

  if (nodeRows.length === 0) {
    throw new Error(`No ${gatherType} resource node at (${agent.x}, ${agent.y})`);
  }

  const node = nodeRows[0];
  if (node.currentAmount <= 0) {
    throw new Error(`Resource node ${gatherType} at (${agent.x}, ${agent.y}) is depleted`);
  }

  // Calculate current inventory total
  const inv = agent.inventory;
  const currentTotal =
    inv.raw.wood + inv.raw.stone + inv.raw.water + inv.raw.food + inv.raw.clay +
    inv.refined.planks + inv.refined.bricks + inv.refined.cement + inv.refined.glass + inv.refined.steel;

  const spaceLeft = Math.max(0, agent.inventoryLimit - currentTotal);
  if (spaceLeft <= 0) {
    throw new Error("Inventory is full");
  }

  // Clamp to available and space
  const actual = Math.min(resourceAmount, node.currentAmount, spaceLeft);

  // Deduct from resource node
  const newAmount = node.currentAmount - actual;
  const depleted = newAmount <= 0;
  await db
    .update(resourceNodes)
    .set({
      currentAmount: Math.max(0, newAmount),
      depletedAt: depleted ? Date.now() : node.depletedAt,
    })
    .where(eq(resourceNodes.id, node.id));

  // Add to agent raw inventory
  const agentCol = agents[RAW_AGENT_COLS[rawType]];
  await db
    .update(agents)
    .set({
      [RAW_AGENT_COLS[rawType]]: sql`${agentCol} + ${actual}`,
    })
    .where(eq(agents.id, agent.id));

  await insertActivity(
    db,
    "resource_gathered",
    agent.id,
    agent.name,
    `${agent.name} gathered ${actual} ${rawType} from ${gatherType}`
  );

  return { gathered: actual, resourceType: rawType };
}

/**
 * Refines raw resources into refined materials according to a recipe.
 * Deducts raw inputs from the agent, adds refined outputs.
 * If handCraftable, applies the handYieldMultiplier when no structure is present.
 *
 * @param recipe - The refining recipe to execute
 * @param hasStructure - Whether the agent has access to the required structure
 */
export async function refineResource(
  db: Db,
  agent: Agent,
  recipe: RefiningRecipe,
  hasStructure: boolean
): Promise<{ outputs: Partial<Record<RefinedMaterialType, number>> }> {
  // Verify agent has enough raw inputs
  const inputs = recipe.inputs;
  for (const [key, amount] of Object.entries(inputs)) {
    const rawKey = key as RawResourceType;
    const available = agent.inventory.raw[rawKey] ?? 0;
    if (available < (amount ?? 0)) {
      throw new Error(`Not enough ${rawKey}: need ${amount}, have ${available}`);
    }
  }

  // Calculate yield multiplier
  const yieldMultiplier = hasStructure ? 1.0 : recipe.handYieldMultiplier;
  if (yieldMultiplier <= 0) {
    throw new Error(`Recipe "${recipe.name}" requires structure "${recipe.requiresStructure}" and cannot be hand-crafted`);
  }

  // Build the deductions for raw resources
  const rawSets: Record<string, unknown> = {};
  for (const [key, amount] of Object.entries(inputs)) {
    const rawKey = key as RawResourceType;
    const colName = RAW_AGENT_COLS[rawKey];
    rawSets[colName] = sql`${agents[colName]} - ${amount ?? 0}`;
  }

  // Build the additions for refined materials
  const refinedSets: Record<string, unknown> = {};
  const actualOutputs: Partial<Record<RefinedMaterialType, number>> = {};
  for (const [key, amount] of Object.entries(recipe.outputs)) {
    const refinedKey = key as RefinedMaterialType;
    const colName = REFINED_AGENT_COLS[refinedKey];
    const produced = Math.floor((amount ?? 0) * yieldMultiplier);
    refinedSets[colName] = sql`${agents[colName]} + ${produced}`;
    actualOutputs[refinedKey] = produced;
  }

  // Apply in a single update
  await db
    .update(agents)
    .set({ ...rawSets, ...refinedSets })
    .where(eq(agents.id, agent.id));

  const outputDesc = Object.entries(actualOutputs)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => `${v} ${k}`)
    .join(", ");

  await insertActivity(
    db,
    "item_refined",
    agent.id,
    agent.name,
    `${agent.name} refined ${recipe.name}: produced ${outputDesc}`
  );

  return { outputs: actualOutputs };
}

/**
 * Applies decay to all buildings. Reduces durability by each building's
 * decayRate per tick (with 0.3x multiplier for forgiving gameplay).
 * Destroys buildings that reach 0 durability.
 *
 * @returns List of destroyed building IDs
 */
export async function applyDecay(
  db: Db
): Promise<{ destroyedIds: string[] }> {
  const destroyedIds: string[] = [];

  // Reduce durability on completed buildings only (incomplete buildings don't decay)
  // Apply 0.3x multiplier: normal buildings decay 0.3/tick, slow-decay 0.15/tick
  await db
    .update(buildings)
    .set({
      durability: sql`GREATEST(0, ${buildings.durability} - (${buildings.decayRate} * 0.3))`,
    })
    .where(eq(buildings.completed, true));

  // Find completed buildings that have been destroyed (durability reached 0)
  const destroyedRows = await db
    .select({ id: buildings.id, ownerId: buildings.ownerId, type: buildings.type, x: buildings.x, y: buildings.y })
    .from(buildings)
    .where(sql`${buildings.durability} <= 0 AND ${buildings.completed} = true`);

  for (const row of destroyedRows) {
    // Decrement owner's building count
    await db
      .update(agents)
      .set({
        buildingCount: sql`GREATEST(0, ${agents.buildingCount} - 1)`,
      })
      .where(eq(agents.id, row.ownerId));

    await deleteBuilding(db, row.id);
    destroyedIds.push(row.id);

    await insertNotification(
      db,
      row.ownerId,
      "building_decayed",
      `Your ${row.type} at (${row.x}, ${row.y}) has crumbled from decay`
    );

    await insertActivity(
      db,
      "building_decayed",
      row.ownerId,
      "system",
      `A ${row.type} at (${row.x}, ${row.y}) was destroyed by decay`
    );
  }

  return { destroyedIds };
}

/**
 * Deducts TAX_RATE from an agent's income and adds it to the public treasury.
 * The public treasury is stored in gameMeta under key "publicTreasury".
 *
 * @param income - The gross income amount (tokens) to tax
 * @returns The tax amount deducted
 */
export async function payTax(
  db: Db,
  agentId: string,
  income: number
): Promise<{ taxAmount: number }> {
  const taxAmount = Math.floor(income * TAX_RATE);
  if (taxAmount <= 0) {
    return { taxAmount: 0 };
  }

  // Deduct tax from agent
  await db
    .update(agents)
    .set({
      tokens: sql`${agents.tokens} - ${taxAmount}`,
    })
    .where(eq(agents.id, agentId));

  // Add to public treasury
  const currentTreasury = await getMetaValue(db, "publicTreasury");
  const treasuryValue = parseFloat(currentTreasury ?? "0") + taxAmount;
  await setMetaValue(db, "publicTreasury", String(treasuryValue));

  return { taxAmount };
}

/**
 * Moves an agent to a new position and deducts 1 food.
 * Throws if the agent has no food.
 */
export async function moveAgent(
  db: Db,
  agentId: string,
  newX: number,
  newY: number
): Promise<void> {
  // Deduct 1 food and update position atomically
  await db
    .update(agents)
    .set({
      x: newX,
      y: newY,
      rawFood: sql`${agents.rawFood} - 1`,
    })
    .where(eq(agents.id, agentId));
}
