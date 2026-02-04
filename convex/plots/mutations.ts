import { mutation } from "../_generated/server";
import { v } from "convex/values";
import {
  GridCell,
  calculateAgentTier,
  clearPlotFromGrid,
} from "../helpers";
import {
  CLAIM_TILE_COST_TOKENS,
  MAX_PLOT_SIZE,
  MIN_PLOT_SIZE,
  MAX_PLOTS_PER_AGENT,
  GRID_WIDTH,
  GRID_HEIGHT,
} from "../constants";

// Claim a rectangular plot
export const claim = mutation({
  args: {
    apiKey: v.string(),
    x: v.number(),
    y: v.number(),
    width: v.number(),
    height: v.number(),
  },
  handler: async (ctx, { apiKey, x, y, width, height }) => {
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

    // Validate dimensions
    if (width < MIN_PLOT_SIZE || height < MIN_PLOT_SIZE) {
      return { ok: false, error: `Minimum plot size is ${MIN_PLOT_SIZE}x${MIN_PLOT_SIZE}` };
    }

    if (width > MAX_PLOT_SIZE || height > MAX_PLOT_SIZE) {
      return { ok: false, error: `Maximum plot size is ${MAX_PLOT_SIZE}x${MAX_PLOT_SIZE}` };
    }

    // Check bounds
    if (x < 0 || y < 0 || x + width > GRID_WIDTH || y + height > GRID_HEIGHT) {
      return { ok: false, error: "Plot out of bounds" };
    }

    // Calculate cost
    const tileCount = width * height;
    const cost = tileCount * CLAIM_TILE_COST_TOKENS;

    if (agent.tokens < cost) {
      return { ok: false, error: `Need ${cost} tokens to claim ${tileCount} tiles` };
    }

    // Check plot limit
    const existingPlots = await ctx.db
      .query("plots")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", agent._id))
      .collect();

    const currentTileCount = existingPlots.reduce((sum, p) => sum + p.width * p.height, 0);
    if (currentTileCount + tileCount > MAX_PLOTS_PER_AGENT * MAX_PLOT_SIZE) {
      return { ok: false, error: "Plot limit exceeded" };
    }

    const gridState = await ctx.db.query("gridState").first();
    if (!gridState) {
      return { ok: false, error: "Game not initialized" };
    }

    const grid = gridState.grid as GridCell[][];

    // Check all cells are available
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const cx = x + dx;
        const cy = y + dy;
        const cell = grid[cy]?.[cx];

        if (!cell) {
          return { ok: false, error: `Invalid position at ${cx},${cy}` };
        }

        if (cell.plotId) {
          return { ok: false, error: `Tile at ${cx},${cy} already claimed` };
        }

        if (!cell.isPassable && !cell.isCleared) {
          return { ok: false, error: `Cannot claim impassable terrain at ${cx},${cy}` };
        }

        // Forest tiles must be cleared before claiming
        if (cell.terrain === "forest" && !cell.isCleared) {
          return { ok: false, error: `Tile at ${cx},${cy} has forest — clear it first` };
        }
      }
    }

    // Create plot
    const plotId = await ctx.db.insert("plots", {
      ownerId: agent._id,
      x,
      y,
      width,
      height,
      claimedAt: Date.now(),
    });

    // Update grid
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        grid[y + dy][x + dx].plotId = plotId;
      }
    }
    await ctx.db.patch(gridState._id, { grid });

    // Update agent
    const newPlotCount = agent.plotCount + tileCount;
    const buildings = await ctx.db
      .query("buildings")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", agent._id))
      .collect();
    const buildingTypes = buildings.filter((b) => b.completed).map((b) => b.type);
    const newTier = calculateAgentTier(buildingTypes, newPlotCount, agent.reputation);

    await ctx.db.patch(agent._id, {
      tokens: agent.tokens - cost,
      plotCount: newPlotCount,
      currentTier: newTier,
      lastSeen: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activity", {
      type: "plot_claimed",
      agentId: agent._id,
      agentName: agent.name,
      description: `${agent.name} claimed a ${width}x${height} plot`,
      timestamp: Date.now(),
    });

    return {
      ok: true,
      data: {
        plotId,
        x,
        y,
        width,
        height,
        cost,
      },
    };
  },
});

