import { query } from "../_generated/server";
import { v } from "convex/values";
import { toPublicAgent } from "../helpers";
import { MAX_CHAT_MESSAGES, MAX_ACTIVITY_ENTRIES } from "../constants";

// Get full spectator state (for real-time client subscription)
export const getSpectatorState = query({
  args: {},
  handler: async (ctx) => {
    // Get grid
    const gridState = await ctx.db.query("gridState").first();
    const grid = gridState?.grid || [];

    // Get all agents (public only)
    const agents = await ctx.db.query("agents").collect();
    const agentsMap: Record<string, any> = {};
    for (const agent of agents) {
      agentsMap[agent._id] = toPublicAgent(agent);
    }

    // Get all plots
    const plots = await ctx.db.query("plots").collect();
    const plotsMap: Record<string, any> = {};
    for (const plot of plots) {
      plotsMap[plot._id] = plot;
    }

    // Get all buildings
    const buildings = await ctx.db.query("buildings").collect();
    const buildingsMap: Record<string, any> = {};
    for (const building of buildings) {
      buildingsMap[building._id] = building;
    }

    // Get all clans
    const clans = await ctx.db.query("clans").collect();
    const clansMap: Record<string, any> = {};
    for (const clan of clans) {
      clansMap[clan._id] = clan;
    }

    // Get open trades
    const trades = await ctx.db
      .query("trades")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();
    const tradesMap: Record<string, any> = {};
    for (const trade of trades) {
      tradesMap[trade._id] = trade;
    }

    // Get active proposals
    const proposals = await ctx.db
      .query("proposals")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const proposalsMap: Record<string, any> = {};
    for (const proposal of proposals) {
      proposalsMap[proposal._id] = proposal;
    }

    // Get recent chat
    const chatMessages = await ctx.db
      .query("chatMessages")
      .withIndex("by_timestamp")
      .order("desc")
      .take(MAX_CHAT_MESSAGES);
    const chat = chatMessages.reverse();

    // Get recent activity
    const activityEntries = await ctx.db
      .query("activity")
      .withIndex("by_timestamp")
      .order("desc")
      .take(MAX_ACTIVITY_ENTRIES);
    const activity = activityEntries.reverse();

    // Get world events
    const worldEvents = await ctx.db.query("worldEvents").collect();

    // Get milestones
    const milestones = await ctx.db.query("milestones").collect();

    // Get game meta
    const tickMeta = await ctx.db
      .query("gameMeta")
      .withIndex("by_key", (q) => q.eq("key", "tick"))
      .first();
    const treasuryMeta = await ctx.db
      .query("gameMeta")
      .withIndex("by_key", (q) => q.eq("key", "publicTreasury"))
      .first();

    const tick = tickMeta ? parseInt(tickMeta.value) : 0;
    const publicTreasury = treasuryMeta ? parseFloat(treasuryMeta.value) : 0;

    return {
      grid,
      agents: agentsMap,
      plots: plotsMap,
      buildings: buildingsMap,
      clans: clansMap,
      trades: tradesMap,
      proposals: proposalsMap,
      chat,
      activity,
      worldEvents,
      milestones,
      tick,
      publicTreasury,
    };
  },
});

// Get town stats
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect();
    const buildings = await ctx.db.query("buildings").collect();
    const plots = await ctx.db.query("plots").collect();
    const clans = await ctx.db.query("clans").collect();

    const openTrades = await ctx.db
      .query("trades")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();

    const activeProposals = await ctx.db
      .query("proposals")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const worldEvents = await ctx.db.query("worldEvents").collect();
    const milestones = await ctx.db.query("milestones").collect();

    const tickMeta = await ctx.db
      .query("gameMeta")
      .withIndex("by_key", (q) => q.eq("key", "tick"))
      .first();
    const treasuryMeta = await ctx.db
      .query("gameMeta")
      .withIndex("by_key", (q) => q.eq("key", "publicTreasury"))
      .first();

    // Calculate world GDP (sum of all tokens)
    let worldGDP = 0;
    for (const agent of agents) {
      worldGDP += agent.tokens;
    }
    for (const clan of clans) {
      worldGDP += clan.treasuryTokens;
    }
    worldGDP += treasuryMeta ? parseFloat(treasuryMeta.value) : 0;

    return {
      population: agents.length,
      onlineCount: agents.filter((a) => a.online).length,
      buildings: buildings.length,
      completedBuildings: buildings.filter((b) => b.completed).length,
      plots: plots.length,
      clans: clans.length,
      activeTrades: openTrades.length,
      activeProposals: activeProposals.length,
      tick: tickMeta ? parseInt(tickMeta.value) : 0,
      worldGDP,
      publicTreasury: treasuryMeta ? parseFloat(treasuryMeta.value) : 0,
      activeEvents: worldEvents.filter(
        (e) => e.startTick <= (tickMeta ? parseInt(tickMeta.value) : 0) && e.endTick > (tickMeta ? parseInt(tickMeta.value) : 0)
      ),
      milestones,
    };
  },
});

// Get map (grid only)
export const getMap = query({
  args: {},
  handler: async (ctx) => {
    const gridState = await ctx.db.query("gridState").first();
    return gridState?.grid || [];
  },
});

// Get activity feed
export const getActivity = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 100 }) => {
    const activity = await ctx.db
      .query("activity")
      .withIndex("by_timestamp")
      .order("desc")
      .take(Math.min(limit, MAX_ACTIVITY_ENTRIES));

    return activity.reverse();
  },
});

// Get world events
export const getEvents = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("worldEvents").collect();
  },
});

// Get milestones
export const getMilestones = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("milestones").collect();
  },
});

// Get public treasury
export const getTreasury = query({
  args: {},
  handler: async (ctx) => {
    const treasuryMeta = await ctx.db
      .query("gameMeta")
      .withIndex("by_key", (q) => q.eq("key", "publicTreasury"))
      .first();

    return {
      balance: treasuryMeta ? parseFloat(treasuryMeta.value) : 0,
    };
  },
});
