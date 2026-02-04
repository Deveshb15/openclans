import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { TRADE_COOLDOWN_MS, PRESTIGE } from "../constants";

// Rate limit check helper
async function checkRateLimit(
  ctx: any,
  agentId: any,
  actionType: string,
  cooldownMs: number
): Promise<{ allowed: boolean; waitMs?: number }> {
  const rateLimit = await ctx.db
    .query("rateLimits")
    .withIndex("by_agent_action", (q: any) => q.eq("agentId", agentId).eq("actionType", actionType))
    .first();

  const now = Date.now();
  if (rateLimit) {
    const elapsed = now - rateLimit.lastActionAt;
    if (elapsed < cooldownMs) {
      return { allowed: false, waitMs: cooldownMs - elapsed };
    }
    await ctx.db.patch(rateLimit._id, { lastActionAt: now });
  } else {
    await ctx.db.insert("rateLimits", {
      agentId,
      actionType,
      lastActionAt: now,
    });
  }
  return { allowed: true };
}

// Create a trade offer
export const create = mutation({
  args: {
    apiKey: v.string(),
    offering: v.object({
      raw: v.optional(v.object({
        wood: v.optional(v.number()),
        stone: v.optional(v.number()),
        water: v.optional(v.number()),
        food: v.optional(v.number()),
        clay: v.optional(v.number()),
      })),
      refined: v.optional(v.object({
        planks: v.optional(v.number()),
        bricks: v.optional(v.number()),
        cement: v.optional(v.number()),
        glass: v.optional(v.number()),
        steel: v.optional(v.number()),
      })),
      tokens: v.optional(v.number()),
    }),
    requesting: v.object({
      raw: v.optional(v.object({
        wood: v.optional(v.number()),
        stone: v.optional(v.number()),
        water: v.optional(v.number()),
        food: v.optional(v.number()),
        clay: v.optional(v.number()),
      })),
      refined: v.optional(v.object({
        planks: v.optional(v.number()),
        bricks: v.optional(v.number()),
        cement: v.optional(v.number()),
        glass: v.optional(v.number()),
        steel: v.optional(v.number()),
      })),
      tokens: v.optional(v.number()),
    }),
  },
  handler: async (ctx, { apiKey, offering, requesting }) => {
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

    // Rate limit
    const rateCheck = await checkRateLimit(ctx, agent._id, "trade", TRADE_COOLDOWN_MS);
    if (!rateCheck.allowed) {
      return { ok: false, error: `Rate limited. Wait ${Math.ceil(rateCheck.waitMs! / 1000)}s` };
    }

    // Check agent has the resources to offer
    const offeringRaw = offering.raw || {};
    const offeringRefined = offering.refined || {};
    const offeringTokens = offering.tokens || 0;

    if ((offeringRaw.wood || 0) > agent.rawWood) {
      return { ok: false, error: "Not enough wood to offer" };
    }
    if ((offeringRaw.stone || 0) > agent.rawStone) {
      return { ok: false, error: "Not enough stone to offer" };
    }
    if ((offeringRaw.water || 0) > agent.rawWater) {
      return { ok: false, error: "Not enough water to offer" };
    }
    if ((offeringRaw.food || 0) > agent.rawFood) {
      return { ok: false, error: "Not enough food to offer" };
    }
    if ((offeringRaw.clay || 0) > agent.rawClay) {
      return { ok: false, error: "Not enough clay to offer" };
    }
    if ((offeringRefined.planks || 0) > agent.refinedPlanks) {
      return { ok: false, error: "Not enough planks to offer" };
    }
    if ((offeringRefined.bricks || 0) > agent.refinedBricks) {
      return { ok: false, error: "Not enough bricks to offer" };
    }
    if ((offeringRefined.cement || 0) > agent.refinedCement) {
      return { ok: false, error: "Not enough cement to offer" };
    }
    if ((offeringRefined.glass || 0) > agent.refinedGlass) {
      return { ok: false, error: "Not enough glass to offer" };
    }
    if ((offeringRefined.steel || 0) > agent.refinedSteel) {
      return { ok: false, error: "Not enough steel to offer" };
    }
    if (offeringTokens > agent.tokens) {
      return { ok: false, error: "Not enough tokens to offer" };
    }

    // Deduct offering from agent
    await ctx.db.patch(agent._id, {
      rawWood: agent.rawWood - (offeringRaw.wood || 0),
      rawStone: agent.rawStone - (offeringRaw.stone || 0),
      rawWater: agent.rawWater - (offeringRaw.water || 0),
      rawFood: agent.rawFood - (offeringRaw.food || 0),
      rawClay: agent.rawClay - (offeringRaw.clay || 0),
      refinedPlanks: agent.refinedPlanks - (offeringRefined.planks || 0),
      refinedBricks: agent.refinedBricks - (offeringRefined.bricks || 0),
      refinedCement: agent.refinedCement - (offeringRefined.cement || 0),
      refinedGlass: agent.refinedGlass - (offeringRefined.glass || 0),
      refinedSteel: agent.refinedSteel - (offeringRefined.steel || 0),
      tokens: agent.tokens - offeringTokens,
      lastSeen: Date.now(),
    });

    const requestingRaw = requesting.raw || {};
    const requestingRefined = requesting.refined || {};
    const requestingTokens = requesting.tokens || 0;

    // Create trade
    const tradeId = await ctx.db.insert("trades", {
      sellerId: agent._id,
      sellerName: agent.name,
      buyerId: undefined,
      offeringRawWood: offeringRaw.wood || 0,
      offeringRawStone: offeringRaw.stone || 0,
      offeringRawWater: offeringRaw.water || 0,
      offeringRawFood: offeringRaw.food || 0,
      offeringRawClay: offeringRaw.clay || 0,
      offeringRefinedPlanks: offeringRefined.planks || 0,
      offeringRefinedBricks: offeringRefined.bricks || 0,
      offeringRefinedCement: offeringRefined.cement || 0,
      offeringRefinedGlass: offeringRefined.glass || 0,
      offeringRefinedSteel: offeringRefined.steel || 0,
      offeringTokens,
      requestingRawWood: requestingRaw.wood || 0,
      requestingRawStone: requestingRaw.stone || 0,
      requestingRawWater: requestingRaw.water || 0,
      requestingRawFood: requestingRaw.food || 0,
      requestingRawClay: requestingRaw.clay || 0,
      requestingRefinedPlanks: requestingRefined.planks || 0,
      requestingRefinedBricks: requestingRefined.bricks || 0,
      requestingRefinedCement: requestingRefined.cement || 0,
      requestingRefinedGlass: requestingRefined.glass || 0,
      requestingRefinedSteel: requestingRefined.steel || 0,
      requestingTokens,
      status: "open",
      createdAt: Date.now(),
      resolvedAt: undefined,
    });

    // Log activity
    await ctx.db.insert("activity", {
      type: "trade_created",
      agentId: agent._id,
      agentName: agent.name,
      description: `${agent.name} created a trade offer`,
      timestamp: Date.now(),
    });

    return {
      ok: true,
      data: {
        tradeId,
        offering,
        requesting,
      },
    };
  },
});

