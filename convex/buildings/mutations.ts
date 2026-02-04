import { mutation } from "../_generated/server";
import { v } from "convex/values";
import {
  GridCell,
  isAreaFree,
  markBuildingOnGrid,
  clearBuildingFromGrid,
  hasRequiredBuilding,
  hasWorkshopDiscount,
  calculateAgentTier,
} from "../helpers";
import {
  BUILDING_DEFINITIONS,
  BUILD_COOLDOWN_MS,
  PRESTIGE,
  RENT_CONTRACTS,
  DESERT_BUILD_COST_MULTIPLIER,
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

// Place a building
export const place = mutation({
  args: {
    apiKey: v.string(),
    type: v.string(),
    plotId: v.id("plots"),
    x: v.number(),
    y: v.number(),
    inscription: v.optional(v.string()),
  },
  handler: async (ctx, { apiKey, type, plotId, x, y, inscription }) => {
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
      return { ok: false, error: "Cannot build while starving" };
    }

    // Rate limit
    const rateCheck = await checkRateLimit(ctx, agent._id, "build", BUILD_COOLDOWN_MS);
    if (!rateCheck.allowed) {
      return { ok: false, error: `Rate limited. Wait ${Math.ceil(rateCheck.waitMs! / 1000)}s` };
    }

    const definition = BUILDING_DEFINITIONS[type];
    if (!definition) {
      return { ok: false, error: `Unknown building type: ${type}` };
    }

    // Check tier requirement
    if (definition.tier > agent.currentTier + 1) {
      return { ok: false, error: `Building requires Tier ${definition.tier - 1}. You are Tier ${agent.currentTier}` };
    }

    // Check plot ownership
    const plot = await ctx.db.get(plotId);
    if (!plot) {
      return { ok: false, error: "Plot not found" };
    }

    if (plot.ownerId !== agent._id) {
      return { ok: false, error: "You don't own this plot" };
    }

    // Get all agent buildings for gate requirements
    const agentBuildings = await ctx.db
      .query("buildings")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", agent._id))
      .collect();

    // Check gate requirement
    if (definition.gateRequirement) {
      if (!hasRequiredBuilding(agentBuildings, agent._id, definition.gateRequirement)) {
        return { ok: false, error: `Requires ${definition.gateRequirement} to build ${type}` };
      }
    }

    // Check reputation gate
    if (definition.reputationGate && agent.reputation < definition.reputationGate) {
      return { ok: false, error: `Requires ${definition.reputationGate} reputation to build ${type}` };
    }

    // Check position is within plot
    if (
      x < plot.x ||
      y < plot.y ||
      x + definition.width > plot.x + plot.width ||
      y + definition.height > plot.y + plot.height
    ) {
      return { ok: false, error: "Building must fit within the plot" };
    }

    const gridState = await ctx.db.query("gridState").first();
    if (!gridState) {
      return { ok: false, error: "Game not initialized" };
    }

    const grid = gridState.grid as GridCell[][];

    // Check area is free
    if (!isAreaFree(grid, x, y, definition.width, definition.height)) {
      return { ok: false, error: "Area is not free" };
    }

    // Calculate cost (with workshop discount)
    const workshopDiscount = hasWorkshopDiscount(agentBuildings, agent._id) ? 0.9 : 1;

    // Check for desert terrain (1.5x cost)
    let terrainMultiplier = 1;
    for (let dy = 0; dy < definition.height; dy++) {
      for (let dx = 0; dx < definition.width; dx++) {
        if (grid[y + dy]?.[x + dx]?.terrain === "desert") {
          terrainMultiplier = DESERT_BUILD_COST_MULTIPLIER;
          break;
        }
      }
    }

    const costMultiplier = workshopDiscount * terrainMultiplier;

    // Check resources
    for (const [resource, amount] of Object.entries(definition.cost.raw)) {
      const fieldMap: Record<string, string> = {
        wood: "rawWood",
        stone: "rawStone",
        water: "rawWater",
        food: "rawFood",
        clay: "rawClay",
      };
      const field = fieldMap[resource];
      const needed = Math.ceil((amount as number) * costMultiplier);
      if (field && (agent as any)[field] < needed) {
        return { ok: false, error: `Not enough ${resource} (need ${needed})` };
      }
    }

    for (const [material, amount] of Object.entries(definition.cost.refined)) {
      const fieldMap: Record<string, string> = {
        planks: "refinedPlanks",
        bricks: "refinedBricks",
        cement: "refinedCement",
        glass: "refinedGlass",
        steel: "refinedSteel",
      };
      const field = fieldMap[material];
      const needed = Math.ceil((amount as number) * costMultiplier);
      if (field && (agent as any)[field] < needed) {
        return { ok: false, error: `Not enough ${material} (need ${needed})` };
      }
    }

    const tokenCost = Math.ceil(definition.cost.tokens * costMultiplier);
    if (agent.tokens < tokenCost) {
      return { ok: false, error: `Not enough tokens (need ${tokenCost})` };
    }

    // Deduct resources
    const updates: Record<string, number> = {};

    for (const [resource, amount] of Object.entries(definition.cost.raw)) {
      const fieldMap: Record<string, string> = {
        wood: "rawWood",
        stone: "rawStone",
        water: "rawWater",
        food: "rawFood",
        clay: "rawClay",
      };
      const field = fieldMap[resource];
      const cost = Math.ceil((amount as number) * costMultiplier);
      if (field) {
        updates[field] = (agent as any)[field] - cost;
      }
    }

    for (const [material, amount] of Object.entries(definition.cost.refined)) {
      const fieldMap: Record<string, string> = {
        planks: "refinedPlanks",
        bricks: "refinedBricks",
        cement: "refinedCement",
        glass: "refinedGlass",
        steel: "refinedSteel",
      };
      const field = fieldMap[material];
      const cost = Math.ceil((amount as number) * costMultiplier);
      if (field) {
        updates[field] = (agent as any)[field] - cost;
      }
    }

    updates.tokens = agent.tokens - tokenCost;

    // Create building
    const buildingId = await ctx.db.insert("buildings", {
      type,
      tier: definition.tier,
      ownerId: agent._id,
      plotId,
      x,
      y,
      width: definition.width,
      height: definition.height,
      level: 1,
      progress: 0,
      completed: false,
      startedAt: Date.now(),
      completedAt: undefined,
      durability: definition.durability,
      maxDurability: definition.maxDurability,
      decayRate: definition.decayRate,
      tokenIncome: definition.tokenIncome,
      rentContractType: undefined,
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
      lastCollection: Date.now(),
      inscription: inscription || undefined,
      contributors: undefined,
    });

    // Mark on grid
    for (let dy = 0; dy < definition.height; dy++) {
      for (let dx = 0; dx < definition.width; dx++) {
        grid[y + dy][x + dx].buildingId = buildingId;
      }
    }
    await ctx.db.patch(gridState._id, { grid });

    // Update agent
    const newBuildingCount = agent.buildingCount + 1;
    const allBuildings = [...agentBuildings, { type, completed: false }];
    const buildingTypes = allBuildings.filter((b) => b.completed).map((b) => b.type);
    const newTier = calculateAgentTier(buildingTypes, agent.plotCount, agent.reputation);

    await ctx.db.patch(agent._id, {
      ...updates,
      buildingCount: newBuildingCount,
      currentTier: newTier,
      lastSeen: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activity", {
      type: "building_placed",
      agentId: agent._id,
      agentName: agent.name,
      description: `${agent.name} started building a ${type}`,
      timestamp: Date.now(),
    });

    return {
      ok: true,
      data: {
        buildingId,
        type,
        x,
        y,
        width: definition.width,
        height: definition.height,
        buildTime: definition.buildTime,
      },
    };
  },
});

