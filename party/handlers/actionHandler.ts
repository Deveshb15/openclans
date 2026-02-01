import type {
  Agent,
  ApiResponse,
  GridCell,
} from "../../src/shared/types";
import {
  GATHERING_RATES,
  REFINING_RECIPES,
  FOREST_CLEAR_WOOD_YIELD,
  CLAIM_TILE_COST_TOKENS,
  VISION_RADIUS,
} from "../../src/shared/constants";
import type { Db } from "../db/client";
import {
  updateAgent,
  insertActivity,
  insertPlot,
} from "../db/queries";
import {
  isPassable,
  getTilesInRadius,
  clearForestTile,
  getResourceNodeAt,
  markPlotOnGrid,
} from "../state/GridState";
import {
  getInventoryUsage,
  getInventoryLimit,
  canAct,
} from "../state/AgentState";
import type { Plot } from "../../src/shared/types";

// ======================= MOVE =======================

export async function handleMove(
  body: { direction?: string },
  agent: Agent,
  db: Db,
  grid: GridCell[][],
  allBuildings: Record<string, any>
): Promise<Response> {
  if (!canAct(agent)) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Agent is starving and cannot act. Forage for food first." },
      403
    );
  }

  const dir = body.direction;
  if (!dir || typeof dir !== "string") {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Missing 'direction'. Use: n, s, e, w, ne, nw, se, sw" },
      400
    );
  }

  const deltas: Record<string, [number, number]> = {
    n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0],
    ne: [1, -1], nw: [-1, -1], se: [1, 1], sw: [-1, 1],
  };

  const delta = deltas[dir.toLowerCase()];
  if (!delta) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Invalid direction. Use: n, s, e, w, ne, nw, se, sw" },
      400
    );
  }

  const newX = agent.x + delta[0];
  const newY = agent.y + delta[1];

  if (!isPassable(grid, newX, newY)) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: `Cannot move to (${newX}, ${newY}) — tile is impassable` },
      400
    );
  }

  // Movement costs 1 food
  if (agent.inventory.raw.food < 1) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Not enough food to move. Food cost: 1 per move." },
      403
    );
  }

  await updateAgent(db, agent.id, {
    x: newX,
    y: newY,
    rawFood: agent.inventory.raw.food - 1,
  });

  return jsonResponse<ApiResponse>({
    ok: true,
    data: {
      x: newX,
      y: newY,
      foodRemaining: agent.inventory.raw.food - 1,
      message: `Moved ${dir} to (${newX}, ${newY})`,
    },
  });
}

// ======================= GATHER =======================

export async function handleGather(
  body: { type?: string },
  agent: Agent,
  db: Db,
  grid: GridCell[][],
  allBuildings: Record<string, any>
): Promise<Response> {
  if (!canAct(agent)) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Agent is starving and cannot act." },
      403
    );
  }

  const gatherType = body.type;
  if (!gatherType || typeof gatherType !== "string") {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Missing 'type'. Use: chop, mine, collect_water, forage, dig" },
      400
    );
  }

  const rates = GATHERING_RATES.hand;
  const validTypes = Object.keys(rates);
  if (!validTypes.includes(gatherType)) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: `Invalid gather type '${gatherType}'. Use: ${validTypes.join(", ")}` },
      400
    );
  }

  // Check terrain adjacency
  const terrainRequirements: Record<string, string[]> = {
    chop: ["forest"],
    mine: ["mountain"],
    collect_water: ["water", "riverbank"],
    forage: ["fertile", "plains"],
    dig: ["riverbank"],
  };

  const requiredTerrains = terrainRequirements[gatherType] || [];
  const agentCell = grid[agent.y]?.[agent.x];
  const adjacentTiles = getTilesInRadius(grid, agent.x, agent.y, 1);
  const hasValidTerrain = adjacentTiles.some(t =>
    requiredTerrains.includes(t.cell.terrain)
  ) || (agentCell && requiredTerrains.includes(agentCell.terrain));

  if (!hasValidTerrain) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: `No ${requiredTerrains.join("/")} terrain nearby for ${gatherType}` },
      400
    );
  }

  // Check inventory space
  const usage = getInventoryUsage(agent);
  const limit = getInventoryLimit(agent, allBuildings);
  const gatherAmounts = (rates as any)[gatherType] as Record<string, number>;
  const totalGathered = Object.values(gatherAmounts).reduce((a: number, b: number) => a + b, 0);

  if (usage + totalGathered > limit) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: `Inventory full (${usage}/${limit}). Build storage or refine materials.` },
      403
    );
  }

  // Deduct from resource node if possible
  let nodeX = agent.x;
  let nodeY = agent.y;
  const agentNode = getResourceNodeAt(grid, agent.x, agent.y);
  if (agentNode && agentNode.currentAmount > 0) {
    agentNode.currentAmount = Math.max(0, agentNode.currentAmount - totalGathered);
    if (agentNode.currentAmount <= 0) {
      agentNode.depletedAt = Date.now();
    }
  } else {
    // Try adjacent tiles
    for (const t of adjacentTiles) {
      if (t.cell.resourceNode && t.cell.resourceNode.currentAmount > 0 &&
          requiredTerrains.includes(t.cell.terrain)) {
        t.cell.resourceNode.currentAmount = Math.max(0, t.cell.resourceNode.currentAmount - totalGathered);
        if (t.cell.resourceNode.currentAmount <= 0) {
          t.cell.resourceNode.depletedAt = Date.now();
        }
        nodeX = t.x;
        nodeY = t.y;
        break;
      }
    }
  }

  // Add resources to agent
  const updates: Record<string, number> = {};
  if (gatherAmounts.wood) updates.rawWood = agent.inventory.raw.wood + gatherAmounts.wood;
  if (gatherAmounts.stone) updates.rawStone = agent.inventory.raw.stone + gatherAmounts.stone;
  if (gatherAmounts.water) updates.rawWater = agent.inventory.raw.water + gatherAmounts.water;
  if (gatherAmounts.food) updates.rawFood = agent.inventory.raw.food + gatherAmounts.food;
  if (gatherAmounts.clay) updates.rawClay = agent.inventory.raw.clay + gatherAmounts.clay;

  await updateAgent(db, agent.id, updates);

  return jsonResponse<ApiResponse>({
    ok: true,
    data: {
      gathered: gatherAmounts,
      message: `Gathered: ${Object.entries(gatherAmounts).map(([k, v]) => `+${v} ${k}`).join(", ")}`,
    },
  });
}

