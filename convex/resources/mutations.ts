import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getInventoryUsage, getInventoryLimit } from "../helpers";

// Get resources (inventory + pending)
export const getResources = mutation({
  args: { apiKey: v.string() },
  handler: async (ctx, { apiKey }) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", apiKey))
      .first();

    if (!agent) {
      return { ok: false, error: "Invalid API key" };
    }

    // Get agent's buildings for pending resources
    const buildings = await ctx.db
      .query("buildings")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", agent._id))
      .collect();

    const inventory = {
      raw: {
        wood: agent.rawWood,
        stone: agent.rawStone,
        water: agent.rawWater,
        food: agent.rawFood,
        clay: agent.rawClay,
      },
      refined: {
        planks: agent.refinedPlanks,
        bricks: agent.refinedBricks,
        cement: agent.refinedCement,
        glass: agent.refinedGlass,
        steel: agent.refinedSteel,
      },
      tokens: agent.tokens,
    };

    const pending = {
      raw: { wood: 0, stone: 0, water: 0, food: 0, clay: 0 },
      refined: { planks: 0, bricks: 0, cement: 0, glass: 0, steel: 0 },
      tokens: 0,
    };

    for (const building of buildings) {
      if (building.completed) {
        pending.raw.wood += building.pendingRawWood;
        pending.raw.stone += building.pendingRawStone;
        pending.raw.water += building.pendingRawWater;
        pending.raw.food += building.pendingRawFood;
        pending.raw.clay += building.pendingRawClay;
        pending.refined.planks += building.pendingRefinedPlanks;
        pending.refined.bricks += building.pendingRefinedBricks;
        pending.refined.cement += building.pendingRefinedCement;
        pending.refined.glass += building.pendingRefinedGlass;
        pending.refined.steel += building.pendingRefinedSteel;
        pending.tokens += building.pendingTokens;
      }
    }

    const usage = getInventoryUsage(agent);
    const limit = getInventoryLimit(agent, buildings);

    return {
      ok: true,
      data: {
        inventory,
        pending,
        usage,
        limit,
        free: limit - usage,
      },
    };
  },
});

// Collect all pending resources from buildings
export const collect = mutation({
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

    // Get all completed buildings owned by agent
    const buildings = await ctx.db
      .query("buildings")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", agent._id))
      .collect();

    const completedBuildings = buildings.filter((b) => b.completed);

    // Calculate totals to collect
    let totalRawWood = 0;
    let totalRawStone = 0;
    let totalRawWater = 0;
    let totalRawFood = 0;
    let totalRawClay = 0;
    let totalRefinedPlanks = 0;
    let totalRefinedBricks = 0;
    let totalRefinedCement = 0;
    let totalRefinedGlass = 0;
    let totalRefinedSteel = 0;
    let totalTokens = 0;

    for (const building of completedBuildings) {
      totalRawWood += building.pendingRawWood;
      totalRawStone += building.pendingRawStone;
      totalRawWater += building.pendingRawWater;
      totalRawFood += building.pendingRawFood;
      totalRawClay += building.pendingRawClay;
      totalRefinedPlanks += building.pendingRefinedPlanks;
      totalRefinedBricks += building.pendingRefinedBricks;
      totalRefinedCement += building.pendingRefinedCement;
      totalRefinedGlass += building.pendingRefinedGlass;
      totalRefinedSteel += building.pendingRefinedSteel;
      totalTokens += building.pendingTokens;
    }

    // Check inventory space for resources (not tokens)
    const inventoryLimit = getInventoryLimit(agent, buildings);
    const currentUsage = getInventoryUsage(agent);
    const resourceTotal =
      totalRawWood +
      totalRawStone +
      totalRawWater +
      totalRawFood +
      totalRawClay +
      totalRefinedPlanks +
      totalRefinedBricks +
      totalRefinedCement +
      totalRefinedGlass +
      totalRefinedSteel;

    if (currentUsage + resourceTotal > inventoryLimit) {
      // Collect what we can (prioritize food)
      const available = inventoryLimit - currentUsage;

      // For simplicity, just warn the user
      if (available <= 0) {
        return { ok: false, error: "Inventory full. Build storage_shed or warehouse for more capacity." };
      }
    }

    // Clear pending from all buildings
    const now = Date.now();
    for (const building of completedBuildings) {
      await ctx.db.patch(building._id, {
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
      });
    }

    // Add to agent inventory
    await ctx.db.patch(agent._id, {
      rawWood: agent.rawWood + totalRawWood,
      rawStone: agent.rawStone + totalRawStone,
      rawWater: agent.rawWater + totalRawWater,
      rawFood: agent.rawFood + totalRawFood,
      rawClay: agent.rawClay + totalRawClay,
      refinedPlanks: agent.refinedPlanks + totalRefinedPlanks,
      refinedBricks: agent.refinedBricks + totalRefinedBricks,
      refinedCement: agent.refinedCement + totalRefinedCement,
      refinedGlass: agent.refinedGlass + totalRefinedGlass,
      refinedSteel: agent.refinedSteel + totalRefinedSteel,
      tokens: agent.tokens + totalTokens,
      lastSeen: now,
    });

    return {
      ok: true,
      data: {
        collected: {
          raw: {
            wood: totalRawWood,
            stone: totalRawStone,
            water: totalRawWater,
            food: totalRawFood,
            clay: totalRawClay,
          },
          refined: {
            planks: totalRefinedPlanks,
            bricks: totalRefinedBricks,
            cement: totalRefinedCement,
            glass: totalRefinedGlass,
            steel: totalRefinedSteel,
          },
          tokens: totalTokens,
        },
        fromBuildings: completedBuildings.length,
      },
    };
  },
});
