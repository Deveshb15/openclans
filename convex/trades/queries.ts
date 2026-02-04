import { query } from "../_generated/server";
import { v } from "convex/values";

// Get all open trades
export const getOpen = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("trades")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();
  },
});

// Get trade by ID
export const getById = query({
  args: { tradeId: v.id("trades") },
  handler: async (ctx, { tradeId }) => {
    return await ctx.db.get(tradeId);
  },
});

// Get trades by seller
export const getBySeller = query({
  args: { sellerId: v.id("agents") },
  handler: async (ctx, { sellerId }) => {
    return await ctx.db
      .query("trades")
      .withIndex("by_sellerId", (q) => q.eq("sellerId", sellerId))
      .collect();
  },
});

// Get all trades (for spectator state)
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("trades").collect();
  },
});

// Get open trade count
export const getOpenCount = query({
  args: {},
  handler: async (ctx) => {
    const trades = await ctx.db
      .query("trades")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();
    return trades.length;
  },
});