// Release a plot
export const release = mutation({
  args: {
    apiKey: v.string(),
    plotId: v.id("plots"),
  },
  handler: async (ctx, { apiKey, plotId }) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", apiKey))
      .first();

    if (!agent) {
      return { ok: false, error: "Invalid API key" };
    }

    const plot = await ctx.db.get(plotId);
    if (!plot) {
      return { ok: false, error: "Plot not found" };
    }

    if (plot.ownerId !== agent._id) {
      return { ok: false, error: "You don't own this plot" };
    }

    // Check for buildings on plot
    const buildings = await ctx.db
      .query("buildings")
      .withIndex("by_plotId", (q) => q.eq("plotId", plotId))
      .collect();

    if (buildings.length > 0) {
      return { ok: false, error: "Cannot release plot with buildings. Demolish buildings first." };
    }

    const gridState = await ctx.db.query("gridState").first();
    if (!gridState) {
      return { ok: false, error: "Game not initialized" };
    }

    const grid = gridState.grid as GridCell[][];

    // Clear grid
    clearPlotFromGrid(grid, plot);
    await ctx.db.patch(gridState._id, { grid });

    // Delete plot
    await ctx.db.delete(plotId);

    // Update agent
    const tileCount = plot.width * plot.height;
    const newPlotCount = Math.max(0, agent.plotCount - tileCount);
    const agentBuildings = await ctx.db
      .query("buildings")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", agent._id))
      .collect();
    const buildingTypes = agentBuildings.filter((b) => b.completed).map((b) => b.type);
    const newTier = calculateAgentTier(buildingTypes, newPlotCount, agent.reputation);

    await ctx.db.patch(agent._id, {
      plotCount: newPlotCount,
      currentTier: newTier,
      lastSeen: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activity", {
      type: "plot_released",
      agentId: agent._id,
      agentName: agent.name,
      description: `${agent.name} released a ${plot.width}x${plot.height} plot`,
      timestamp: Date.now(),
    });

    return { ok: true };
  },
});

// Transfer plot to another agent
export const transfer = mutation({
  args: {
    apiKey: v.string(),
    plotId: v.id("plots"),
    recipientId: v.id("agents"),
  },
  handler: async (ctx, { apiKey, plotId, recipientId }) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", apiKey))
      .first();

    if (!agent) {
      return { ok: false, error: "Invalid API key" };
    }

    const plot = await ctx.db.get(plotId);
    if (!plot) {
      return { ok: false, error: "Plot not found" };
    }

    if (plot.ownerId !== agent._id) {
      return { ok: false, error: "You don't own this plot" };
    }

    const recipient = await ctx.db.get(recipientId);
    if (!recipient) {
      return { ok: false, error: "Recipient not found" };
    }

    if (!recipient.online) {
      return { ok: false, error: "Recipient must be online" };
    }

    // Transfer buildings on plot
    const buildings = await ctx.db
      .query("buildings")
      .withIndex("by_plotId", (q) => q.eq("plotId", plotId))
      .collect();

    for (const building of buildings) {
      await ctx.db.patch(building._id, { ownerId: recipientId });
    }

    // Transfer plot
    await ctx.db.patch(plotId, { ownerId: recipientId });

    // Update counts
    const tileCount = plot.width * plot.height;
    const buildingCount = buildings.length;

    await ctx.db.patch(agent._id, {
      plotCount: Math.max(0, agent.plotCount - tileCount),
      buildingCount: Math.max(0, agent.buildingCount - buildingCount),
      lastSeen: Date.now(),
    });

    await ctx.db.patch(recipientId, {
      plotCount: recipient.plotCount + tileCount,
      buildingCount: recipient.buildingCount + buildingCount,
    });

    // Log activity
    await ctx.db.insert("activity", {
      type: "plot_transferred",
      agentId: agent._id,
      agentName: agent.name,
      description: `${agent.name} transferred a plot to ${recipient.name}`,
      timestamp: Date.now(),
    });

    return {
      ok: true,
      data: {
        plotId,
        newOwnerId: recipientId,
        newOwnerName: recipient.name,
        buildingsTransferred: buildingCount,
      },
    };
  },
});
