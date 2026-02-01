import type {
  Agent,
  ApiResponse,
  Building,
  BuildingCost,
  GridCell,
} from "../../src/shared/types";
import {
  BUILDING_DEFINITIONS,
  PRESTIGE,
  DESERT_BUILD_COST_MULTIPLIER,
} from "../../src/shared/constants";
import type { Db } from "../db/client";
import {
  getPlotById,
  getBuildingById,
  getAllBuildings,
  updateAgent,
  updateBuilding,
  deleteBuilding,
  insertNotification,
  insertActivity,
} from "../db/queries";
import { placeBuilding } from "../db/transactions";
import { hasWorkshopDiscount, getAgentTier } from "../state/AgentState";
import {
  isAreaFreeForBuilding,
  markBuildingOnGrid,
  clearBuildingFromGrid,
} from "../state/GridState";

/**
 * POST /buildings
 * Places a new building. Validates tier, gate requirements, reputation, resources.
 */
export async function handlePlaceBuilding(
  body: {
    type?: string;
    plotId?: string;
    x?: number;
    y?: number;
    inscription?: string;
  },
  agent: Agent,
  db: Db,
  grid: GridCell[][]
): Promise<Response> {
  const { type, plotId, x, y, inscription } = body;

  if (!type || !plotId || x === undefined || y === undefined) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Missing required fields: type, plotId, x, y" },
      400
    );
  }

  const def = BUILDING_DEFINITIONS[type];
  if (!def) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: `Unknown building type: ${type}` },
      400
    );
  }

  const plot = await getPlotById(db, plotId);
  if (!plot) {
    return jsonResponse<ApiResponse>({ ok: false, error: "Plot not found" }, 404);
  }

  if (plot.ownerId !== agent.id) {
    return jsonResponse<ApiResponse>({ ok: false, error: "You do not own this plot" }, 403);
  }

  if (
    typeof x !== "number" || typeof y !== "number" ||
    !Number.isInteger(x) || !Number.isInteger(y)
  ) {
    return jsonResponse<ApiResponse>({ ok: false, error: "x and y must be integers" }, 400);
  }

  if (
    x < plot.x || y < plot.y ||
    x + def.width > plot.x + plot.width ||
    y + def.height > plot.y + plot.height
  ) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: `Building (${def.width}x${def.height}) does not fit within the plot at (${x}, ${y})` },
      400
    );
  }

  if (!isAreaFreeForBuilding(grid, x, y, def.width, def.height, plotId)) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Building area is occupied by another building" },
      409
    );
  }

  // Tier check
  const allBuildings = await getAllBuildings(db);
  const buildingsMap: Record<string, typeof allBuildings[0]> = {};
  for (const b of allBuildings) buildingsMap[b.id] = b;

  const agentTier = getAgentTier(agent, buildingsMap);
  if (agentTier < def.tier) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: `This building requires Tier ${def.tier}. You are Tier ${agentTier}.` },
      403
    );
  }

  // Gate requirement
  if (def.gateRequirement) {
    const hasGate = allBuildings.some(
      b => b.ownerId === agent.id && b.type === def.gateRequirement && b.completed
    );
    if (!hasGate) {
      return jsonResponse<ApiResponse>(
        { ok: false, error: `You must own a completed ${def.gateRequirement} to build ${type}.` },
        403
      );
    }
  }

  // Reputation gate
  if (def.reputationGate && agent.reputation < def.reputationGate) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: `This building requires ${def.reputationGate} reputation. You have ${agent.reputation}.` },
      403
    );
  }

  // Calculate cost with workshop discount + desert multiplier
  const discount = hasWorkshopDiscount(agent, buildingsMap) ? 0.9 : 1;
  const cell = grid[y]?.[x];
  const desertMult = cell?.terrain === "desert" ? DESERT_BUILD_COST_MULTIPLIER : 1;
  const costMult = discount * desertMult;

  const cost: BuildingCost = {
    raw: {
      wood: Math.floor((def.cost.raw.wood ?? 0) * costMult),
      stone: Math.floor((def.cost.raw.stone ?? 0) * costMult),
      water: Math.floor((def.cost.raw.water ?? 0) * costMult),
      food: Math.floor((def.cost.raw.food ?? 0) * costMult),
      clay: Math.floor((def.cost.raw.clay ?? 0) * costMult),
    },
    refined: {
      planks: Math.floor((def.cost.refined.planks ?? 0) * costMult),
      bricks: Math.floor((def.cost.refined.bricks ?? 0) * costMult),
      cement: Math.floor((def.cost.refined.cement ?? 0) * costMult),
      glass: Math.floor((def.cost.refined.glass ?? 0) * costMult),
      steel: Math.floor((def.cost.refined.steel ?? 0) * costMult),
    },
    tokens: Math.floor(def.cost.tokens * costMult),
  };

  // Check agent has enough resources
  const inv = agent.inventory;
  if (
    inv.raw.wood < (cost.raw.wood ?? 0) ||
    inv.raw.stone < (cost.raw.stone ?? 0) ||
    inv.raw.water < (cost.raw.water ?? 0) ||
    inv.raw.food < (cost.raw.food ?? 0) ||
    inv.raw.clay < (cost.raw.clay ?? 0) ||
    inv.refined.planks < (cost.refined.planks ?? 0) ||
    inv.refined.bricks < (cost.refined.bricks ?? 0) ||
    inv.refined.cement < (cost.refined.cement ?? 0) ||
    inv.refined.glass < (cost.refined.glass ?? 0) ||
    inv.refined.steel < (cost.refined.steel ?? 0) ||
    inv.tokens < cost.tokens
  ) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: `Insufficient resources for ${type}. Check /buildings/types for costs.` },
      403
    );
  }

  const now = Date.now();
  const building: Building = {
    id: crypto.randomUUID(),
    type: def.type,
    tier: def.tier,
    ownerId: agent.id,
    plotId,
    x,
    y,
    width: def.width,
    height: def.height,
    level: 1,
    progress: 0,
    completed: false,
    startedAt: now,
    completedAt: null,
    durability: def.durability,
    maxDurability: def.maxDurability,
    decayRate: def.decayRate,
    tokenIncome: def.tokenIncome,
    rentContractType: null,
    rentTicksRemaining: 0,
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
    lastCollection: now,
  };

  if (inscription && def.type === "monument") {
    building.inscription = inscription.slice(0, 140);
  }

  // DB transaction: deduct resources + insert building
  await placeBuilding(db, building, agent, cost, def);

  markBuildingOnGrid(grid, building.id, x, y, def.width, def.height);

  return jsonResponse<ApiResponse>({
    ok: true,
    data: {
      building,
      message: `Started building a ${def.type} (Tier ${def.tier}).`,
    },
  }, 201);
}

