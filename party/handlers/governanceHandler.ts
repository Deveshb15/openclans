import type {
  Agent,
  ApiResponse,
  Proposal,
  ProposalType,
  VoteChoice,
} from "../../src/shared/types";
import {
  PRESTIGE,
  PROPOSAL_DURATION_MS,
  PROPOSAL_MIN_VOTERS,
  PROPOSAL_PASS_THRESHOLD,
} from "../../src/shared/constants";
import type { Db } from "../db/client";
import {
  getProposalById,
  getProposalsByProposer,
  getAllProposalsSorted,
  getExpiredActiveProposals,
  insertProposal,
  updateProposal,
  getAllAgents,
  getAgentById,
  getAgentCount,
  updateAgent,
  insertNotification,
  insertActivity,
} from "../db/queries";

/**
 * POST /governance/proposals
 * Creates a new governance proposal. Requires prestige >= 50.
 */
export async function handleCreateProposal(
  body: { type?: string; title?: string; description?: string },
  agent: Agent,
  db: Db
): Promise<Response> {
  if (agent.prestige < PRESTIGE.THRESHOLD_PROPOSALS) {
    return jsonResponse<ApiResponse>(
      {
        ok: false,
        error: `Creating proposals requires ${PRESTIGE.THRESHOLD_PROPOSALS} prestige. You have ${agent.prestige}.`,
      },
      403
    );
  }

  if (!body.type || !body.title) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Missing required fields: type, title" },
      400
    );
  }

  const validTypes: ProposalType[] = ["infrastructure", "policy", "treasury"];
  if (!validTypes.includes(body.type as ProposalType)) {
    return jsonResponse<ApiResponse>(
      {
        ok: false,
        error: `Invalid proposal type. Must be one of: ${validTypes.join(", ")}`,
      },
      400
    );
  }

  const title = body.title.trim().slice(0, 100);
  const description = (body.description || "").trim().slice(0, 500);

  if (title.length < 3) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Title must be at least 3 characters" },
      400
    );
  }

  // Check for too many active proposals from this agent
  const activeProposals = await getProposalsByProposer(db, agent.id, "active");
  if (activeProposals.length >= 3) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "You already have 3 active proposals. Wait for them to resolve." },
      429
    );
  }

  const now = Date.now();
  const proposal: Proposal = {
    id: crypto.randomUUID(),
    type: body.type as ProposalType,
    title,
    description,
    proposerId: agent.id,
    proposerName: agent.name,
    votes: {},
    createdAt: now,
    expiresAt: now + PROPOSAL_DURATION_MS,
    status: "active",
  };

  await insertProposal(db, proposal);

  await insertActivity(
    db,
    "proposal_created",
    agent.id,
    agent.name,
    `${agent.name} created proposal: "${title}"`
  );

  // Notify all online agents
  const allAgents = await getAllAgents(db);
  for (const a of allAgents) {
    if (a.id !== agent.id && a.online) {
      await insertNotification(
        db,
        a.id,
        "proposal_created",
        `New proposal by ${agent.name}: "${title}"`
      );
    }
  }

  return jsonResponse<ApiResponse>({
    ok: true,
    data: {
      proposal,
      message: `Proposal created. Voting is open for ${PROPOSAL_DURATION_MS / (60 * 60 * 1000)} hours.`,
    },
  }, 201);
}

/**
 * GET /governance/proposals
 * Returns all proposals (active and resolved).
 */
export async function handleGetProposals(db: Db): Promise<Response> {
  const allProposals = await getAllProposalsSorted(db);

  return jsonResponse<ApiResponse>({
    ok: true,
    data: { proposals: allProposals },
  });
}

/**
 * POST /governance/proposals/:id/vote
 * Casts a vote on a proposal. One vote per agent, but agents with
 * prestige >= 500 get double vote weight.
 */
