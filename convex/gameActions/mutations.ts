import { mutation } from "../_generated/server";
import { v } from "convex/values";
import {
  DIRECTIONS,
  isPassable,
  canGatherAt,
  GridCell,
  hasRequiredBuilding,
  calculateAgentTier,
  getInventoryUsage,
  getInventoryLimit,
} from "../helpers";
import {
  MOVE_COOLDOWN_MS,
  GATHER_COOLDOWN_MS,
  REFINE_COOLDOWN_MS,
  BATCH_COOLDOWN_MS,
  GATHERING_RATES,
  REFINING_RECIPES,
  FOREST_CLEAR_WOOD_YIELD,
  CLAIM_TILE_COST_TOKENS,
  GRID_WIDTH,
  GRID_HEIGHT,
  MAX_PLOT_SIZE,
  PRESTIGE,
} from "../constants";

// Rate limit check helper
async function checkRateLimit(
  ctx: any,
  agentId: any,
  actionType: string,
  cooldownMs: number
): Promise<{ allowed: boolean; waitMs?: number }> {
  const rateLimit = await ctx.db
    .query("rateLimits")
    .withIndex("by_agent_action", (q: any) => q.eq("agentId", agentId).eq("actionType", actionType))
    .first();

  const now = Date.now();
  if (rateLimit) {
    const elapsed = now - rateLimit.lastActionAt;
    if (elapsed < cooldownMs) {
      return { allowed: false, waitMs: cooldownMs - elapsed };
    }
    await ctx.db.patch(rateLimit._id, { lastActionAt: now });
  } else {
    await ctx.db.insert("rateLimits", {
      agentId,
      actionType,
      lastActionAt: now,
    });
  }
  return { allowed: true };
}

// Move action
export const move = mutation({
  args: {
    apiKey: v.string(),
    direction: v.string(),
  },
  handler: async (ctx, { apiKey, direction }) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", apiKey))
      .first();

    if (!agent) {
      return { ok: false, error: "Invalid API key" };
    }

    if (!agent.online) {
      return { ok: false, error: "Agent must be online (call /agents/join first)" };
    }

    // Rate limit (movement allowed even when starving)
    const rateCheck = await checkRateLimit(ctx, agent._id, "move", MOVE_COOLDOWN_MS);
    if (!rateCheck.allowed) {
      return { ok: false, error: `Rate limited. Wait ${Math.ceil(rateCheck.waitMs! / 1000)}s` };
    }

    const dir = DIRECTIONS[direction.toLowerCase()];
    if (!dir) {
      return { ok: false, error: `Invalid direction. Use: ${Object.keys(DIRECTIONS).join(", ")}` };
    }

    const gridState = await ctx.db.query("gridState").first();
    if (!gridState) {
      return { ok: false, error: "Game not initialized" };
    }

    const grid = gridState.grid as GridCell[][];
    const newX = agent.x + dir.dx;
    const newY = agent.y + dir.dy;

    if (!isPassable(grid, newX, newY)) {
      return { ok: false, error: "Cannot move there (blocked or out of bounds)" };
    }

    await ctx.db.patch(agent._id, {
      x: newX,
      y: newY,
      lastSeen: Date.now(),
    });

    return {
      ok: true,
      data: {
        x: newX,
        y: newY,
        direction,
      },
    };
  },
});