/**
 * GET /buildings
 */
export async function handleGetBuildings(db: Db): Promise<Response> {
  const allBuildings = await getAllBuildings(db);
  return jsonResponse<ApiResponse>({
    ok: true,
    data: { buildings: allBuildings },
  });
}

/**
 * POST /buildings/:id/upgrade
 */
export async function handleUpgradeBuilding(
  buildingId: string,
  agent: Agent,
  db: Db
): Promise<Response> {
  const building = await getBuildingById(db, buildingId);
  if (!building) return jsonResponse<ApiResponse>({ ok: false, error: "Building not found" }, 404);
  if (building.ownerId !== agent.id) return jsonResponse<ApiResponse>({ ok: false, error: "You do not own this building" }, 403);
  if (!building.completed) return jsonResponse<ApiResponse>({ ok: false, error: "Building is not yet completed" }, 409);

  const def = BUILDING_DEFINITIONS[building.type];
  if (!def) return jsonResponse<ApiResponse>({ ok: false, error: "Unknown building definition" }, 500);
  if (building.level >= def.maxLevel) return jsonResponse<ApiResponse>({ ok: false, error: `Already at max level (${def.maxLevel})` }, 409);

  // Upgrade cost: base cost * level (simple multiplier)
  const mult = building.level;
  const allBuildings = await getAllBuildings(db);
  const buildingsMap: Record<string, typeof allBuildings[0]> = {};
  for (const b of allBuildings) buildingsMap[b.id] = b;
  const discount = hasWorkshopDiscount(agent, buildingsMap) ? 0.9 : 1;
  const costMult = mult * discount;

  const inv = agent.inventory;
  const costRaw = {
    wood: Math.floor((def.cost.raw.wood ?? 0) * costMult),
    stone: Math.floor((def.cost.raw.stone ?? 0) * costMult),
    water: Math.floor((def.cost.raw.water ?? 0) * costMult),
    food: Math.floor((def.cost.raw.food ?? 0) * costMult),
    clay: Math.floor((def.cost.raw.clay ?? 0) * costMult),
  };
  const costRefined = {
    planks: Math.floor((def.cost.refined.planks ?? 0) * costMult),
    bricks: Math.floor((def.cost.refined.bricks ?? 0) * costMult),
    cement: Math.floor((def.cost.refined.cement ?? 0) * costMult),
    glass: Math.floor((def.cost.refined.glass ?? 0) * costMult),
    steel: Math.floor((def.cost.refined.steel ?? 0) * costMult),
  };
  const costTokens = Math.floor(def.cost.tokens * costMult);

  if (
    inv.raw.wood < costRaw.wood || inv.raw.stone < costRaw.stone || inv.raw.water < costRaw.water ||
    inv.raw.food < costRaw.food || inv.raw.clay < costRaw.clay ||
    inv.refined.planks < costRefined.planks || inv.refined.bricks < costRefined.bricks ||
    inv.refined.cement < costRefined.cement || inv.refined.glass < costRefined.glass ||
    inv.refined.steel < costRefined.steel || inv.tokens < costTokens
  ) {
    return jsonResponse<ApiResponse>({ ok: false, error: "Insufficient resources for upgrade." }, 403);
  }

  await updateAgent(db, agent.id, {
    rawWood: inv.raw.wood - costRaw.wood,
    rawStone: inv.raw.stone - costRaw.stone,
    rawWater: inv.raw.water - costRaw.water,
    rawFood: inv.raw.food - costRaw.food,
    rawClay: inv.raw.clay - costRaw.clay,
    refinedPlanks: inv.refined.planks - costRefined.planks,
    refinedBricks: inv.refined.bricks - costRefined.bricks,
    refinedCement: inv.refined.cement - costRefined.cement,
    refinedGlass: inv.refined.glass - costRefined.glass,
    refinedSteel: inv.refined.steel - costRefined.steel,
    tokens: inv.tokens - costTokens,
    reputation: agent.reputation + PRESTIGE.UPGRADE,
    x: building.x,
    y: building.y,
  });

  await updateBuilding(db, buildingId, { level: building.level + 1 });

  await insertActivity(db, "building_upgraded", agent.id, agent.name,
    `${agent.name} upgraded their ${building.type} to level ${building.level + 1}`);

  return jsonResponse<ApiResponse>({
    ok: true,
    data: {
      building: { ...building, level: building.level + 1 },
      message: `${building.type} upgraded to level ${building.level + 1}`,
    },
  });
}

