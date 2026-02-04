import { query } from "../_generated/server";
import { v } from "convex/values";

// Get all plots
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("plots").collect();
  },
});

// Get plot by ID
export const getById = query({
  args: { plotId: v.id("plots") },
  handler: async (ctx, { plotId }) => {
    return await ctx.db.get(plotId);
  },
});

// Get plots by owner
export const getByOwner = query({
  args: { ownerId: v.id("agents") },
  handler: async (ctx, { ownerId }) => {
    return await ctx.db
      .query("plots")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
      .collect();
  },
});

// Get available plot areas (unclaimed)
export const getAvailable = query({
  args: {},
  handler: async (ctx) => {
    const gridState = await ctx.db.query("gridState").first();
    if (!gridState) return [];

    const grid = gridState.grid as any[][];
    const available: Array<{ x: number; y: number; terrain: string }> = [];

    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        const cell = grid[y][x];
        if (!cell.plotId && !cell.buildingId && cell.isPassable) {
          available.push({ x, y, terrain: cell.terrain });
        }
      }
    }

    return available;
  },
});

// Get plot count
export const getCount = query({
  args: {},
  handler: async (ctx) => {
    const plots = await ctx.db.query("plots").collect();
    return plots.length;
  },
});
