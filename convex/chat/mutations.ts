import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { CHAT_COOLDOWN_MS, MAX_CHAT_MESSAGE_LENGTH } from "../constants";

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

// Send town chat message
export const sendTown = mutation({
  args: {
    apiKey: v.string(),
    content: v.string(),
  },
  handler: async (ctx, { apiKey, content }) => {
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
    const rateCheck = await checkRateLimit(ctx, agent._id, "chat", CHAT_COOLDOWN_MS);
    if (!rateCheck.allowed) {
      return { ok: false, error: `Rate limited. Wait ${Math.ceil(rateCheck.waitMs! / 1000)}s` };
    }

    // Validate content
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      return { ok: false, error: "Message cannot be empty" };
    }

    if (trimmedContent.length > MAX_CHAT_MESSAGE_LENGTH) {
      return { ok: false, error: `Message too long (max ${MAX_CHAT_MESSAGE_LENGTH} characters)` };
    }

    const messageId = await ctx.db.insert("chatMessages", {
      channel: "town",
      senderId: agent._id,
      senderName: agent.name,
      recipientId: undefined,
      clanId: undefined,
      content: trimmedContent,
      timestamp: Date.now(),
    });

    return {
      ok: true,
      data: {
        messageId,
        channel: "town",
        content: trimmedContent,
      },
    };
  },
});

// Send clan chat message
export const sendClan = mutation({
  args: {
    apiKey: v.string(),
    content: v.string(),
  },
  handler: async (ctx, { apiKey, content }) => {
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

    if (!agent.clanId) {
      return { ok: false, error: "You are not in a clan" };
    }

    // Rate limit
    const rateCheck = await checkRateLimit(ctx, agent._id, "chat", CHAT_COOLDOWN_MS);
    if (!rateCheck.allowed) {
      return { ok: false, error: `Rate limited. Wait ${Math.ceil(rateCheck.waitMs! / 1000)}s` };
    }

    // Validate content
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      return { ok: false, error: "Message cannot be empty" };
    }

    if (trimmedContent.length > MAX_CHAT_MESSAGE_LENGTH) {
      return { ok: false, error: `Message too long (max ${MAX_CHAT_MESSAGE_LENGTH} characters)` };
    }

    const messageId = await ctx.db.insert("chatMessages", {
      channel: "clan",
      senderId: agent._id,
      senderName: agent.name,
      recipientId: undefined,
      clanId: agent.clanId,
      content: trimmedContent,
      timestamp: Date.now(),
    });

    return {
      ok: true,
      data: {
        messageId,
        channel: "clan",
        clanId: agent.clanId,
        content: trimmedContent,
      },
    };
  },
});

// Send direct message
export const sendDM = mutation({
  args: {
    apiKey: v.string(),
    recipientId: v.id("agents"),
    content: v.string(),
  },
  handler: async (ctx, { apiKey, recipientId, content }) => {
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

    const recipient = await ctx.db.get(recipientId);
    if (!recipient) {
      return { ok: false, error: "Recipient not found" };
    }

    // Rate limit
    const rateCheck = await checkRateLimit(ctx, agent._id, "chat", CHAT_COOLDOWN_MS);
    if (!rateCheck.allowed) {
      return { ok: false, error: `Rate limited. Wait ${Math.ceil(rateCheck.waitMs! / 1000)}s` };
    }

    // Validate content
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      return { ok: false, error: "Message cannot be empty" };
    }

    if (trimmedContent.length > MAX_CHAT_MESSAGE_LENGTH) {
      return { ok: false, error: `Message too long (max ${MAX_CHAT_MESSAGE_LENGTH} characters)` };
    }

    const messageId = await ctx.db.insert("chatMessages", {
      channel: "dm",
      senderId: agent._id,
      senderName: agent.name,
      recipientId,
      clanId: undefined,
      content: trimmedContent,
      timestamp: Date.now(),
    });

    // Notify recipient
    await ctx.db.insert("notifications", {
      agentId: recipientId,
      type: "dm",
      message: `New message from ${agent.name}`,
      timestamp: Date.now(),
      read: false,
    });

    return {
      ok: true,
      data: {
        messageId,
        channel: "dm",
        recipientId,
        recipientName: recipient.name,
        content: trimmedContent,
      },
    };
  },
});
