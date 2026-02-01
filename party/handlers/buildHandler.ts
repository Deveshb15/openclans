import type {
  Agent,
  ApiResponse,
  Building,
  Resources,
  GridCell,
} from "../../src/shared/types";
import {
  BUILDING_DEFINITIONS,
  PRESTIGE,
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
import { hasWorkshopDiscount } from "../state/AgentState";
import {
  isAreaFreeForBuilding,
  markBuildingOnGrid,
  clearBuildingFromGrid,
} from "../state/GridState";

/**
 * POST /buildings
 * Places a new building on a plot. Validates building definition, ownership,
 * position, resources, and special requirements.
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

  // Validate required fields
  if (!type || !plotId || x === undefined || y === undefined) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Missing required fields: type, plotId, x, y" },
      400
    );
  }

  // Validate building type
  const def = BUILDING_DEFINITIONS[type];
  if (!def) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: `Unknown building type: ${type}` },
      400
    );
  }

  // Validate plot ownership
  const plot = await getPlotById(db, plotId);
  if (!plot) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Plot not found" },
      404
    );
  }

  if (plot.ownerId !== agent.id) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "You do not own this plot" },
      403
    );
  }

  // Validate position is within plot boundaries
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    !Number.isInteger(x) ||
    !Number.isInteger(y)
  ) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "x and y must be integers" },
      400
    );
  }

  if (
    x < plot.x ||
    y < plot.y ||
    x + def.width > plot.x + plot.width ||
    y + def.height > plot.y + plot.height
  ) {
    return jsonResponse<ApiResponse>(
      {
        ok: false,
        error: `Building (${def.width}x${def.height}) does not fit within the plot at position (${x}, ${y})`,
      },
      400
    );
  }

  // Check that the area within the plot is free of other buildings (in-memory grid)
  if (!isAreaFreeForBuilding(grid, x, y, def.width, def.height, plotId)) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Building area is occupied by another building" },
      409
    );
  }

  // Check prestige requirements
  if (def.requiresPrestige && agent.prestige < def.requiresPrestige) {
    return jsonResponse<ApiResponse>(
      {
        ok: false,
        error: `This building requires ${def.requiresPrestige} prestige. You have ${agent.prestige}.`,
      },
      403
    );
  }

  // Calculate cost (with workshop discount if applicable)
  const allBuildings = await getAllBuildings(db);
  const buildingsMap: Record<string, typeof allBuildings[0]> = {};
  for (const b of allBuildings) buildingsMap[b.id] = b;
  const discount = hasWorkshopDiscount(agent, buildingsMap) ? 0.9 : 1;
  const cost: Resources = {
    wood: Math.floor(def.cost.wood * discount),
    stone: Math.floor(def.cost.stone * discount),
    food: Math.floor(def.cost.food * discount),
    gold: Math.floor(def.cost.gold * discount),
  };

  // Check if agent has enough resources
  if (
    agent.resources.wood < cost.wood ||
    agent.resources.stone < cost.stone ||
    agent.resources.food < cost.food ||
    agent.resources.gold < cost.gold
  ) {
    return jsonResponse<ApiResponse>(
      {
        ok: false,
        error: `Insufficient resources. Cost: wood=${cost.wood}, stone=${cost.stone}, food=${cost.food}, gold=${cost.gold}. You have: wood=${agent.resources.wood}, stone=${agent.resources.stone}, food=${agent.resources.food}, gold=${agent.resources.gold}`,
      },
      403
    );
  }

  // Create building
  const now = Date.now();
  const building: Building = {
    id: crypto.randomUUID(),
    type: def.type,
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
    pendingResources: { wood: 0, stone: 0, food: 0, gold: 0 },
    lastCollection: now,
  };

  // Optional inscription (for monuments)
  if (inscription && def.type === "monument") {
    building.inscription = inscription.slice(0, 140);
  }

  // Collaborative buildings track contributors
  if (def.collaborative) {
    building.contributors = {
      [agent.id]: { ...cost },
    };
  }

  // DB transaction: deduct resources + insert building + update counts/prestige
  await placeBuilding(db, building, agent, cost);

  // Mark grid cells (in-memory, after successful DB write)
  markBuildingOnGrid(grid, building.id, x, y, def.width, def.height);

  return jsonResponse<ApiResponse>({
    ok: true,
    data: {
      building,
      message: `Started building a ${def.type}. It will complete in ${def.buildTime} seconds.`,
    },
  }, 201);
}

/**
 * GET /buildings
 * Returns all buildings in the town.
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
 * Upgrades a building to the next level. Costs multiplied resources.
 */
export async function handleUpgradeBuilding(
  buildingId: string,
  agent: Agent,
  db: Db
): Promise<Response> {
  const building = await getBuildingById(db, buildingId);
  if (!building) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Building not found" },
      404
    );
  }

  if (building.ownerId !== agent.id) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "You do not own this building" },
      403
    );
  }

  if (!building.completed) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Building is not yet completed" },
      409
    );
  }

  const def = BUILDING_DEFINITIONS[building.type];
  if (!def) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Unknown building definition" },
      500
    );
  }

  if (building.level >= def.maxLevel) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: `Building is already at max level (${def.maxLevel})` },
      409
    );
  }

  // Calculate upgrade cost
  const multiplier = Math.pow(def.upgradeCostMultiplier, building.level);
  const allBuildings = await getAllBuildings(db);
  const buildingsMap: Record<string, typeof allBuildings[0]> = {};
  for (const b of allBuildings) buildingsMap[b.id] = b;
  const discount = hasWorkshopDiscount(agent, buildingsMap) ? 0.9 : 1;
  const cost: Resources = {
    wood: Math.floor(def.cost.wood * multiplier * discount),
    stone: Math.floor(def.cost.stone * multiplier * discount),
    food: Math.floor(def.cost.food * multiplier * discount),
    gold: Math.floor(def.cost.gold * multiplier * discount),
  };

  // Check resources
  if (
    agent.resources.wood < cost.wood ||
    agent.resources.stone < cost.stone ||
    agent.resources.food < cost.food ||
    agent.resources.gold < cost.gold
  ) {
    return jsonResponse<ApiResponse>(
      {
        ok: false,
        error: `Insufficient resources for upgrade. Cost: wood=${cost.wood}, stone=${cost.stone}, food=${cost.food}, gold=${cost.gold}`,
      },
      403
    );
  }

  // Deduct resources, upgrade, and update agent position to building
  await updateAgent(db, agent.id, {
    resourceWood: agent.resources.wood - cost.wood,
    resourceStone: agent.resources.stone - cost.stone,
    resourceFood: agent.resources.food - cost.food,
    resourceGold: agent.resources.gold - cost.gold,
    prestige: agent.prestige + PRESTIGE.UPGRADE,
    x: building.x,
    y: building.y,
  });

  await updateBuilding(db, buildingId, {
    level: building.level + 1,
  });

  await insertActivity(
    db,
    "building_upgraded",
    agent.id,
    agent.name,
    `${agent.name} upgraded their ${building.type} to level ${building.level + 1}`
  );

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
 * Demolishes a building. Refunds 50% of resources. Clears grid cells.
 */
