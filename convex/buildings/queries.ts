import { query } from "../_generated/server";
import { v } from "convex/values";
import { BUILDING_DEFINITIONS } from "../constants";

// Get all buildings
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("buildings").collect();
  },
});

// Get building by ID
export const getById = query({
  args: { buildingId: v.id("buildings") },
  handler: async (ctx, { buildingId }) => {
    return await ctx.db.get(buildingId);
  },
});

// Get buildings by owner
export const getByOwner = query({
  args: { ownerId: v.id("agents") },
  handler: async (ctx, { ownerId }) => {
    return await ctx.db
      .query("buildings")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
      .collect();
  },
});

// Get buildings by plot
export const getByPlot = query({
  args: { plotId: v.id("plots") },
  handler: async (ctx, { plotId }) => {
    return await ctx.db
      .query("buildings")
      .withIndex("by_plotId", (q) => q.eq("plotId", plotId))
      .collect();
  },
});

// Get completed buildings
export const getCompleted = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("buildings")
      .withIndex("by_completed", (q) => q.eq("completed", true))
      .collect();
  },
});

// Get incomplete buildings
export const getIncomplete = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("buildings")
      .withIndex("by_completed", (q) => q.eq("completed", false))
      .collect();
  },
});

// Get building definitions
export const getTypes = query({
  args: {},
  handler: async () => {
    return BUILDING_DEFINITIONS;
  },
});

// Get building count
export const getCount = query({
  args: {},
  handler: async (ctx) => {
    const buildings = await ctx.db.query("buildings").collect();
    return buildings.length;
  },
});