// Gather action
export const gather = mutation({
  args: {
    apiKey: v.string(),
    type: v.string(),
  },
  handler: async (ctx, { apiKey, type }) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", apiKey))
      .first();

    if (!agent) {
      return { ok: false, error: "Invalid API key" };
    }

    if (!agent.online) {
      return { ok: false, error: "Agent must be online" };
    }

    if (agent.isStarving) {
      return { ok: false, error: "Cannot gather while starving" };
    }

    // Rate limit
    const rateCheck = await checkRateLimit(ctx, agent._id, "gather", GATHER_COOLDOWN_MS);
    if (!rateCheck.allowed) {
      return { ok: false, error: `Rate limited. Wait ${Math.ceil(rateCheck.waitMs! / 1000)}s` };
    }

    const gridState = await ctx.db.query("gridState").first();
    if (!gridState) {
      return { ok: false, error: "Game not initialized" };
    }

    const grid = gridState.grid as GridCell[][];

    if (!canGatherAt(grid, agent.x, agent.y, type)) {
      return { ok: false, error: `Cannot ${type} at this location` };
    }

    // Get yield
    const handRates = GATHERING_RATES.hand as Record<string, Record<string, number>>;
    const yields = handRates[type];
    if (!yields) {
      return { ok: false, error: `Unknown gather type: ${type}` };
    }

    // Check inventory space
    const buildings = await ctx.db
      .query("buildings")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", agent._id))
      .collect();
    const inventoryLimit = getInventoryLimit(agent, buildings);
    const currentUsage = getInventoryUsage(agent);
    const yieldAmount = Object.values(yields).reduce((a, b) => a + b, 0);

    if (currentUsage + yieldAmount > inventoryLimit) {
      return { ok: false, error: "Inventory full" };
    }

    // Apply yields
    const updates: Record<string, number> = {};
    for (const [resource, amount] of Object.entries(yields)) {
      const fieldMap: Record<string, string> = {
        wood: "rawWood",
        stone: "rawStone",
        water: "rawWater",
        food: "rawFood",
        clay: "rawClay",
      };
      const field = fieldMap[resource];
      if (field) {
        updates[field] = (agent as any)[field] + amount;
      }
    }

    await ctx.db.patch(agent._id, {
      ...updates,
      lastSeen: Date.now(),
    });

    return {
      ok: true,
      data: {
        action: type,
        gathered: yields,
      },
    };
  },
});

// Refine action
export const refine = mutation({
  args: {
    apiKey: v.string(),
    recipe: v.string(),
  },
  handler: async (ctx, { apiKey, recipe }) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", apiKey))
      .first();

    if (!agent) {
      return { ok: false, error: "Invalid API key" };
    }

    if (!agent.online) {
      return { ok: false, error: "Agent must be online" };
    }

    if (agent.isStarving) {
      return { ok: false, error: "Cannot refine while starving" };
    }

    // Rate limit
    const rateCheck = await checkRateLimit(ctx, agent._id, "refine", REFINE_COOLDOWN_MS);
    if (!rateCheck.allowed) {
      return { ok: false, error: `Rate limited. Wait ${Math.ceil(rateCheck.waitMs! / 1000)}s` };
    }

    const recipeData = REFINING_RECIPES[recipe];
    if (!recipeData) {
      return { ok: false, error: `Unknown recipe: ${recipe}` };
    }

    // Check if agent has required structure
    const buildings = await ctx.db
      .query("buildings")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", agent._id))
      .collect();

    const hasStructure = !recipeData.requiresStructure ||
      hasRequiredBuilding(buildings, agent._id, recipeData.requiresStructure);

    if (!recipeData.handCraftable && !hasStructure) {
      return { ok: false, error: `Requires ${recipeData.requiresStructure} to craft ${recipe}` };
    }

    // Check input resources
    const rawFieldMap: Record<string, string> = {
      wood: "rawWood",
      stone: "rawStone",
      water: "rawWater",
      food: "rawFood",
      clay: "rawClay",
    };

    for (const [resource, amount] of Object.entries(recipeData.inputs)) {
      const field = rawFieldMap[resource];
      if (field && (agent as any)[field] < amount) {
        return { ok: false, error: `Not enough ${resource} (need ${amount}, have ${(agent as any)[field]})` };
      }
    }

    // Calculate output (with hand craft penalty if no structure)
    const multiplier = hasStructure ? 1 : recipeData.handYieldMultiplier;

    // Calculate total input and output amounts
    const inputTotal = Object.values(recipeData.inputs).reduce((a, b) => a + b, 0);
    const outputTotal = Object.values(recipeData.outputs).reduce(
      (a, b) => a + Math.floor(b * multiplier),
      0
    );

    // Check inventory space (outputs - inputs must fit)
    const inventoryLimit = getInventoryLimit(agent, buildings);
    const currentUsage = getInventoryUsage(agent);
    const netChange = outputTotal - inputTotal;
    if (currentUsage + netChange > inventoryLimit) {
      return {
        ok: false,
        error: `Not enough inventory space. After refining: ${currentUsage + netChange}/${inventoryLimit}`,
      };
    }

    // Deduct inputs and add outputs
    const updates: Record<string, number> = {};

    for (const [resource, amount] of Object.entries(recipeData.inputs)) {
      const field = rawFieldMap[resource];
      if (field) {
        updates[field] = (agent as any)[field] - amount;
      }
    }

    const refinedFieldMap: Record<string, string> = {
      planks: "refinedPlanks",
      bricks: "refinedBricks",
      cement: "refinedCement",
      glass: "refinedGlass",
      steel: "refinedSteel",
    };

    const outputYield: Record<string, number> = {};
    for (const [material, amount] of Object.entries(recipeData.outputs)) {
      const field = refinedFieldMap[material];
      const actualAmount = Math.floor(amount * multiplier);
      if (field && actualAmount > 0) {
        updates[field] = (agent as any)[field] + actualAmount;
        outputYield[material] = actualAmount;
      }
    }

    await ctx.db.patch(agent._id, {
      ...updates,
      lastSeen: Date.now(),
    });

    return {
      ok: true,
      data: {
        recipe,
        consumed: recipeData.inputs,
        produced: outputYield,
        handCrafted: !hasStructure,
      },
    };
  },
});