// ======================= REFINE =======================

export async function handleRefine(
  body: { recipe?: string },
  agent: Agent,
  db: Db,
  grid: GridCell[][],
  allBuildings: Record<string, any>
): Promise<Response> {
  if (!canAct(agent)) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Agent is starving and cannot act." },
      403
    );
  }

  const recipeName = body.recipe;
  if (!recipeName || typeof recipeName !== "string") {
    return jsonResponse<ApiResponse>(
      { ok: false, error: `Missing 'recipe'. Use: ${Object.keys(REFINING_RECIPES).join(", ")}` },
      400
    );
  }

  const recipe = REFINING_RECIPES[recipeName];
  if (!recipe) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: `Unknown recipe '${recipeName}'. Use: ${Object.keys(REFINING_RECIPES).join(", ")}` },
      400
    );
  }

  // Check if agent has required structure or can hand-craft
  let hasStructure = false;
  if (recipe.requiresStructure) {
    for (const building of Object.values(allBuildings)) {
      const b = building as any;
      if (b.ownerId === agent.id && b.type === recipe.requiresStructure && b.completed) {
        hasStructure = true;
        break;
      }
    }
  } else {
    hasStructure = true; // No structure required
  }

  if (!hasStructure && !recipe.handCraftable) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: `Recipe '${recipeName}' requires a ${recipe.requiresStructure}. Cannot hand-craft.` },
      403
    );
  }

  const yieldMult = hasStructure ? 1 : recipe.handYieldMultiplier;
  if (yieldMult <= 0) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: `Recipe '${recipeName}' cannot be hand-crafted. Build a ${recipe.requiresStructure}.` },
      403
    );
  }

  // Check if agent has required raw materials
  const inputs = recipe.inputs;
  if ((inputs.wood ?? 0) > agent.inventory.raw.wood ||
      (inputs.stone ?? 0) > agent.inventory.raw.stone ||
      (inputs.water ?? 0) > agent.inventory.raw.water ||
      (inputs.food ?? 0) > agent.inventory.raw.food ||
      (inputs.clay ?? 0) > agent.inventory.raw.clay) {
    return jsonResponse<ApiResponse>({
      ok: false,
      error: `Insufficient raw materials. Need: ${Object.entries(inputs).filter(([, v]) => v && v > 0).map(([k, v]) => `${v} ${k}`).join(", ")}`,
    }, 403);
  }

  // Calculate outputs with yield multiplier
  const outputs: Record<string, number> = {};
  for (const [key, amount] of Object.entries(recipe.outputs)) {
    if (amount && amount > 0) {
      outputs[key] = Math.max(1, Math.floor(amount * yieldMult));
    }
  }

  // Deduct inputs, add outputs
  const updates: Record<string, number> = {};
  if (inputs.wood) updates.rawWood = agent.inventory.raw.wood - inputs.wood;
  if (inputs.stone) updates.rawStone = agent.inventory.raw.stone - inputs.stone;
  if (inputs.water) updates.rawWater = agent.inventory.raw.water - inputs.water;
  if (inputs.food) updates.rawFood = agent.inventory.raw.food - inputs.food;
  if (inputs.clay) updates.rawClay = agent.inventory.raw.clay - inputs.clay;

  if (outputs.planks) updates.refinedPlanks = agent.inventory.refined.planks + outputs.planks;
  if (outputs.bricks) updates.refinedBricks = agent.inventory.refined.bricks + outputs.bricks;
  if (outputs.cement) updates.refinedCement = agent.inventory.refined.cement + outputs.cement;
  if (outputs.glass) updates.refinedGlass = agent.inventory.refined.glass + outputs.glass;
  if (outputs.steel) updates.refinedSteel = agent.inventory.refined.steel + outputs.steel;

  await updateAgent(db, agent.id, updates);

  return jsonResponse<ApiResponse>({
    ok: true,
    data: {
      consumed: inputs,
      produced: outputs,
      handCrafted: !hasStructure,
      message: `Refined: ${Object.entries(outputs).map(([k, v]) => `+${v} ${k}`).join(", ")}${!hasStructure ? " (hand-crafted, reduced yield)" : ""}`,
    },
  });
}

