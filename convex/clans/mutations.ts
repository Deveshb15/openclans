import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { hasRequiredBuilding } from "../helpers";
import { PRESTIGE } from "../constants";

// Create a clan
export const create = mutation({
  args: {
    apiKey: v.string(),
    name: v.string(),
    tag: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { apiKey, name, tag, description }) => {
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

    if (agent.clanId) {
      return { ok: false, error: "You are already in a clan" };
    }

    // Check reputation requirement
    if (agent.reputation < PRESTIGE.THRESHOLD_CLANS) {
      return { ok: false, error: `Need ${PRESTIGE.THRESHOLD_CLANS} reputation to create a clan` };
    }

    // Check inn requirement
    const buildings = await ctx.db
      .query("buildings")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", agent._id))
      .collect();

    if (!hasRequiredBuilding(buildings, agent._id, "inn")) {
      return { ok: false, error: "Need an inn to create a clan" };
    }

    // Validate name
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 3 || trimmedName.length > 24) {
      return { ok: false, error: "Clan name must be 3-24 characters" };
    }

    // Validate tag
    const trimmedTag = tag.trim().toUpperCase();
    if (!trimmedTag || trimmedTag.length < 2 || trimmedTag.length > 4) {
      return { ok: false, error: "Clan tag must be 2-4 characters" };
    }

    // Check name uniqueness
    const existingName = await ctx.db
      .query("clans")
      .withIndex("by_name", (q) => q.eq("name", trimmedName))
      .first();

    if (existingName) {
      return { ok: false, error: "Clan name already taken" };
    }

    // Check tag uniqueness
    const existingTag = await ctx.db
      .query("clans")
      .withIndex("by_tag", (q) => q.eq("tag", trimmedTag))
      .first();

    if (existingTag) {
      return { ok: false, error: "Clan tag already taken" };
    }

    // Create clan
    const clanId = await ctx.db.insert("clans", {
      name: trimmedName,
      tag: trimmedTag,
      leaderId: agent._id,
      memberIds: [agent._id],
      treasuryRawWood: 0,
      treasuryRawStone: 0,
      treasuryRawWater: 0,
      treasuryRawFood: 0,
      treasuryRawClay: 0,
      treasuryRefinedPlanks: 0,
      treasuryRefinedBricks: 0,
      treasuryRefinedCement: 0,
      treasuryRefinedGlass: 0,
      treasuryRefinedSteel: 0,
      treasuryTokens: 0,
      createdAt: Date.now(),
      description: description?.trim() || "",
    });

    // Update agent
    await ctx.db.patch(agent._id, {
      clanId,
      lastSeen: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activity", {
      type: "clan_created",
      agentId: agent._id,
      agentName: agent.name,
      description: `${agent.name} founded clan [${trimmedTag}] ${trimmedName}`,
      timestamp: Date.now(),
    });

    return {
      ok: true,
      data: {
        clanId,
        name: trimmedName,
        tag: trimmedTag,
      },
    };
  },
});

// Join a clan
export const join = mutation({
  args: {
    apiKey: v.string(),
    clanId: v.id("clans"),
  },
  handler: async (ctx, { apiKey, clanId }) => {
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

    if (agent.clanId) {
      return { ok: false, error: "You are already in a clan" };
    }

    const clan = await ctx.db.get(clanId);
    if (!clan) {
      return { ok: false, error: "Clan not found" };
    }

    // Add to clan
    await ctx.db.patch(clanId, {
      memberIds: [...clan.memberIds, agent._id],
    });

    // Update agent
    await ctx.db.patch(agent._id, {
      clanId,
      lastSeen: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activity", {
      type: "clan_joined",
      agentId: agent._id,
      agentName: agent.name,
      description: `${agent.name} joined [${clan.tag}] ${clan.name}`,
      timestamp: Date.now(),
    });

    return {
      ok: true,
      data: {
        clanId,
        clanName: clan.name,
        clanTag: clan.tag,
      },
    };
  },
});

// Leave a clan
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

    if (!agent.clanId) {
      return { ok: false, error: "You are not in a clan" };
    }

    const clan = await ctx.db.get(agent.clanId);
    if (!clan) {
      return { ok: false, error: "Clan not found" };
    }

    // Leader cannot leave if there are other members
    if (clan.leaderId === agent._id && clan.memberIds.length > 1) {
      return { ok: false, error: "Leader cannot leave while clan has other members" };
    }

    // Remove from clan
    const newMemberIds = clan.memberIds.filter((id) => id !== agent._id);

    if (newMemberIds.length === 0) {
      // Delete clan if no members left
      await ctx.db.delete(clan._id);
    } else {
      // If leader left, promote next member
      if (clan.leaderId === agent._id) {
        await ctx.db.patch(clan._id, {
          memberIds: newMemberIds,
          leaderId: newMemberIds[0],
        });
      } else {
        await ctx.db.patch(clan._id, {
          memberIds: newMemberIds,
        });
      }
    }

    // Update agent
    await ctx.db.patch(agent._id, {
      clanId: undefined,
      lastSeen: Date.now(),
    });

    // Log activity
    await ctx.db.insert("activity", {
      type: "clan_left",
      agentId: agent._id,
      agentName: agent.name,
      description: `${agent.name} left [${clan.tag}] ${clan.name}`,
      timestamp: Date.now(),
    });

    return { ok: true };
  },
});

