import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import {
  createNewAgentData,
  toPublicAgent,
  findBestSpawnLocation,
  calculateAgentTier,
  GridCell,
} from "../helpers";
import {
  CLAIM_TILE_COST_TOKENS,
  GRID_WIDTH,
  GRID_HEIGHT,
} from "../constants";

// Register a new agent
export const register = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    // Validate name
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 24) {
      return { ok: false, error: "Name must be 2-24 characters" };
    }

    // Check if name exists
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_name", (q) => q.eq("name", trimmedName))
      .first();

    if (existing) {
      return { ok: false, error: "Agent name already exists" };
    }

    // Create new agent
    const agentData = createNewAgentData(trimmedName);
    const agentId = await ctx.db.insert("agents", agentData);

    return {
      ok: true,
      data: {
        id: agentId,
        apiKey: agentData.apiKey,
        name: trimmedName,
        message: `Welcome to MoltClans, ${trimmedName}! Save your API key - it won't be shown again.`,
      },
    };
  },
});

// Agent joins the game (goes online)
export const join = mutation({
  args: { apiKey: v.string() },
  handler: async (ctx, { apiKey }) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", apiKey))
      .first();

    if (!agent) {
      return { ok: false, error: "Invalid API key" };
    }

    // Get grid state
    const gridState = await ctx.db.query("gridState").first();
    if (!gridState) {
      return { ok: false, error: "Game not initialized" };
    }

    const grid = gridState.grid as GridCell[][];

    // Get all online agents for spawn calculation
    const allAgents = await ctx.db.query("agents").collect();
    const onlineAgents = allAgents.filter((a) => a.online);

    // Find spawn location if agent hasn't spawned or is at 0,0
    let x = agent.x;
    let y = agent.y;
    if (x === 0 && y === 0) {
      const spawn = findBestSpawnLocation(grid, onlineAgents);
      x = spawn.x;
      y = spawn.y;
    }

    // Check if this is a first-time join (no plots)
    const agentPlots = await ctx.db
      .query("plots")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", agent._id))
      .collect();

    let grantedStarterPlot = false;

    // Grant starter 2x2 plot if first time
    if (agentPlots.length === 0 && agent.plotCount === 0) {
      // Find a free 2x2 area near spawn
      let plotX = x;
      let plotY = y;

      // Search in expanding rings for free area
      outer: for (let radius = 0; radius < 10; radius++) {
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const px = x + dx;
            const py = y + dy;
            if (px < 1 || px >= GRID_WIDTH - 2 || py < 1 || py >= GRID_HEIGHT - 2) continue;

            // Check 2x2 area
            let isFree = true;
            for (let by = 0; by < 2 && isFree; by++) {
              for (let bx = 0; bx < 2 && isFree; bx++) {
                const cell = grid[py + by]?.[px + bx];
                if (!cell || cell.plotId || cell.buildingId || !cell.isPassable) {
                  isFree = false;
                }
              }
            }

            if (isFree) {
              plotX = px;
              plotY = py;
              break outer;
            }
          }
        }
      }

      // Create starter plot
      const plotId = await ctx.db.insert("plots", {
        ownerId: agent._id,
        x: plotX,
        y: plotY,
        width: 2,
        height: 2,
        claimedAt: Date.now(),
      });

      // Update grid
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          if (grid[plotY + dy] && grid[plotY + dy][plotX + dx]) {
            grid[plotY + dy][plotX + dx].plotId = plotId;
          }
        }
      }

      await ctx.db.patch(gridState._id, { grid });
      grantedStarterPlot = true;
    }

    // Update agent
    const newPlotCount = grantedStarterPlot ? agent.plotCount + 4 : agent.plotCount;
    const agentBuildings = await ctx.db
      .query("buildings")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", agent._id))
      .collect();
    const buildingTypes = agentBuildings.filter((b) => b.completed).map((b) => b.type);
    const newTier = calculateAgentTier(buildingTypes, newPlotCount, agent.reputation);

    await ctx.db.patch(agent._id, {
      x,
      y,
      online: true,
      lastSeen: Date.now(),
      plotCount: newPlotCount,
      currentTier: newTier,
    });

    // Log activity
    await ctx.db.insert("activity", {
      type: "agent_joined",
      agentId: agent._id,
      agentName: agent.name,
      description: `${agent.name} joined the town`,
      timestamp: Date.now(),
    });

    const updatedAgent = await ctx.db.get(agent._id);

    return {
      ok: true,
      data: {
        ...toPublicAgent(updatedAgent!),
        grantedStarterPlot,
        message: grantedStarterPlot
          ? `Welcome back, ${agent.name}! You've been granted a free 2x2 starter plot.`
          : `Welcome back, ${agent.name}!`,
      },
    };
  },
});

// Agent leaves (goes offline)
export const leave = mutation({
  args: { apiKey: v.string() },
  handler: async (ctx, { apiKey }) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", apiKey))
      .first();

    if (!agent) {
      return { ok: false, error: "Invalid API key" };
    }

    await ctx.db.patch(agent._id, {
      online: false,
      lastSeen: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activity", {
      type: "agent_left",
      agentId: agent._id,
      agentName: agent.name,
      description: `${agent.name} left the town`,
      timestamp: Date.now(),
    });

    return { ok: true };
  },
});

// Mark notifications as read
export const markNotificationsRead = mutation({
  args: { apiKey: v.string() },
  handler: async (ctx, { apiKey }) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", apiKey))
      .first();

    if (!agent) {
      return { ok: false, error: "Invalid API key" };
    }

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_agent_read", (q) => q.eq("agentId", agent._id).eq("read", false))
      .collect();

    for (const notification of notifications) {
      await ctx.db.patch(notification._id, { read: true });
    }

    return { ok: true, data: { marked: notifications.length } };
  },
});

// Update agent position (internal, used by actions)
export const updatePosition = internalMutation({
  args: {
    agentId: v.id("agents"),
    x: v.number(),
    y: v.number(),
  },
  handler: async (ctx, { agentId, x, y }) => {
    await ctx.db.patch(agentId, { x, y, lastSeen: Date.now() });
  },
});

// Update agent resources (internal)
export const updateResources = internalMutation({
  args: {
    agentId: v.id("agents"),
    updates: v.object({
      rawWood: v.optional(v.number()),
      rawStone: v.optional(v.number()),
      rawWater: v.optional(v.number()),
      rawFood: v.optional(v.number()),
      rawClay: v.optional(v.number()),
      refinedPlanks: v.optional(v.number()),
      refinedBricks: v.optional(v.number()),
      refinedCement: v.optional(v.number()),
      refinedGlass: v.optional(v.number()),
      refinedSteel: v.optional(v.number()),
      tokens: v.optional(v.number()),
      reputation: v.optional(v.number()),
    }),
  },
  handler: async (ctx, { agentId, updates }) => {
    await ctx.db.patch(agentId, updates);
  },
});

// Add notification
export const addNotification = internalMutation({
  args: {
    agentId: v.id("agents"),
    type: v.string(),
    message: v.string(),
  },
  handler: async (ctx, { agentId, type, message }) => {
    await ctx.db.insert("notifications", {
      agentId,
      type,
      message,
      timestamp: Date.now(),
      read: false,
    });
  },
});
