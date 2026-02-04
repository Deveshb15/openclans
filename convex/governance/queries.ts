import { query } from "../_generated/server";
import { v } from "convex/values";

// Get all proposals
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("proposals").collect();
  },
});

// Get proposal by ID
export const getById = query({
  args: { proposalId: v.id("proposals") },
  handler: async (ctx, { proposalId }) => {
    return await ctx.db.get(proposalId);
  },
});

// Get active proposals
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("proposals")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
  },
});

// Get proposals by proposer
export const getByProposer = query({
  args: { proposerId: v.id("agents") },
  handler: async (ctx, { proposerId }) => {
    return await ctx.db
      .query("proposals")
      .withIndex("by_proposerId", (q) => q.eq("proposerId", proposerId))
      .collect();
  },
});

// Get active proposal count
export const getActiveCount = query({
  args: {},
  handler: async (ctx) => {
    const proposals = await ctx.db
      .query("proposals")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    return proposals.length;
  },
});