// Upgrade building
export const upgrade = mutation({
  args: {
    apiKey: v.string(),
    buildingId: v.id("buildings"),
  },
  handler: async (ctx, { apiKey, buildingId }) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", apiKey))
      .first();

    if (!agent) {
      return { ok: false, error: "Invalid API key" };
    }

    const building = await ctx.db.get(buildingId);
    if (!building) {
      return { ok: false, error: "Building not found" };
    }

    if (building.ownerId !== agent._id) {
      return { ok: false, error: "You don't own this building" };
    }

    if (!building.completed) {
      return { ok: false, error: "Building must be completed first" };
    }

    const definition = BUILDING_DEFINITIONS[building.type];
    if (!definition) {
      return { ok: false, error: "Unknown building type" };
    }

    if (building.level >= definition.maxLevel) {
      return { ok: false, error: `Building is already at max level (${definition.maxLevel})` };
    }

    // Upgrade costs 50% of base cost per level
    const costMultiplier = 0.5 * building.level;

    // Check resources
    for (const [resource, amount] of Object.entries(definition.cost.raw)) {
      const fieldMap: Record<string, string> = {
        wood: "rawWood",
        stone: "rawStone",
        water: "rawWater",
        food: "rawFood",
        clay: "rawClay",
      };
      const field = fieldMap[resource];
      const needed = Math.ceil((amount as number) * costMultiplier);
      if (field && (agent as any)[field] < needed) {
        return { ok: false, error: `Not enough ${resource} (need ${needed})` };
      }
    }

    for (const [material, amount] of Object.entries(definition.cost.refined)) {
      const fieldMap: Record<string, string> = {
        planks: "refinedPlanks",
        bricks: "refinedBricks",
        cement: "refinedCement",
        glass: "refinedGlass",
        steel: "refinedSteel",
      };
      const field = fieldMap[material];
      const needed = Math.ceil((amount as number) * costMultiplier);
      if (field && (agent as any)[field] < needed) {
        return { ok: false, error: `Not enough ${material} (need ${needed})` };
      }
    }

    const tokenCost = Math.ceil(definition.cost.tokens * costMultiplier);
    if (agent.tokens < tokenCost) {
      return { ok: false, error: `Not enough tokens (need ${tokenCost})` };
    }

    // Deduct resources
    const updates: Record<string, number> = {};

    for (const [resource, amount] of Object.entries(definition.cost.raw)) {
      const fieldMap: Record<string, string> = {
        wood: "rawWood",
        stone: "rawStone",
        water: "rawWater",
        food: "rawFood",
        clay: "rawClay",
      };
      const field = fieldMap[resource];
      const cost = Math.ceil((amount as number) * costMultiplier);
      if (field) {
        updates[field] = (agent as any)[field] - cost;
      }
    }

    for (const [material, amount] of Object.entries(definition.cost.refined)) {
      const fieldMap: Record<string, string> = {
        planks: "refinedPlanks",
        bricks: "refinedBricks",
        cement: "refinedCement",
        glass: "refinedGlass",
        steel: "refinedSteel",
      };
      const field = fieldMap[material];
      const cost = Math.ceil((amount as number) * costMultiplier);
      if (field) {
        updates[field] = (agent as any)[field] - cost;
      }
    }

    updates.tokens = agent.tokens - tokenCost;
    updates.reputation = agent.reputation + PRESTIGE.UPGRADE;

    await ctx.db.patch(agent._id, updates);

    // Upgrade building
    const newLevel = building.level + 1;
    await ctx.db.patch(buildingId, {
      level: newLevel,
      tokenIncome: definition.tokenIncome * newLevel,
    });

    // Log activity
    await ctx.db.insert("activity", {
      type: "building_upgraded",
      agentId: agent._id,
      agentName: agent.name,
      description: `${agent.name} upgraded ${building.type} to level ${newLevel}`,
      timestamp: Date.now(),
    });

    return {
      ok: true,
      data: {
        buildingId,
        newLevel,
        reputationGained: PRESTIGE.UPGRADE,
      },
    };
  },
});

