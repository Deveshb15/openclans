import type {
  Agent,
  ApiResponse,
  Clan,
  Resources,
  ResourceType,
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
 * POST /clans
 * Creates a new clan. Requires prestige >= 100.
 */
export async function handleCreateClan(
  body: { name?: string; tag?: string; description?: string },
  agent: Agent,
  db: Db
): Promise<Response> {
  if (agent.prestige < PRESTIGE.THRESHOLD_CLANS) {
    return jsonResponse<ApiResponse>(
      {
        ok: false,
        error: `Creating a clan requires ${PRESTIGE.THRESHOLD_CLANS} prestige. You have ${agent.prestige}.`,
      },
      403
    );
  }

  if (agent.clanId) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "You are already in a clan. Leave your current clan first." },
      409
    );
  }

  if (!body.name || typeof body.name !== "string") {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Missing or invalid 'name' field" },
      400
    );
  }

  if (!body.tag || typeof body.tag !== "string") {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Missing or invalid 'tag' field" },
      400
    );
  }

  const name = body.name.trim();
  const tag = body.tag.trim().toUpperCase();
  const description = (body.description || "").trim().slice(0, 200);

  if (name.length < 2 || name.length > 30) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Clan name must be between 2 and 30 characters" },
      400
    );
  }

  if (tag.length < 2 || tag.length > 4) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Clan tag must be between 2 and 4 characters" },
      400
    );
  }

  // Check for duplicate name or tag
  const existingByName = await getClanByName(db, name);
  if (existingByName) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "A clan with that name already exists" },
      409
    );
  }

  const existingByTag = await getClanByTag(db, tag);
  if (existingByTag) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "A clan with that tag already exists" },
      409
    );
  }

  const clan: Clan = {
    id: crypto.randomUUID(),
    name,
    tag,
    leaderId: agent.id,
    memberIds: [agent.id],
    treasury: { wood: 0, stone: 0, food: 0, gold: 0 },
    createdAt: Date.now(),
    description,
  };

  await insertClan(db, clan);
  await updateAgent(db, agent.id, { clanId: clan.id });

  await insertActivity(
    db,
    "clan_created",
    agent.id,
    agent.name,
    `${agent.name} founded the clan [${tag}] ${name}`
  );

  return jsonResponse<ApiResponse>({
    ok: true,
    data: {
      clan,
      message: `Clan [${tag}] ${name} has been founded!`,
    },
  }, 201);
}

/**
 * GET /clans
 * Returns all clans with their member counts.
 */
export async function handleGetClans(db: Db): Promise<Response> {
  const allClans = await getAllClans(db);
  const clansWithCount = allClans.map((clan) => ({
    ...clan,
    memberCount: clan.memberIds.length,
  }));

  return jsonResponse<ApiResponse>({
    ok: true,
    data: { clans: clansWithCount },
  });
}

/**
 * POST /clans/:id/join
 * Joins a clan.
 */
export async function handleJoinClan(
  clanId: string,
  agent: Agent,
  db: Db
): Promise<Response> {
  if (agent.clanId) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "You are already in a clan. Leave your current clan first." },
      409
    );
  }

  const clan = await getClanById(db, clanId);
  if (!clan) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Clan not found" },
      404
    );
  }

  // Add member
  const newMemberIds = [...clan.memberIds, agent.id];
  await updateClan(db, clanId, { memberIds: newMemberIds });
  await updateAgent(db, agent.id, { clanId: clan.id });

  // Notify clan leader
  await insertNotification(
    db,
    clan.leaderId,
    "clan_joined",
    `${agent.name} joined your clan [${clan.tag}]`
  );

  // Notify all clan members
  for (const memberId of clan.memberIds) {
    if (memberId !== agent.id) {
      await insertNotification(
        db,
        memberId,
        "clan_member_joined",
        `${agent.name} joined [${clan.tag}]`
      );
    }
  }

  await insertActivity(
    db,
    "clan_joined",
    agent.id,
    agent.name,
    `${agent.name} joined clan [${clan.tag}] ${clan.name}`
  );

  return jsonResponse<ApiResponse>({
    ok: true,
    data: {
      clan: { ...clan, memberIds: newMemberIds },
      message: `You have joined [${clan.tag}] ${clan.name}!`,
    },
  });
}

/**
 * POST /clans/:id/leave
 * Leaves a clan. If the leader leaves, leadership transfers to next member
 * or the clan is disbanded.
 */