export async function handleVote(
  proposalId: string,
  body: { vote?: string },
  agent: Agent,
  db: Db
): Promise<Response> {
  const proposal = await getProposalById(db, proposalId);
  if (!proposal) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Proposal not found" },
      404
    );
  }

  if (proposal.status !== "active") {
    return jsonResponse<ApiResponse>(
      { ok: false, error: `Proposal is no longer active (status: ${proposal.status})` },
      409
    );
  }

  // Check if expired
  const now = Date.now();
  if (now > proposal.expiresAt) {
    await resolveProposal(proposal, db);
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Proposal has expired" },
      410
    );
  }

  if (!body.vote || typeof body.vote !== "string") {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Missing 'vote' field" },
      400
    );
  }

  const validVotes: VoteChoice[] = ["yes", "no", "abstain"];
  if (!validVotes.includes(body.vote as VoteChoice)) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: `Invalid vote. Must be one of: ${validVotes.join(", ")}` },
      400
    );
  }

  // Check if already voted
  if (proposal.votes[agent.id]) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "You have already voted on this proposal" },
      409
    );
  }

  // Record vote
  const newVotes = { ...proposal.votes, [agent.id]: body.vote as VoteChoice };
  await updateProposal(db, proposalId, { votes: newVotes });

  // Award prestige for voting
  await updateAgent(db, agent.id, { prestige: agent.prestige + PRESTIGE.VOTE });

  await insertActivity(
    db,
    "proposal_voted",
    agent.id,
    agent.name,
    `${agent.name} voted on proposal: "${proposal.title}"`
  );

  // Check if proposal should be resolved
  const voterCount = Object.keys(newVotes).length;
  if (voterCount >= PROPOSAL_MIN_VOTERS) {
    const agentCount = await getAgentCount(db);
    if (voterCount >= agentCount * 0.5 || now > proposal.expiresAt) {
      const updatedProposal = { ...proposal, votes: newVotes };
      await resolveProposal(updatedProposal, db);
    }
  }

  return jsonResponse<ApiResponse>({
    ok: true,
    data: {
      message: `Vote recorded: ${body.vote}`,
      voterCount,
      proposal: { ...proposal, votes: newVotes },
    },
  });
}

/**
 * Tallies votes on a proposal, accounting for double votes from high-prestige agents.
 */
async function tallyVotes(
  proposal: Proposal,
  db: Db
): Promise<{ yes: number; no: number; abstain: number; total: number }> {
  let yes = 0;
  let no = 0;
  let abstain = 0;

  for (const [agentId, vote] of Object.entries(proposal.votes)) {
    const a = await getAgentById(db, agentId);
    const weight =
      a && a.prestige >= PRESTIGE.THRESHOLD_DOUBLE_VOTES ? 2 : 1;

    switch (vote) {
      case "yes":
        yes += weight;
        break;
      case "no":
        no += weight;
        break;
      case "abstain":
        abstain += weight;
        break;
    }
  }

  return { yes, no, abstain, total: yes + no + abstain };
}

/**
 * Resolves a proposal based on its votes.
 */
async function resolveProposal(
  proposal: Proposal,
  db: Db
): Promise<void> {
  if (proposal.status !== "active") return;

  const voterCount = Object.keys(proposal.votes).length;

  // Not enough voters
  if (voterCount < PROPOSAL_MIN_VOTERS) {
    await updateProposal(db, proposal.id, {
      status: "expired",
      result: `Expired: only ${voterCount}/${PROPOSAL_MIN_VOTERS} votes cast`,
    });

    await insertActivity(
      db,
      "proposal_resolved",
      proposal.proposerId,
      proposal.proposerName,
      `Proposal "${proposal.title}" expired (insufficient votes)`
    );
    return;
  }

  const tally = await tallyVotes(proposal, db);
  const totalVoting = tally.yes + tally.no; // Abstains don't count for threshold

  if (totalVoting === 0) {
    await updateProposal(db, proposal.id, {
      status: "expired",
      result: "Expired: all votes were abstentions",
    });
    return;
  }

  const yesRatio = tally.yes / totalVoting;

  if (yesRatio >= PROPOSAL_PASS_THRESHOLD) {
    await updateProposal(db, proposal.id, {
      status: "passed",
      result: `Passed: ${tally.yes} yes, ${tally.no} no, ${tally.abstain} abstain (${Math.round(yesRatio * 100)}% approval)`,
    });

    // Award proposer prestige
    const proposer = await getAgentById(db, proposal.proposerId);
    if (proposer) {
      await updateAgent(db, proposer.id, {
        prestige: proposer.prestige + PRESTIGE.PROPOSAL_PASSED,
      });
    }

    await insertActivity(
      db,
      "proposal_resolved",
      proposal.proposerId,
      proposal.proposerName,
      `Proposal "${proposal.title}" PASSED (${Math.round(yesRatio * 100)}% approval)`
    );

    // Notify all agents
    const allAgents = await getAllAgents(db);
    for (const a of allAgents) {
      await insertNotification(
        db,
        a.id,
        "proposal_passed",
        `Proposal "${proposal.title}" has passed!`
      );
    }
  } else {
    await updateProposal(db, proposal.id, {
      status: "failed",
      result: `Failed: ${tally.yes} yes, ${tally.no} no, ${tally.abstain} abstain (${Math.round(yesRatio * 100)}% approval)`,
    });

    await insertActivity(
      db,
      "proposal_resolved",
      proposal.proposerId,
      proposal.proposerName,
      `Proposal "${proposal.title}" failed (${Math.round(yesRatio * 100)}% approval)`
    );
  }
}

/**
 * Checks all active proposals and resolves any that have expired.
 */
export async function checkExpiredProposals(db: Db): Promise<void> {
  const now = Date.now();
  const expired = await getExpiredActiveProposals(db, now);
  for (const proposal of expired) {
    await resolveProposal(proposal, db);
  }
}

/**
 * Helper to create a JSON Response.
 */
function jsonResponse<T>(data: T, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
