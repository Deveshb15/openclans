import type {
  Agent,
  ApiResponse,
  Clan,
  ClanTreasury,
  RawResources,
  RefinedMaterials,
} from "../../src/shared/types";
import { PRESTIGE } from "../../src/shared/constants";
import type { Db } from "../db/client";
import {
  getClanById,
  getClanByName,
  getClanByTag,
  getAllClans,
  insertClan,
  updateClan,
  deleteClan,
  updateAgent,
  getAgentById,
  insertNotification,
  insertActivity,
} from "../db/queries";

/**
 * POST /clans — requires 100+ reputation
 */
export async function handleCreateClan(
  body: { name?: string; tag?: string; description?: string },
  agent: Agent,
  db: Db
): Promise<Response> {
  if (agent.reputation < PRESTIGE.THRESHOLD_CLANS) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: `Creating a clan requires ${PRESTIGE.THRESHOLD_CLANS} reputation. You have ${agent.reputation}.` },
      403
    );
  }

  if (agent.clanId) {
    return jsonResponse<ApiResponse>({ ok: false, error: "You are already in a clan." }, 409);
  }

  if (!body.name || typeof body.name !== "string") return jsonResponse<ApiResponse>({ ok: false, error: "Missing 'name'" }, 400);
  if (!body.tag || typeof body.tag !== "string") return jsonResponse<ApiResponse>({ ok: false, error: "Missing 'tag'" }, 400);

  const name = body.name.trim();
  const tag = body.tag.trim().toUpperCase();
  const description = (body.description || "").trim().slice(0, 200);

  if (name.length < 2 || name.length > 30) return jsonResponse<ApiResponse>({ ok: false, error: "Name must be 2-30 characters" }, 400);
  if (tag.length < 2 || tag.length > 4) return jsonResponse<ApiResponse>({ ok: false, error: "Tag must be 2-4 characters" }, 400);

  if (await getClanByName(db, name)) return jsonResponse<ApiResponse>({ ok: false, error: "Name taken" }, 409);
  if (await getClanByTag(db, tag)) return jsonResponse<ApiResponse>({ ok: false, error: "Tag taken" }, 409);

  const clan: Clan = {
    id: crypto.randomUUID(),
    name,
    tag,
    leaderId: agent.id,
    memberIds: [agent.id],
    treasury: { raw: {}, refined: {}, tokens: 0 },
    createdAt: Date.now(),
    description,
  };

  await insertClan(db, clan);
  await updateAgent(db, agent.id, { clanId: clan.id });
  await insertActivity(db, "clan_created", agent.id, agent.name, `${agent.name} founded [${tag}] ${name}`);

  return jsonResponse<ApiResponse>({ ok: true, data: { clan, message: `Clan [${tag}] ${name} founded!` } }, 201);
}

/**
 * GET /clans
 */
export async function handleGetClans(db: Db): Promise<Response> {
  const allClans = await getAllClans(db);
  const clansWithCount = allClans.map(c => ({ ...c, memberCount: c.memberIds.length }));
  return jsonResponse<ApiResponse>({ ok: true, data: { clans: clansWithCount } });
}

/**
 * POST /clans/:id/join
 */
export async function handleJoinClan(clanId: string, agent: Agent, db: Db): Promise<Response> {
  if (agent.clanId) return jsonResponse<ApiResponse>({ ok: false, error: "Already in a clan." }, 409);
  const clan = await getClanById(db, clanId);
  if (!clan) return jsonResponse<ApiResponse>({ ok: false, error: "Clan not found" }, 404);

  const newMemberIds = [...clan.memberIds, agent.id];
  await updateClan(db, clanId, { memberIds: newMemberIds });
  await updateAgent(db, agent.id, { clanId: clan.id });
  await insertNotification(db, clan.leaderId, "clan_joined", `${agent.name} joined [${clan.tag}]`);
  for (const memberId of clan.memberIds) {
    if (memberId !== agent.id) {
      await insertNotification(db, memberId, "clan_member_joined", `${agent.name} joined [${clan.tag}]`);
    }
  }
  await insertActivity(db, "clan_joined", agent.id, agent.name, `${agent.name} joined [${clan.tag}] ${clan.name}`);

  return jsonResponse<ApiResponse>({ ok: true, data: { clan: { ...clan, memberIds: newMemberIds }, message: `Joined [${clan.tag}]!` } });
}

/**
 * POST /clans/:id/leave
 */