// Donate to clan treasury
export const donate = mutation({
  args: {
    apiKey: v.string(),
    tokens: v.optional(v.number()),
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
  },
  handler: async (ctx, { apiKey, tokens, raw, refined }) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", apiKey))
      .first();

    if (!agent) {
      return { ok: false, error: "Invalid API key" };
    }

    if (!agent.clanId) {
      return { ok: false, error: "You are not in a clan" };
    }

    const clan = await ctx.db.get(agent.clanId);
    if (!clan) {
      return { ok: false, error: "Clan not found" };
    }

    const donateTokens = tokens || 0;
    const donateRaw = raw || {};
    const donateRefined = refined || {};

    // Check agent has resources
    if (donateTokens > agent.tokens) {
      return { ok: false, error: "Not enough tokens" };
    }
    if ((donateRaw.wood || 0) > agent.rawWood) {
      return { ok: false, error: "Not enough wood" };
    }
    if ((donateRaw.stone || 0) > agent.rawStone) {
      return { ok: false, error: "Not enough stone" };
    }
    if ((donateRaw.water || 0) > agent.rawWater) {
      return { ok: false, error: "Not enough water" };
    }
    if ((donateRaw.food || 0) > agent.rawFood) {
      return { ok: false, error: "Not enough food" };
    }
    if ((donateRaw.clay || 0) > agent.rawClay) {
      return { ok: false, error: "Not enough clay" };
    }
    if ((donateRefined.planks || 0) > agent.refinedPlanks) {
      return { ok: false, error: "Not enough planks" };
    }
    if ((donateRefined.bricks || 0) > agent.refinedBricks) {
      return { ok: false, error: "Not enough bricks" };
    }
    if ((donateRefined.cement || 0) > agent.refinedCement) {
      return { ok: false, error: "Not enough cement" };
    }
    if ((donateRefined.glass || 0) > agent.refinedGlass) {
      return { ok: false, error: "Not enough glass" };
    }
    if ((donateRefined.steel || 0) > agent.refinedSteel) {
      return { ok: false, error: "Not enough steel" };
    }

    // Transfer from agent to clan
    await ctx.db.patch(agent._id, {
      tokens: agent.tokens - donateTokens,
      rawWood: agent.rawWood - (donateRaw.wood || 0),
      rawStone: agent.rawStone - (donateRaw.stone || 0),
      rawWater: agent.rawWater - (donateRaw.water || 0),
      rawFood: agent.rawFood - (donateRaw.food || 0),
      rawClay: agent.rawClay - (donateRaw.clay || 0),
      refinedPlanks: agent.refinedPlanks - (donateRefined.planks || 0),
      refinedBricks: agent.refinedBricks - (donateRefined.bricks || 0),
      refinedCement: agent.refinedCement - (donateRefined.cement || 0),
      refinedGlass: agent.refinedGlass - (donateRefined.glass || 0),
      refinedSteel: agent.refinedSteel - (donateRefined.steel || 0),
      lastSeen: Date.now(),
    });

    await ctx.db.patch(clan._id, {
      treasuryTokens: clan.treasuryTokens + donateTokens,
      treasuryRawWood: clan.treasuryRawWood + (donateRaw.wood || 0),
      treasuryRawStone: clan.treasuryRawStone + (donateRaw.stone || 0),
      treasuryRawWater: clan.treasuryRawWater + (donateRaw.water || 0),
      treasuryRawFood: clan.treasuryRawFood + (donateRaw.food || 0),
      treasuryRawClay: clan.treasuryRawClay + (donateRaw.clay || 0),
      treasuryRefinedPlanks: clan.treasuryRefinedPlanks + (donateRefined.planks || 0),
      treasuryRefinedBricks: clan.treasuryRefinedBricks + (donateRefined.bricks || 0),
      treasuryRefinedCement: clan.treasuryRefinedCement + (donateRefined.cement || 0),
      treasuryRefinedGlass: clan.treasuryRefinedGlass + (donateRefined.glass || 0),
      treasuryRefinedSteel: clan.treasuryRefinedSteel + (donateRefined.steel || 0),
    });

    // Log activity
    await ctx.db.insert("activity", {
      type: "clan_donation",
      agentId: agent._id,
      agentName: agent.name,
      description: `${agent.name} donated to [${clan.tag}] ${clan.name}`,
      timestamp: Date.now(),
    });

    return {
      ok: true,
      data: {
        donated: { tokens: donateTokens, raw: donateRaw, refined: donateRefined },
      },
    };
  },
});