export async function handleDemolishBuilding(
  buildingId: string,
  agent: Agent,
  db: Db,
  grid: GridCell[][]
): Promise<Response> {
  const building = await getBuildingById(db, buildingId);
  if (!building) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Building not found" },
      404
    );
  }

  if (building.ownerId !== agent.id) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "You do not own this building" },
      403
    );
  }

  const def = BUILDING_DEFINITIONS[building.type];

  // Calculate refund
  let refundWood = 0, refundStone = 0, refundFood = 0, refundGold = 0;
  if (def) {
    const refundMultiplier = 0.5;
    refundWood = Math.floor(def.cost.wood * refundMultiplier * building.level);
    refundStone = Math.floor(def.cost.stone * refundMultiplier * building.level);
    refundFood = Math.floor(def.cost.food * refundMultiplier * building.level);
    refundGold = Math.floor(def.cost.gold * refundMultiplier * building.level);
  }

  // Also give back any pending resources
  refundWood += Math.floor(building.pendingResources.wood);
  refundStone += Math.floor(building.pendingResources.stone);
  refundFood += Math.floor(building.pendingResources.food);
  refundGold += Math.floor(building.pendingResources.gold);

  // Update agent resources and counts
  await updateAgent(db, agent.id, {
    resourceWood: agent.resources.wood + refundWood,
    resourceStone: agent.resources.stone + refundStone,
    resourceFood: agent.resources.food + refundFood,
    resourceGold: agent.resources.gold + refundGold,
    buildingCount: agent.buildingCount - 1,
  });

  // Delete building from DB
  await deleteBuilding(db, buildingId);

  // Clear grid cells (in-memory)
  clearBuildingFromGrid(
    grid,
    building.id,
    building.x,
    building.y,
    building.width,
    building.height
  );

  await insertActivity(
    db,
    "building_demolished",
    agent.id,
    agent.name,
    `${agent.name} demolished a ${building.type} at (${building.x}, ${building.y})`
  );

  return jsonResponse<ApiResponse>({
    ok: true,
    data: {
      message: `${building.type} demolished. Resources refunded at 50%.`,
    },
  });
}