export async function handleLeaveClan(clanId: string, agent: Agent, db: Db): Promise<Response> {
  const clan = await getClanById(db, clanId);
  if (!clan) return jsonResponse<ApiResponse>({ ok: false, error: "Clan not found" }, 404);
  if (agent.clanId !== clanId) return jsonResponse<ApiResponse>({ ok: false, error: "Not in this clan" }, 403);

  const newMemberIds = clan.memberIds.filter(id => id !== agent.id);
  await updateAgent(db, agent.id, { clanId: null });

  if (newMemberIds.length === 0) {
    await deleteClan(db, clanId);
    await insertActivity(db, "clan_disbanded", agent.id, agent.name, `[${clan.tag}] ${clan.name} disbanded`);
    return jsonResponse<ApiResponse>({ ok: true, data: { message: `Left and [${clan.tag}] disbanded.` } });
  }

  let newLeaderId = clan.leaderId;
  if (clan.leaderId === agent.id) {
    newLeaderId = newMemberIds[0];
    const newLeader = await getAgentById(db, newLeaderId);
    await insertNotification(db, newLeaderId, "clan_leader", `You are now leader of [${clan.tag}]`);
    await insertActivity(db, "clan_leader_change", newLeaderId, newLeader?.name || "Unknown",
      `${newLeader?.name || "Unknown"} is now leader of [${clan.tag}]`);
  }

  await updateClan(db, clanId, { memberIds: newMemberIds, leaderId: newLeaderId });
  for (const memberId of newMemberIds) {
    await insertNotification(db, memberId, "clan_member_left", `${agent.name} left [${clan.tag}]`);
  }
  await insertActivity(db, "clan_left", agent.id, agent.name, `${agent.name} left [${clan.tag}]`);

  return jsonResponse<ApiResponse>({ ok: true, data: { message: `Left [${clan.tag}]` } });
}

/**
 * POST /clans/:id/donate — donate resources to clan treasury
 */
export async function handleDonateToClan(
  clanId: string,
  body: { raw?: Partial<Record<string, number>>; refined?: Partial<Record<string, number>>; tokens?: number },
  agent: Agent,
  db: Db
): Promise<Response> {
  const clan = await getClanById(db, clanId);
  if (!clan) return jsonResponse<ApiResponse>({ ok: false, error: "Clan not found" }, 404);
  if (agent.clanId !== clanId) return jsonResponse<ApiResponse>({ ok: false, error: "Not in this clan" }, 403);

  const inv = agent.inventory;
  const agentUpdates: Record<string, number> = {};
  const clanUpdates: Record<string, number> = {};
  let totalDonated = 0;

  const rawColMap: Record<string, string> = { wood: "rawWood", stone: "rawStone", water: "rawWater", food: "rawFood", clay: "rawClay" };
  const treasuryRawColMap: Record<string, string> = { wood: "treasuryRawWood", stone: "treasuryRawStone", water: "treasuryRawWater", food: "treasuryRawFood", clay: "treasuryRawClay" };

  if (body.raw) {
    for (const [key, amount] of Object.entries(body.raw)) {
      if (!amount || amount <= 0) continue;
      const available = (inv.raw as any)[key] ?? 0;
      const toDonate = Math.min(amount, available);
      if (toDonate > 0) {
        agentUpdates[rawColMap[key]] = available - toDonate;
        clanUpdates[treasuryRawColMap[key]] = ((clan.treasury.raw as any)[key] ?? 0) + toDonate;
        totalDonated += toDonate;
      }
    }
  }

  const refinedColMap: Record<string, string> = { planks: "refinedPlanks", bricks: "refinedBricks", cement: "refinedCement", glass: "refinedGlass", steel: "refinedSteel" };
  const treasuryRefinedColMap: Record<string, string> = { planks: "treasuryRefinedPlanks", bricks: "treasuryRefinedBricks", cement: "treasuryRefinedCement", glass: "treasuryRefinedGlass", steel: "treasuryRefinedSteel" };

  if (body.refined) {
    for (const [key, amount] of Object.entries(body.refined)) {
      if (!amount || amount <= 0) continue;
      const available = (inv.refined as any)[key] ?? 0;
      const toDonate = Math.min(amount, available);
      if (toDonate > 0) {
        agentUpdates[refinedColMap[key]] = available - toDonate;
        clanUpdates[treasuryRefinedColMap[key]] = ((clan.treasury.refined as any)[key] ?? 0) + toDonate;
        totalDonated += toDonate;
      }
    }
  }

  if (body.tokens && body.tokens > 0) {
    const toDonate = Math.min(body.tokens, inv.tokens);
    if (toDonate > 0) {
      agentUpdates.tokens = inv.tokens - toDonate;
      clanUpdates.treasuryTokens = (clan.treasury.tokens ?? 0) + toDonate;
      totalDonated += toDonate;
    }
  }

  if (totalDonated === 0) {
    return jsonResponse<ApiResponse>({ ok: false, error: "No resources donated" }, 400);
  }

  // Award reputation
  agentUpdates.reputation = agent.reputation + Math.min(Math.floor(totalDonated / 5), 10);
  await updateAgent(db, agent.id, agentUpdates);
  await updateClan(db, clanId, clanUpdates);

  if (clan.leaderId !== agent.id) {
    await insertNotification(db, clan.leaderId, "clan_donation", `${agent.name} donated to [${clan.tag}]`);
  }
  await insertActivity(db, "clan_donation", agent.id, agent.name, `${agent.name} donated to [${clan.tag}]`);

  return jsonResponse<ApiResponse>({
    ok: true,
    data: { totalDonated, message: `Donated ${totalDonated} resources to [${clan.tag}]` },
  });
}

function jsonResponse<T>(data: T, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