// Accept a trade
export const accept = mutation({
  args: {
    apiKey: v.string(),
    tradeId: v.id("trades"),
  },
  handler: async (ctx, { apiKey, tradeId }) => {
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

    const trade = await ctx.db.get(tradeId);
    if (!trade) {
      return { ok: false, error: "Trade not found" };
    }

    if (trade.status !== "open") {
      return { ok: false, error: "Trade is no longer open" };
    }

    if (trade.sellerId === agent._id) {
      return { ok: false, error: "Cannot accept your own trade" };
    }

    // Check buyer has the requested resources
    if (trade.requestingRawWood > agent.rawWood) {
      return { ok: false, error: "Not enough wood" };
    }
    if (trade.requestingRawStone > agent.rawStone) {
      return { ok: false, error: "Not enough stone" };
    }
    if (trade.requestingRawWater > agent.rawWater) {
      return { ok: false, error: "Not enough water" };
    }
    if (trade.requestingRawFood > agent.rawFood) {
      return { ok: false, error: "Not enough food" };
    }
    if (trade.requestingRawClay > agent.rawClay) {
      return { ok: false, error: "Not enough clay" };
    }
    if (trade.requestingRefinedPlanks > agent.refinedPlanks) {
      return { ok: false, error: "Not enough planks" };
    }
    if (trade.requestingRefinedBricks > agent.refinedBricks) {
      return { ok: false, error: "Not enough bricks" };
    }
    if (trade.requestingRefinedCement > agent.refinedCement) {
      return { ok: false, error: "Not enough cement" };
    }
    if (trade.requestingRefinedGlass > agent.refinedGlass) {
      return { ok: false, error: "Not enough glass" };
    }
    if (trade.requestingRefinedSteel > agent.refinedSteel) {
      return { ok: false, error: "Not enough steel" };
    }
    if (trade.requestingTokens > agent.tokens) {
      return { ok: false, error: "Not enough tokens" };
    }

    const seller = await ctx.db.get(trade.sellerId);
    if (!seller) {
      return { ok: false, error: "Seller not found" };
    }

    // Transfer: buyer pays requested, receives offering
    await ctx.db.patch(agent._id, {
      rawWood: agent.rawWood - trade.requestingRawWood + trade.offeringRawWood,
      rawStone: agent.rawStone - trade.requestingRawStone + trade.offeringRawStone,
      rawWater: agent.rawWater - trade.requestingRawWater + trade.offeringRawWater,
      rawFood: agent.rawFood - trade.requestingRawFood + trade.offeringRawFood,
      rawClay: agent.rawClay - trade.requestingRawClay + trade.offeringRawClay,
      refinedPlanks: agent.refinedPlanks - trade.requestingRefinedPlanks + trade.offeringRefinedPlanks,
      refinedBricks: agent.refinedBricks - trade.requestingRefinedBricks + trade.offeringRefinedBricks,
      refinedCement: agent.refinedCement - trade.requestingRefinedCement + trade.offeringRefinedCement,
      refinedGlass: agent.refinedGlass - trade.requestingRefinedGlass + trade.offeringRefinedGlass,
      refinedSteel: agent.refinedSteel - trade.requestingRefinedSteel + trade.offeringRefinedSteel,
      tokens: agent.tokens - trade.requestingTokens + trade.offeringTokens,
      reputation: agent.reputation + PRESTIGE.TRADE,
      lastSeen: Date.now(),
    });

    // Seller receives requested
    await ctx.db.patch(seller._id, {
      rawWood: seller.rawWood + trade.requestingRawWood,
      rawStone: seller.rawStone + trade.requestingRawStone,
      rawWater: seller.rawWater + trade.requestingRawWater,
      rawFood: seller.rawFood + trade.requestingRawFood,
      rawClay: seller.rawClay + trade.requestingRawClay,
      refinedPlanks: seller.refinedPlanks + trade.requestingRefinedPlanks,
      refinedBricks: seller.refinedBricks + trade.requestingRefinedBricks,
      refinedCement: seller.refinedCement + trade.requestingRefinedCement,
      refinedGlass: seller.refinedGlass + trade.requestingRefinedGlass,
      refinedSteel: seller.refinedSteel + trade.requestingRefinedSteel,
      tokens: seller.tokens + trade.requestingTokens,
      reputation: seller.reputation + PRESTIGE.TRADE,
    });

    // Update trade
    await ctx.db.patch(tradeId, {
      buyerId: agent._id,
      status: "accepted",
      resolvedAt: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activity", {
      type: "trade_accepted",
      agentId: agent._id,
      agentName: agent.name,
      description: `${agent.name} accepted ${seller.name}'s trade`,
      timestamp: Date.now(),
    });

    // Notify seller
    await ctx.db.insert("notifications", {
      agentId: seller._id,
      type: "trade",
      message: `${agent.name} accepted your trade`,
      timestamp: Date.now(),
      read: false,
    });

    return {
      ok: true,
      data: {
        tradeId,
        reputationGained: PRESTIGE.TRADE,
      },
    };
  },
});