export async function handleLeaveClan(
  clanId: string,
  agent: Agent,
  db: Db
): Promise<Response> {
  const clan = await getClanById(db, clanId);
  if (!clan) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Clan not found" },
      404
    );
  }

  if (agent.clanId !== clanId) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "You are not a member of this clan" },
      403
    );
  }

  // Remove from member list
  const newMemberIds = clan.memberIds.filter((id) => id !== agent.id);
  await updateAgent(db, agent.id, { clanId: null });

  if (newMemberIds.length === 0) {
    // Clan is empty, disband it
    await deleteClan(db, clanId);

    await insertActivity(
      db,
      "clan_disbanded",
      agent.id,
      agent.name,
      `Clan [${clan.tag}] ${clan.name} has been disbanded`
    );

    return jsonResponse<ApiResponse>({
      ok: true,
      data: { message: `You left and [${clan.tag}] ${clan.name} has been disbanded.` },
    });
  }

  // If leader left, transfer leadership
  let newLeaderId = clan.leaderId;
  if (clan.leaderId === agent.id) {
    newLeaderId = newMemberIds[0];
    const newLeader = await getAgentById(db, newLeaderId);

    await insertNotification(
      db,
      newLeaderId,
      "clan_leader",
      `You are now the leader of [${clan.tag}] ${clan.name}`
    );

    await insertActivity(
      db,
      "clan_leader_change",
      newLeaderId,
      newLeader?.name || "Unknown",
      `${newLeader?.name || "Unknown"} is now the leader of [${clan.tag}]`
    );
  }

  await updateClan(db, clanId, {
    memberIds: newMemberIds,
    leaderId: newLeaderId,
  });

  // Notify clan members
  for (const memberId of newMemberIds) {
    await insertNotification(
      db,
      memberId,
      "clan_member_left",
      `${agent.name} left [${clan.tag}]`
    );
  }

  await insertActivity(
    db,
    "clan_left",
    agent.id,
    agent.name,
    `${agent.name} left clan [${clan.tag}] ${clan.name}`
  );

  return jsonResponse<ApiResponse>({
    ok: true,
    data: { message: `You have left [${clan.tag}] ${clan.name}` },
  });
}

/**
 * POST /clans/:id/donate
 * Donates resources from the agent to the clan treasury.
 */
export async function handleDonateToClan(
  clanId: string,
  body: { resources?: Partial<Resources> },
  agent: Agent,
  db: Db
): Promise<Response> {
  const clan = await getClanById(db, clanId);
  if (!clan) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Clan not found" },
      404
    );
  }

  if (agent.clanId !== clanId) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "You are not a member of this clan" },
      403
    );
  }

  if (!body.resources) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Missing 'resources' field with donation amounts" },
      400
    );
  }

  const donated: Resources = { wood: 0, stone: 0, food: 0, gold: 0 };

  for (const [key, amount] of Object.entries(body.resources)) {
    const resKey = key as ResourceType;
    if (amount === undefined || amount <= 0 || typeof amount !== "number") continue;

    const toDonate = Math.min(amount, agent.resources[resKey]);
    if (toDonate <= 0) continue;

    donated[resKey] = toDonate;
  }

  const totalDonated =
    donated.wood + donated.stone + donated.food + donated.gold;

  if (totalDonated === 0) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "No resources were donated (insufficient or zero amounts)" },
      400
    );
  }

  // Deduct from agent
  await updateAgent(db, agent.id, {
    resourceWood: agent.resources.wood - donated.wood,
    resourceStone: agent.resources.stone - donated.stone,
    resourceFood: agent.resources.food - donated.food,
    resourceGold: agent.resources.gold - donated.gold,
    prestige: agent.prestige + Math.min(Math.floor(totalDonated / 5), 10),
  });

  // Add to clan treasury
  await updateClan(db, clanId, {
    treasuryWood: clan.treasury.wood + donated.wood,
    treasuryStone: clan.treasury.stone + donated.stone,
    treasuryFood: clan.treasury.food + donated.food,
    treasuryGold: clan.treasury.gold + donated.gold,
  });

  // Notify clan leader
  if (clan.leaderId !== agent.id) {
    await insertNotification(
      db,
      clan.leaderId,
      "clan_donation",
      `${agent.name} donated resources to [${clan.tag}] treasury`
    );
  }

  await insertActivity(
    db,
    "clan_donation",
    agent.id,
    agent.name,
    `${agent.name} donated resources to [${clan.tag}]`
  );

  const newTreasury = {
    wood: clan.treasury.wood + donated.wood,
    stone: clan.treasury.stone + donated.stone,
    food: clan.treasury.food + donated.food,
    gold: clan.treasury.gold + donated.gold,
  };

  return jsonResponse<ApiResponse>({
    ok: true,
    data: {
      donated,
      treasury: newTreasury,
      message: `Donated to [${clan.tag}] treasury: +${donated.wood} wood, +${donated.stone} stone, +${donated.food} food, +${donated.gold} gold`,
    },
  });
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