// Demolish building
export const demolish = mutation({
  args: {
    apiKey: v.string(),
    buildingId: v.id("buildings"),
  },
  handler: async (ctx, { apiKey, buildingId }) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", apiKey))
      .first();

    if (!agent) {
      return { ok: false, error: "Invalid API key" };
    }

    const building = await ctx.db.get(buildingId);
    if (!building) {
      return { ok: false, error: "Building not found" };
    }

    if (building.ownerId !== agent._id) {
      return { ok: false, error: "You don't own this building" };
    }

    const definition = BUILDING_DEFINITIONS[building.type];

    // Return 50% of resources
    const refundMultiplier = 0.5;
    const refund: Record<string, number> = {};

    for (const [resource, amount] of Object.entries(definition.cost.raw)) {
      const fieldMap: Record<string, string> = {
        wood: "rawWood",
        stone: "rawStone",
        water: "rawWater",
        food: "rawFood",
        clay: "rawClay",
      };
      const field = fieldMap[resource];
      const refundAmount = Math.floor((amount as number) * refundMultiplier);
      if (field && refundAmount > 0) {
        refund[field] = (agent as any)[field] + refundAmount;
      }
    }

    for (const [material, amount] of Object.entries(definition.cost.refined)) {
      const fieldMap: Record<string, string> = {
        planks: "refinedPlanks",
        bricks: "refinedBricks",
        cement: "refinedCement",
        glass: "refinedGlass",
        steel: "refinedSteel",
      };
      const field = fieldMap[material];
      const refundAmount = Math.floor((amount as number) * refundMultiplier);
      if (field && refundAmount > 0) {
        refund[field] = (agent as any)[field] + refundAmount;
      }
    }

    const tokenRefund = Math.floor(definition.cost.tokens * refundMultiplier);
    refund.tokens = agent.tokens + tokenRefund;

    // Clear from grid
    const gridState = await ctx.db.query("gridState").first();
    if (gridState) {
      const grid = gridState.grid as GridCell[][];
      clearBuildingFromGrid(grid, building);
      await ctx.db.patch(gridState._id, { grid });
    }

    // Delete building
    await ctx.db.delete(buildingId);

    // Update agent
    await ctx.db.patch(agent._id, {
      ...refund,
      buildingCount: Math.max(0, agent.buildingCount - 1),
      lastSeen: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activity", {
      type: "building_demolished",
      agentId: agent._id,
      agentName: agent.name,
      description: `${agent.name} demolished a ${building.type}`,
      timestamp: Date.now(),
    });

    return {
      ok: true,
      data: {
        buildingId,
        tokensRefunded: tokenRefund,
      },
    };
  },
});