/**
 * POST /buildings/:id/contribute
 * Contributes resources to a collaborative building (e.g., townhall).
 */
export async function handleContributeBuilding(
  buildingId: string,
  body: { resources?: Partial<Resources> },
  agent: Agent,
  db: Db
): Promise<Response> {
  const building = await getBuildingById(db, buildingId);
  if (!building) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Building not found" },
      404
    );
  }

  const def = BUILDING_DEFINITIONS[building.type];
  if (!def || !def.collaborative) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "This building does not accept contributions" },
      400
    );
  }

  if (building.completed) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Building is already completed" },
      409
    );
  }

  if (!body.resources) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Missing 'resources' field with contribution amounts" },
      400
    );
  }

  const contribution = body.resources;
  const contributed: Resources = { wood: 0, stone: 0, food: 0, gold: 0 };

  // Validate and transfer each resource
  for (const [key, amount] of Object.entries(contribution)) {
    const resKey = key as keyof Resources;
    if (amount === undefined || amount <= 0) continue;
    if (typeof amount !== "number") continue;

    const toContribute = Math.min(amount, agent.resources[resKey]);
    if (toContribute <= 0) continue;

    contributed[resKey] = toContribute;
  }

  // Deduct from agent and update position to building
  await updateAgent(db, agent.id, {
    resourceWood: agent.resources.wood - contributed.wood,
    resourceStone: agent.resources.stone - contributed.stone,
    resourceFood: agent.resources.food - contributed.food,
    resourceGold: agent.resources.gold - contributed.gold,
    x: building.x,
    y: building.y,
  });

  // Record contribution
  const contributors = building.contributors ?? {};
  if (!contributors[agent.id]) {
    contributors[agent.id] = { wood: 0, stone: 0, food: 0, gold: 0 };
  }
  contributors[agent.id].wood += contributed.wood;
  contributors[agent.id].stone += contributed.stone;
  contributors[agent.id].food += contributed.food;
  contributors[agent.id].gold += contributed.gold;

  await updateBuilding(db, buildingId, { contributors });

  // Check total contributions
  const totalContributed: Resources = { wood: 0, stone: 0, food: 0, gold: 0 };
  for (const agentContribution of Object.values(contributors)) {
    totalContributed.wood += agentContribution.wood;
    totalContributed.stone += agentContribution.stone;
    totalContributed.food += agentContribution.food;
    totalContributed.gold += agentContribution.gold;
  }

  // Award prestige for contribution
  const totalValue =
    contributed.wood + contributed.stone + contributed.food + contributed.gold;
  if (totalValue > 0) {
    await updateAgent(db, agent.id, {
      prestige: agent.prestige + Math.min(Math.floor(totalValue / 10), 5),
    });
  }

  await insertNotification(
    db,
    building.ownerId,
    "building_contribution",
    `${agent.name} contributed resources to your ${building.type}`
  );

  await insertActivity(
    db,
    "building_contribution",
    agent.id,
    agent.name,
    `${agent.name} contributed resources to a ${building.type}`
  );

  return jsonResponse<ApiResponse>({
    ok: true,
    data: {
      contributed,
      totalContributed,
      required: def.cost,
      message: `Contributed resources to ${building.type}`,
    },
  });
}

/**
 * GET /buildings/types
 * Returns all available building type definitions.
 */
export function handleGetBuildingTypes(): Response {
  return jsonResponse<ApiResponse>({
    ok: true,
    data: {
      buildingTypes: BUILDING_DEFINITIONS,
    },
  });
}

/**
 * Helper to create a JSON Response.
 */
function jsonResponse<T>(data: T, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