/**
 * DELETE /buildings/:id
 */
export async function handleDemolishBuilding(
  buildingId: string,
  agent: Agent,
  db: Db,
  grid: GridCell[][]
): Promise<Response> {
  const building = await getBuildingById(db, buildingId);
  if (!building) return jsonResponse<ApiResponse>({ ok: false, error: "Building not found" }, 404);
  if (building.ownerId !== agent.id) return jsonResponse<ApiResponse>({ ok: false, error: "You do not own this building" }, 403);

  const def = BUILDING_DEFINITIONS[building.type];
  const refundMult = 0.5;

  // Refund 50% of base cost * level + pending resources
  const updates: Record<string, number> = {};
  if (def) {
    updates.rawWood = agent.inventory.raw.wood + Math.floor((def.cost.raw.wood ?? 0) * refundMult * building.level) + Math.floor(building.pendingRawWood);
    updates.rawStone = agent.inventory.raw.stone + Math.floor((def.cost.raw.stone ?? 0) * refundMult * building.level) + Math.floor(building.pendingRawStone);
    updates.rawWater = agent.inventory.raw.water + Math.floor((def.cost.raw.water ?? 0) * refundMult * building.level) + Math.floor(building.pendingRawWater);
    updates.rawFood = agent.inventory.raw.food + Math.floor((def.cost.raw.food ?? 0) * refundMult * building.level) + Math.floor(building.pendingRawFood);
    updates.rawClay = agent.inventory.raw.clay + Math.floor((def.cost.raw.clay ?? 0) * refundMult * building.level) + Math.floor(building.pendingRawClay);
    updates.refinedPlanks = agent.inventory.refined.planks + Math.floor((def.cost.refined.planks ?? 0) * refundMult * building.level) + Math.floor(building.pendingRefinedPlanks);
    updates.refinedBricks = agent.inventory.refined.bricks + Math.floor((def.cost.refined.bricks ?? 0) * refundMult * building.level) + Math.floor(building.pendingRefinedBricks);
    updates.refinedCement = agent.inventory.refined.cement + Math.floor((def.cost.refined.cement ?? 0) * refundMult * building.level) + Math.floor(building.pendingRefinedCement);
    updates.refinedGlass = agent.inventory.refined.glass + Math.floor((def.cost.refined.glass ?? 0) * refundMult * building.level) + Math.floor(building.pendingRefinedGlass);
    updates.refinedSteel = agent.inventory.refined.steel + Math.floor((def.cost.refined.steel ?? 0) * refundMult * building.level) + Math.floor(building.pendingRefinedSteel);
    updates.tokens = agent.inventory.tokens + Math.floor(def.cost.tokens * refundMult * building.level) + Math.floor(building.pendingTokens);
  }
  updates.buildingCount = agent.buildingCount - 1;

  await updateAgent(db, agent.id, updates);
  await deleteBuilding(db, buildingId);
  clearBuildingFromGrid(grid, building.id, building.x, building.y, building.width, building.height);

  await insertActivity(db, "building_demolished", agent.id, agent.name,
    `${agent.name} demolished a ${building.type} at (${building.x}, ${building.y})`);

  return jsonResponse<ApiResponse>({
    ok: true,
    data: { message: `${building.type} demolished. Resources refunded at 50%.` },
  });
}

