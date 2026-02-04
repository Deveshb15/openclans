import { query } from "../_generated/server";
import { v } from "convex/values";
import { MAX_CHAT_MESSAGES } from "../constants";

// Get recent town chat
export const getTownChat = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 50 }) => {
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_channel_timestamp", (q) => q.eq("channel", "town"))
      .order("desc")
      .take(Math.min(limit, MAX_CHAT_MESSAGES));

    return messages.reverse();
  },
});

// Get clan chat
export const getClanChat = query({
  args: {
    clanId: v.id("clans"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { clanId, limit = 50 }) => {
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_clanId", (q) => q.eq("clanId", clanId))
      .order("desc")
      .take(Math.min(limit, MAX_CHAT_MESSAGES));

    return messages.reverse();
  },
});

// Get DMs between two agents
export const getDMs = query({
  args: {
    apiKey: v.string(),
    otherAgentId: v.id("agents"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { apiKey, otherAgentId, limit = 50 }) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", apiKey))
      .first();

    if (!agent) return [];

    // Get messages sent or received between these two agents
    const allDMs = await ctx.db
      .query("chatMessages")
      .withIndex("by_channel_timestamp", (q) => q.eq("channel", "dm"))
      .order("desc")
      .take(500);

    const relevantDMs = allDMs.filter(
      (m) =>
        (m.senderId === agent._id && m.recipientId === otherAgentId) ||
        (m.senderId === otherAgentId && m.recipientId === agent._id)
    );

    return relevantDMs.slice(0, limit).reverse();
  },
});

// Get all recent messages (for spectator state)
export const getRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 200 }) => {
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);

    return messages.reverse();
  },
});
