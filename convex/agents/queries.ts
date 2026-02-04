import { query } from "../_generated/server";
import { v } from "convex/values";
import { toPublicAgent } from "../helpers";

// Get agent by API key (for authentication)
export const getByApiKey = query({
  args: { apiKey: v.string() },
  handler: async (ctx, { apiKey }) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", apiKey))
      .first();
    return agent;
  },
});

// Get agent by name
export const getByName = query({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();
    return agent;
  },
});

// Get agent by ID
export const getById = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    return await ctx.db.get(agentId);
  },
});

// Get all public agents (no API keys)
export const getAllPublic = query({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect();
    return agents.map(toPublicAgent);
  },
});

// Get leaderboard (top agents by reputation)
export const getLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 50 }) => {
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_reputation")
      .order("desc")
      .take(limit);
    return agents.map(toPublicAgent);
  },
});

// Get agent's full data (for /agents/me endpoint)
export const getMe = query({
  args: { apiKey: v.string() },
  handler: async (ctx, { apiKey }) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", apiKey))
      .first();

    if (!agent) return null;

    // Get agent's plots
    const plots = await ctx.db
      .query("plots")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", agent._id))
      .collect();

    // Get agent's buildings
    const buildings = await ctx.db
      .query("buildings")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", agent._id))
      .collect();

    // Get notifications
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_agent_read", (q) => q.eq("agentId", agent._id).eq("read", false))
      .collect();

    // Calculate inventory
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

    // Calculate pending resources from buildings
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

    return {
      id: agent._id,
      name: agent.name,
      color: agent.color,
      x: agent.x,
      y: agent.y,
      inventory,
      pending,
      reputation: agent.reputation,
      personality: agent.personality,
      inventoryLimit: agent.inventoryLimit,
      currentTier: agent.currentTier,
      isStarving: agent.isStarving,
      visionRadius: agent.visionRadius,
      clanId: agent.clanId,
      joinedAt: agent.joinedAt,
      lastSeen: agent.lastSeen,
      plotCount: agent.plotCount,
      buildingCount: agent.buildingCount,
      online: agent.online,
      plots,
      buildings,
      unreadNotifications: notifications.length,
    };
  },
});

// Get agent's notifications
export const getNotifications = query({
  args: { apiKey: v.string() },
  handler: async (ctx, { apiKey }) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", apiKey))
      .first();

    if (!agent) return [];

    return await ctx.db
      .query("notifications")
      .withIndex("by_agent_read", (q) => q.eq("agentId", agent._id).eq("read", false))
      .collect();
  },
});

// Get agent count
export const getCount = query({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect();
    return agents.length;
  },
});

// Get online agent count
export const getOnlineCount = query({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect();
    return agents.filter((a) => a.online).length;
  },
});