/**
 * POST /buildings/:id/contribute — contribute resources to a building in progress
 */
export async function handleContributeBuilding(
  buildingId: string,
  body: { raw?: Partial<Record<string, number>>; refined?: Partial<Record<string, number>>; tokens?: number },
  agent: Agent,
  db: Db
): Promise<Response> {
  const building = await getBuildingById(db, buildingId);
  if (!building) return jsonResponse<ApiResponse>({ ok: false, error: "Building not found" }, 404);
  if (building.completed) return jsonResponse<ApiResponse>({ ok: false, error: "Building is already completed" }, 409);

  // Calculate contributed amounts (clamped to what agent has)
  const inv = agent.inventory;
  const contribRaw: Record<string, number> = {};
  const contribRefined: Record<string, number> = {};
  let contribTokens = 0;
  const agentUpdates: Record<string, number> = {};

  if (body.raw) {
    for (const [key, amount] of Object.entries(body.raw)) {
      if (!amount || amount <= 0) continue;
      const available = (inv.raw as any)[key] ?? 0;
      const toContrib = Math.min(amount, available);
      if (toContrib > 0) {
        contribRaw[key] = toContrib;
        const colMap: Record<string, string> = { wood: "rawWood", stone: "rawStone", water: "rawWater", food: "rawFood", clay: "rawClay" };
        if (colMap[key]) agentUpdates[colMap[key]] = available - toContrib;
      }
    }
  }
  if (body.refined) {
    for (const [key, amount] of Object.entries(body.refined)) {
      if (!amount || amount <= 0) continue;
      const available = (inv.refined as any)[key] ?? 0;
      const toContrib = Math.min(amount, available);
      if (toContrib > 0) {
        contribRefined[key] = toContrib;
        const colMap: Record<string, string> = { planks: "refinedPlanks", bricks: "refinedBricks", cement: "refinedCement", glass: "refinedGlass", steel: "refinedSteel" };
        if (colMap[key]) agentUpdates[colMap[key]] = available - toContrib;
      }
    }
  }
  if (body.tokens && body.tokens > 0) {
    contribTokens = Math.min(body.tokens, inv.tokens);
    if (contribTokens > 0) agentUpdates.tokens = inv.tokens - contribTokens;
  }

  const totalValue = Object.values(contribRaw).reduce((a, b) => a + b, 0) +
    Object.values(contribRefined).reduce((a, b) => a + b, 0) + contribTokens;

  if (totalValue === 0) {
    return jsonResponse<ApiResponse>({ ok: false, error: "No resources contributed" }, 400);
  }

  agentUpdates.x = building.x;
  agentUpdates.y = building.y;
  await updateAgent(db, agent.id, agentUpdates);

  // Record contribution
  const contributors: Record<string, Record<string, number>> = (building.contributors ?? {}) as Record<string, Record<string, number>>;
  if (!contributors[agent.id]) contributors[agent.id] = {};
  for (const [k, v] of Object.entries(contribRaw)) {
    contributors[agent.id][k] = (contributors[agent.id][k] ?? 0) + v;
  }
  await updateBuilding(db, buildingId, { contributors: contributors as any });

  // Award reputation for contribution
  if (totalValue > 0) {
    await updateAgent(db, agent.id, {
      reputation: agent.reputation + Math.min(Math.floor(totalValue / 10), 5),
    });
  }

  await insertNotification(db, building.ownerId, "building_contribution",
    `${agent.name} contributed resources to your ${building.type}`);
  await insertActivity(db, "building_contribution", agent.id, agent.name,
    `${agent.name} contributed resources to a ${building.type}`);

  return jsonResponse<ApiResponse>({
    ok: true,
    data: { contributed: { raw: contribRaw, refined: contribRefined, tokens: contribTokens }, message: `Contributed to ${building.type}` },
  });
}