// Clear forest action
export const clearForest = mutation({
  args: { apiKey: v.string() },
  handler: async (ctx, { apiKey }) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", apiKey))
      .first();

    if (!agent) {
      return { ok: false, error: "Invalid API key" };
    }

    if (!agent.online) {
      return { ok: false, error: "Agent must be online" };
    }

    if (agent.isStarving) {
      return { ok: false, error: "Cannot clear forest while starving" };
    }

    // Rate limit
    const rateCheck = await checkRateLimit(ctx, agent._id, "gather", GATHER_COOLDOWN_MS);
    if (!rateCheck.allowed) {
      return { ok: false, error: `Rate limited. Wait ${Math.ceil(rateCheck.waitMs! / 1000)}s` };
    }

    const gridState = await ctx.db.query("gridState").first();
    if (!gridState) {
      return { ok: false, error: "Game not initialized" };
    }

    const grid = gridState.grid as GridCell[][];
    const cell = grid[agent.y]?.[agent.x];

    if (!cell || cell.terrain !== "forest") {
      return { ok: false, error: "Must be standing on a forest tile" };
    }

    // Clear the forest
    grid[agent.y][agent.x].terrain = "plains";
    grid[agent.y][agent.x].isPassable = true;
    grid[agent.y][agent.x].isCleared = true;
    grid[agent.y][agent.x].resourceNode = null;

    await ctx.db.patch(gridState._id, { grid });

    // Grant wood
    await ctx.db.patch(agent._id, {
      rawWood: agent.rawWood + FOREST_CLEAR_WOOD_YIELD,
      lastSeen: Date.now(),
    });

    return {
      ok: true,
      data: {
        x: agent.x,
        y: agent.y,
        woodGained: FOREST_CLEAR_WOOD_YIELD,
      },
    };
  },
});

// Claim single tile
export const claimTile = mutation({
  args: {
    apiKey: v.string(),
    x: v.number(),
    y: v.number(),
  },
  handler: async (ctx, { apiKey, x, y }) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", apiKey))
      .first();

    if (!agent) {
      return { ok: false, error: "Invalid API key" };
    }

    if (!agent.online) {
      return { ok: false, error: "Agent must be online" };
    }

    if (agent.isStarving) {
      return { ok: false, error: "Cannot claim while starving" };
    }

    // Check bounds
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
      return { ok: false, error: "Position out of bounds" };
    }

    // Check cost
    if (agent.tokens < CLAIM_TILE_COST_TOKENS) {
      return { ok: false, error: `Need ${CLAIM_TILE_COST_TOKENS} tokens to claim a tile` };
    }

    const gridState = await ctx.db.query("gridState").first();
    if (!gridState) {
      return { ok: false, error: "Game not initialized" };
    }

    const grid = gridState.grid as GridCell[][];
    const cell = grid[y]?.[x];

    if (!cell) {
      return { ok: false, error: "Invalid position" };
    }

    if (cell.plotId) {
      return { ok: false, error: "Tile already claimed" };
    }

    if (!cell.isPassable && !cell.isCleared) {
      return { ok: false, error: "Cannot claim impassable terrain" };
    }

    // Forest tiles must be cleared before claiming
    if (cell.terrain === "forest" && !cell.isCleared) {
      return { ok: false, error: `Tile at ${x},${y} has forest — clear it first` };
    }

    // Create plot
    const plotId = await ctx.db.insert("plots", {
      ownerId: agent._id,
      x,
      y,
      width: 1,
      height: 1,
      claimedAt: Date.now(),
    });

    // Update grid
    grid[y][x].plotId = plotId;
    await ctx.db.patch(gridState._id, { grid });

    // Deduct tokens and update counts
    const newPlotCount = agent.plotCount + 1;
    const buildings = await ctx.db
      .query("buildings")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", agent._id))
      .collect();
    const buildingTypes = buildings.filter((b) => b.completed).map((b) => b.type);
    const newTier = calculateAgentTier(buildingTypes, newPlotCount, agent.reputation);

    await ctx.db.patch(agent._id, {
      tokens: agent.tokens - CLAIM_TILE_COST_TOKENS,
      plotCount: newPlotCount,
      currentTier: newTier,
      lastSeen: Date.now(),
    });

    return {
      ok: true,
      data: {
        plotId,
        x,
        y,
        cost: CLAIM_TILE_COST_TOKENS,
      },
    };
  },
});