// ======================= CLEAR FOREST =======================

export async function handleClearForest(
  body: Record<string, unknown>,
  agent: Agent,
  db: Db,
  grid: GridCell[][]
): Promise<Response> {
  if (!canAct(agent)) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Agent is starving and cannot act." },
      403
    );
  }

  const cell = grid[agent.y]?.[agent.x];
  if (!cell || cell.terrain !== "forest") {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "You must be on a forest tile to clear it." },
      400
    );
  }

  // Clear the forest tile
  const cleared = clearForestTile(grid, agent.x, agent.y);
  if (!cleared) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Failed to clear forest tile." },
      500
    );
  }

  // Yield wood to agent
  await updateAgent(db, agent.id, {
    rawWood: agent.inventory.raw.wood + FOREST_CLEAR_WOOD_YIELD,
  });

  await insertActivity(
    db,
    "forest_cleared",
    agent.id,
    agent.name,
    `${agent.name} cleared a forest at (${agent.x}, ${agent.y}) and gained ${FOREST_CLEAR_WOOD_YIELD} wood`
  );

  return jsonResponse<ApiResponse>({
    ok: true,
    data: {
      woodGained: FOREST_CLEAR_WOOD_YIELD,
      x: agent.x,
      y: agent.y,
      message: `Forest cleared! +${FOREST_CLEAR_WOOD_YIELD} wood. Tile is now plains.`,
    },
  });
}

// ======================= CLAIM TILE =======================

export async function handleClaimTile(
  body: { x?: number; y?: number; width?: number; height?: number },
  agent: Agent,
  db: Db,
  grid: GridCell[][]
): Promise<Response> {
  if (!canAct(agent)) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Agent is starving and cannot act." },
      403
    );
  }

  const x = body.x ?? agent.x;
  const y = body.y ?? agent.y;
  const width = body.width ?? 1;
  const height = body.height ?? 1;

  // Validate position
  if (x < 0 || y < 0 || x + width > grid[0].length || y + height > grid.length) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Position out of bounds" },
      400
    );
  }

  // Check all cells are passable and unclaimed
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const cell = grid[y + dy][x + dx];
      if (!cell.isPassable) {
        return jsonResponse<ApiResponse>(
          { ok: false, error: `Tile (${x + dx}, ${y + dy}) is impassable` },
          400
        );
      }
      if (cell.plotId !== null) {
        return jsonResponse<ApiResponse>(
          { ok: false, error: `Tile (${x + dx}, ${y + dy}) is already claimed` },
          409
        );
      }
      if (!cell.isCleared) {
        return jsonResponse<ApiResponse>(
          { ok: false, error: `Tile (${x + dx}, ${y + dy}) has forest — clear it first` },
          400
        );
      }
    }
  }

  // Cost: tokens per tile
  const totalCost = CLAIM_TILE_COST_TOKENS * width * height;
  if (agent.inventory.tokens < totalCost) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: `Not enough tokens. Cost: ${totalCost} tokens (${CLAIM_TILE_COST_TOKENS}/tile). You have ${agent.inventory.tokens}.` },
      403
    );
  }

  // Create plot
  const plot: Plot = {
    id: crypto.randomUUID(),
    ownerId: agent.id,
    x,
    y,
    width,
    height,
    claimedAt: Date.now(),
  };

  await insertPlot(db, plot);

  // Deduct tokens and update counts
  await updateAgent(db, agent.id, {
    tokens: agent.inventory.tokens - totalCost,
    plotCount: agent.plotCount + width * height,
  });

  // Mark grid
  markPlotOnGrid(grid, plot.id, x, y, width, height);

  await insertActivity(
    db,
    "plot_claimed",
    agent.id,
    agent.name,
    `${agent.name} claimed a ${width}x${height} plot at (${x}, ${y})`
  );

  return jsonResponse<ApiResponse>({
    ok: true,
    data: {
      plot,
      cost: totalCost,
      message: `Claimed ${width}x${height} plot at (${x}, ${y}) for ${totalCost} tokens.`,
    },
  }, 201);
}