// Repair building
export const repair = mutation({
  args: {
    apiKey: v.string(),
    buildingId: v.id("buildings"),
  },
  handler: async (ctx, { apiKey, buildingId }) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", apiKey))
      .first();

    if (!agent) {
      return { ok: false, error: "Invalid API key" };
    }

    const building = await ctx.db.get(buildingId);
    if (!building) {
      return { ok: false, error: "Building not found" };
    }

    if (building.ownerId !== agent._id) {
      return { ok: false, error: "You don't own this building" };
    }

    if (building.durability >= building.maxDurability) {
      return { ok: false, error: "Building is already at full durability" };
    }

    const definition = BUILDING_DEFINITIONS[building.type];

    // Repair costs 25% of raw resources (no refined or tokens)
    const costMultiplier = 0.25;
    const costs: Record<string, number> = {};

    for (const [resource, amount] of Object.entries(definition.cost.raw)) {
      const fieldMap: Record<string, string> = {
        wood: "rawWood",
        stone: "rawStone",
        water: "rawWater",
        food: "rawFood",
        clay: "rawClay",
      };
      const field = fieldMap[resource];
      const needed = Math.ceil((amount as number) * costMultiplier);
      if (field && needed > 0) {
        if ((agent as any)[field] < needed) {
          return { ok: false, error: `Not enough ${resource} (need ${needed})` };
        }
        costs[field] = (agent as any)[field] - needed;
      }
    }

    // Apply costs and repair
    await ctx.db.patch(agent._id, {
      ...costs,
      lastSeen: Date.now(),
    });

    await ctx.db.patch(buildingId, {
      durability: building.maxDurability,
    });

    return {
      ok: true,
      data: {
        buildingId,
        newDurability: building.maxDurability,
      },
    };
  },
});

// Set rent contract
export const setRentContract = mutation({
  args: {
    apiKey: v.string(),
    buildingId: v.id("buildings"),
    contractType: v.string(),
  },
  handler: async (ctx, { apiKey, buildingId, contractType }) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", apiKey))
      .first();

    if (!agent) {
      return { ok: false, error: "Invalid API key" };
    }

    const building = await ctx.db.get(buildingId);
    if (!building) {
      return { ok: false, error: "Building not found" };
    }

    if (building.ownerId !== agent._id) {
      return { ok: false, error: "You don't own this building" };
    }

    if (!building.completed) {
      return { ok: false, error: "Building must be completed" };
    }

    const definition = BUILDING_DEFINITIONS[building.type];
    if (!definition.residential) {
      return { ok: false, error: "Only residential buildings can have rent contracts" };
    }

    const contract = RENT_CONTRACTS[contractType as keyof typeof RENT_CONTRACTS];
    if (!contract) {
      return { ok: false, error: `Invalid contract type. Use: ${Object.keys(RENT_CONTRACTS).join(", ")}` };
    }

    await ctx.db.patch(buildingId, {
      rentContractType: contractType,
      rentTicksRemaining: contract.ticks,
    });

    return {
      ok: true,
      data: {
        buildingId,
        contractType,
        ticks: contract.ticks,
        incomeMultiplier: contract.incomeMultiplier,
      },
    };
  },
});