// Cancel a trade
export const cancel = mutation({
  args: {
    apiKey: v.string(),
    tradeId: v.id("trades"),
  },
  handler: async (ctx, { apiKey, tradeId }) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", apiKey))
      .first();

    if (!agent) {
      return { ok: false, error: "Invalid API key" };
    }

    const trade = await ctx.db.get(tradeId);
    if (!trade) {
      return { ok: false, error: "Trade not found" };
    }

    if (trade.sellerId !== agent._id) {
      return { ok: false, error: "You can only cancel your own trades" };
    }

    if (trade.status !== "open") {
      return { ok: false, error: "Trade is no longer open" };
    }

    // Return offering to seller
    await ctx.db.patch(agent._id, {
      rawWood: agent.rawWood + trade.offeringRawWood,
      rawStone: agent.rawStone + trade.offeringRawStone,
      rawWater: agent.rawWater + trade.offeringRawWater,
      rawFood: agent.rawFood + trade.offeringRawFood,
      rawClay: agent.rawClay + trade.offeringRawClay,
      refinedPlanks: agent.refinedPlanks + trade.offeringRefinedPlanks,
      refinedBricks: agent.refinedBricks + trade.offeringRefinedBricks,
      refinedCement: agent.refinedCement + trade.offeringRefinedCement,
      refinedGlass: agent.refinedGlass + trade.offeringRefinedGlass,
      refinedSteel: agent.refinedSteel + trade.offeringRefinedSteel,
      tokens: agent.tokens + trade.offeringTokens,
      lastSeen: Date.now(),
    });

    // Update trade
    await ctx.db.patch(tradeId, {
      status: "cancelled",
      resolvedAt: Date.now(),
    });

    return { ok: true };
  },
});