/**
 * POST /buildings/:id/repair — restores durability
 */
export async function handleRepairBuilding(
  buildingId: string,
  agent: Agent,
  db: Db
): Promise<Response> {
  const building = await getBuildingById(db, buildingId);
  if (!building) return jsonResponse<ApiResponse>({ ok: false, error: "Building not found" }, 404);
  if (building.ownerId !== agent.id) return jsonResponse<ApiResponse>({ ok: false, error: "You do not own this building" }, 403);
  if (!building.completed) return jsonResponse<ApiResponse>({ ok: false, error: "Building is not completed" }, 409);
  if (building.durability >= building.maxDurability) return jsonResponse<ApiResponse>({ ok: false, error: "Building is at full durability" }, 409);

  const def = BUILDING_DEFINITIONS[building.type];
  if (!def) return jsonResponse<ApiResponse>({ ok: false, error: "Unknown building" }, 500);

  // Repair cost: 25% of base cost
  const repairMult = 0.25;
  const inv = agent.inventory;
  const costWood = Math.floor((def.cost.raw.wood ?? 0) * repairMult);
  const costStone = Math.floor((def.cost.raw.stone ?? 0) * repairMult);

  if (inv.raw.wood < costWood || inv.raw.stone < costStone) {
    return jsonResponse<ApiResponse>({ ok: false, error: "Insufficient resources for repair" }, 403);
  }

  await updateAgent(db, agent.id, {
    rawWood: inv.raw.wood - costWood,
    rawStone: inv.raw.stone - costStone,
  });

  await updateBuilding(db, buildingId, {
    durability: building.maxDurability,
  });

  return jsonResponse<ApiResponse>({
    ok: true,
    data: { message: `${building.type} repaired to full durability.` },
  });
}

/**
 * POST /buildings/:id/rent — sets a rent contract on a residential building
 */
export async function handleSetRentContract(
  buildingId: string,
  body: { contractType?: string },
  agent: Agent,
  db: Db
): Promise<Response> {
  const building = await getBuildingById(db, buildingId);
  if (!building) return jsonResponse<ApiResponse>({ ok: false, error: "Building not found" }, 404);
  if (building.ownerId !== agent.id) return jsonResponse<ApiResponse>({ ok: false, error: "You do not own this building" }, 403);
  if (!building.completed) return jsonResponse<ApiResponse>({ ok: false, error: "Building is not completed" }, 409);

  const def = BUILDING_DEFINITIONS[building.type];
  if (!def?.residential) return jsonResponse<ApiResponse>({ ok: false, error: "This building is not residential" }, 400);

  const contractType = body.contractType;
  if (!contractType || !["sprint", "standard", "long_term"].includes(contractType)) {
    return jsonResponse<ApiResponse>({ ok: false, error: "Invalid contractType. Use: sprint, standard, long_term" }, 400);
  }

  const tickMap: Record<string, number> = { sprint: 3, standard: 10, long_term: 30 };
  await updateBuilding(db, buildingId, {
    rentContractType: contractType,
    rentTicksRemaining: tickMap[contractType],
  });

  return jsonResponse<ApiResponse>({
    ok: true,
    data: { message: `Rent contract set to ${contractType} (${tickMap[contractType]} ticks)` },
  });
}

/**
 * GET /buildings/types
 */
export function handleGetBuildingTypes(): Response {
  return jsonResponse<ApiResponse>({
    ok: true,
    data: { buildingTypes: BUILDING_DEFINITIONS },
  });
}

function jsonResponse<T>(data: T, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
