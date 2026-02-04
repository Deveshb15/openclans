import { query } from "../_generated/server";
import { v } from "convex/values";

// Get all clans
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("clans").collect();
  },
});

// Get clan by ID
export const getById = query({
  args: { clanId: v.id("clans") },
  handler: async (ctx, { clanId }) => {
    return await ctx.db.get(clanId);
  },
});

// Get clan by name
export const getByName = query({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    return await ctx.db
      .query("clans")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();
  },
});

// Get clan count
export const getCount = query({
  args: {},
  handler: async (ctx) => {
    const clans = await ctx.db.query("clans").collect();
    return clans.length;
  },
});

// Get clan leaderboard (by treasury tokens)
export const getLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 20 }) => {
    const clans = await ctx.db.query("clans").collect();

    // Sort by treasury tokens descending
    clans.sort((a, b) => b.treasuryTokens - a.treasuryTokens);

    return clans.slice(0, limit);
  },
});