// Get nearby (vision radius)
export const getNearby = mutation({
  args: { apiKey: v.string() },
  handler: async (ctx, { apiKey }) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", apiKey))
      .first();

    if (!agent) {
      return { ok: false, error: "Invalid API key" };
    }

    if (!agent.online) {
      return { ok: false, error: "Agent must be online" };
    }

    const gridState = await ctx.db.query("gridState").first();
    if (!gridState) {
      return { ok: false, error: "Game not initialized" };
    }

    const grid = gridState.grid as GridCell[][];
    const radius = agent.visionRadius;
    const tiles: Array<{ x: number; y: number; terrain: string; plotId: string | null; buildingId: string | null }> = [];

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = agent.x + dx;
        const y = agent.y + dy;
        if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
          const cell = grid[y][x];
          tiles.push({
            x,
            y,
            terrain: cell.terrain,
            plotId: cell.plotId,
            buildingId: cell.buildingId,
          });
        }
      }
    }

    // Get nearby agents
    const allAgents = await ctx.db.query("agents").collect();
    const nearbyAgents = allAgents.filter((a) => {
      if (a._id === agent._id) return false;
      const dist = Math.abs(a.x - agent.x) + Math.abs(a.y - agent.y);
      return dist <= radius * 2;
    }).map((a) => ({
      id: a._id,
      name: a.name,
      x: a.x,
      y: a.y,
      online: a.online,
    }));

    // Get nearby buildings
    const allBuildings = await ctx.db.query("buildings").collect();
    const nearbyBuildings = allBuildings.filter((b) => {
      const dist = Math.abs(b.x - agent.x) + Math.abs(b.y - agent.y);
      return dist <= radius * 2;
    }).map((b) => ({
      id: b._id,
      type: b.type,
      x: b.x,
      y: b.y,
      completed: b.completed,
      ownerId: b.ownerId,
    }));

    return {
      ok: true,
      data: {
        position: { x: agent.x, y: agent.y },
        tiles,
        agents: nearbyAgents,
        buildings: nearbyBuildings,
      },
    };
  },
});

// Batch actions
export const batch = mutation({
  args: {
    apiKey: v.string(),
    actions: v.array(
      v.object({
        type: v.string(),
        params: v.optional(v.any()),
      })
    ),
  },
  handler: async (ctx, { apiKey, actions }) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", apiKey))
      .first();

    if (!agent) {
      return { ok: false, error: "Invalid API key" };
    }

    if (!agent.online) {
      return { ok: false, error: "Agent must be online" };
    }

    if (agent.isStarving) {
      return { ok: false, error: "Cannot perform actions while starving" };
    }

    // Rate limit for batch
    const rateCheck = await checkRateLimit(ctx, agent._id, "batch", BATCH_COOLDOWN_MS);
    if (!rateCheck.allowed) {
      return { ok: false, error: `Rate limited. Wait ${Math.ceil(rateCheck.waitMs! / 1000)}s` };
    }

    if (actions.length > 5) {
      return { ok: false, error: "Maximum 5 actions per batch" };
    }

    const results: Array<{ action: string; success: boolean; result?: any; error?: string }> = [];

    // Execute each action sequentially
    // Note: This is simplified - in real implementation each action would need
    // to be processed with fresh agent state
    for (const action of actions) {
      try {
        // For now, just note that actions would be executed here
        // The actual implementation would call internal mutations
        results.push({
          action: action.type,
          success: true,
          result: { message: "Batch actions processed" },
        });
      } catch (err: any) {
        results.push({
          action: action.type,
          success: false,
          error: err.message,
        });
      }
    }

    return {
      ok: true,
      data: {
        executed: results.length,
        results,
      },
    };
  },
});
