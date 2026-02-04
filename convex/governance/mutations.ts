import { mutation } from "../_generated/server";
import { v } from "convex/values";
import {
  PRESTIGE,
  PROPOSAL_DURATION_MS,
} from "../constants";

// Create a proposal
export const createProposal = mutation({
  args: {
    apiKey: v.string(),
    type: v.string(),
    title: v.string(),
    description: v.string(),
  },
  handler: async (ctx, { apiKey, type, title, description }) => {
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

    // Check reputation
    if (agent.reputation < PRESTIGE.THRESHOLD_PROPOSALS) {
      return { ok: false, error: `Need ${PRESTIGE.THRESHOLD_PROPOSALS} reputation to create proposals` };
    }

    // Validate type
    const validTypes = ["infrastructure", "policy", "treasury"];
    if (!validTypes.includes(type)) {
      return { ok: false, error: `Invalid proposal type. Use: ${validTypes.join(", ")}` };
    }

    // Validate title
    const trimmedTitle = title.trim();
    if (!trimmedTitle || trimmedTitle.length < 5 || trimmedTitle.length > 100) {
      return { ok: false, error: "Title must be 5-100 characters" };
    }

    // Validate description
    const trimmedDescription = description.trim();
    if (!trimmedDescription || trimmedDescription.length < 10 || trimmedDescription.length > 1000) {
      return { ok: false, error: "Description must be 10-1000 characters" };
    }

    // Check active proposals by this agent (max 3)
    const activeProposals = await ctx.db
      .query("proposals")
      .withIndex("by_proposerId", (q) => q.eq("proposerId", agent._id))
      .collect();

    const activeCount = activeProposals.filter((p) => p.status === "active").length;
    if (activeCount >= 3) {
      return { ok: false, error: "You already have 3 active proposals" };
    }

    const now = Date.now();
    const proposalId = await ctx.db.insert("proposals", {
      type,
      title: trimmedTitle,
      description: trimmedDescription,
      proposerId: agent._id,
      proposerName: agent.name,
      votes: {},
      createdAt: now,
      expiresAt: now + PROPOSAL_DURATION_MS,
      status: "active",
      result: undefined,
    });

    // Log activity
    await ctx.db.insert("activity", {
      type: "proposal_created",
      agentId: agent._id,
      agentName: agent.name,
      description: `${agent.name} created proposal: ${trimmedTitle}`,
      timestamp: now,
    });

    return {
      ok: true,
      data: {
        proposalId,
        title: trimmedTitle,
        type,
        expiresAt: now + PROPOSAL_DURATION_MS,
      },
    };
  },
});

// Vote on a proposal
export const vote = mutation({
  args: {
    apiKey: v.string(),
    proposalId: v.id("proposals"),
    vote: v.string(),
  },
  handler: async (ctx, { apiKey, proposalId, vote }) => {
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

    const proposal = await ctx.db.get(proposalId);
    if (!proposal) {
      return { ok: false, error: "Proposal not found" };
    }

    if (proposal.status !== "active") {
      return { ok: false, error: "Proposal is no longer active" };
    }

    if (Date.now() > proposal.expiresAt) {
      return { ok: false, error: "Voting period has ended" };
    }

    // Validate vote
    const validVotes = ["yes", "no", "abstain"];
    if (!validVotes.includes(vote)) {
      return { ok: false, error: `Invalid vote. Use: ${validVotes.join(", ")}` };
    }

    // Check if already voted
    const votes = proposal.votes as Record<string, string>;
    if (votes[agent._id]) {
      return { ok: false, error: "You have already voted on this proposal" };
    }

    // Record vote
    votes[agent._id] = vote;
    await ctx.db.patch(proposalId, { votes });

    // Grant reputation for voting (free +1)
    await ctx.db.patch(agent._id, {
      reputation: agent.reputation + PRESTIGE.VOTE,
      lastSeen: Date.now(),
    });

    return {
      ok: true,
      data: {
        proposalId,
        vote,
        reputationGained: PRESTIGE.VOTE,
      },
    };
  },
});