// ======================= NEARBY (FOG OF WAR) =======================

export async function handleGetNearby(
  agent: Agent,
  db: Db,
  grid: GridCell[][],
  allBuildings: Record<string, any>,
  allAgents: Record<string, any>
): Promise<Response> {
  const radius = agent.visionRadius || VISION_RADIUS;
  const tiles = getTilesInRadius(grid, agent.x, agent.y, radius);

  const nearbyTiles = tiles.map(t => ({
    x: t.x,
    y: t.y,
    terrain: t.cell.terrain,
    plotId: t.cell.plotId,
    buildingId: t.cell.buildingId,
    resourceNode: t.cell.resourceNode ? {
      type: t.cell.resourceNode.type,
      currentAmount: t.cell.resourceNode.currentAmount,
      maxAmount: t.cell.resourceNode.maxAmount,
    } : null,
    isPassable: t.cell.isPassable,
    isCleared: t.cell.isCleared,
  }));

  // Find buildings in radius
  const nearbyBuildings: any[] = [];
  const buildingIds = new Set<string>();
  for (const t of tiles) {
    if (t.cell.buildingId && !buildingIds.has(t.cell.buildingId)) {
      buildingIds.add(t.cell.buildingId);
      const b = allBuildings[t.cell.buildingId];
      if (b) nearbyBuildings.push(b);
    }
  }

  // Find agents in radius
  const nearbyAgents: any[] = [];
  for (const a of Object.values(allAgents)) {
    const ag = a as any;
    const dx = ag.x - agent.x;
    const dy = ag.y - agent.y;
    if (Math.sqrt(dx * dx + dy * dy) <= radius && ag.id !== agent.id) {
      nearbyAgents.push({
        id: ag.id,
        name: ag.name,
        x: ag.x,
        y: ag.y,
        reputation: ag.reputation,
        personality: ag.personality,
      });
    }
  }

  return jsonResponse<ApiResponse>({
    ok: true,
    data: {
      center: { x: agent.x, y: agent.y },
      radius,
      tiles: nearbyTiles,
      buildings: nearbyBuildings,
      agents: nearbyAgents,
    },
  });
}

// ======================= BATCH ACTIONS =======================

export async function handleBatchActions(
  body: { actions?: Array<{ action: string; [key: string]: unknown }> },
  agent: Agent,
  db: Db,
  grid: GridCell[][],
  allBuildings: Record<string, any>,
  allAgents: Record<string, any>,
  refreshAgent: () => Promise<Agent | null>
): Promise<Response> {
  if (!body.actions || !Array.isArray(body.actions)) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Missing 'actions' array" },
      400
    );
  }

  if (body.actions.length > 5) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Maximum 5 actions per batch" },
      400
    );
  }

  const results: Array<{ action: string; ok: boolean; data?: unknown; error?: string }> = [];
  let currentAgent = agent;

  for (const actionDef of body.actions) {
    const actionType = actionDef.action;

    let response: Response;
    switch (actionType) {
      case "move":
        response = await handleMove(actionDef as any, currentAgent, db, grid, allBuildings);
        break;
      case "gather":
        response = await handleGather(actionDef as any, currentAgent, db, grid, allBuildings);
        break;
      case "refine":
        response = await handleRefine(actionDef as any, currentAgent, db, grid, allBuildings);
        break;
      case "clear":
        response = await handleClearForest(actionDef as any, currentAgent, db, grid);
        break;
      default:
        results.push({ action: actionType, ok: false, error: `Unknown action: ${actionType}` });
        continue;
    }

    const result = await response.json() as ApiResponse;
    results.push({ action: actionType, ok: result.ok, data: result.data, error: result.error });

    if (!result.ok) {
      // Stop on first failure
      break;
    }

    // Refresh agent state after each action
    const refreshed = await refreshAgent();
    if (refreshed) currentAgent = refreshed;
  }

  return jsonResponse<ApiResponse>({
    ok: true,
    data: { results },
  });
}

function jsonResponse<T>(data: T, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
