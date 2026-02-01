import type { Agent, ApiResponse, ChatMessage, ChatChannel } from "../../src/shared/types";
import {
  MAX_CHAT_MESSAGES,
  MAX_CHAT_MESSAGE_LENGTH,
} from "../../src/shared/constants";
import type { Db } from "../db/client";
import {
  getChatByChannel,
  getClanChat,
  getDMChat,
  insertChatMessage,
  insertNotification,
  getClanById,
  getAgentById,
} from "../db/queries";

/**
 * POST /chat/town
 * Sends a message to the town-wide chat.
 */
export async function handleTownChat(
  body: { content?: string },
  agent: Agent,
  db: Db
): Promise<Response> {
  if (!body.content || typeof body.content !== "string") {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Missing or invalid 'content' field" },
      400
    );
  }

  const content = body.content.trim().slice(0, MAX_CHAT_MESSAGE_LENGTH);
  if (content.length === 0) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Message content cannot be empty" },
      400
    );
  }

  const message: ChatMessage = {
    id: crypto.randomUUID(),
    channel: "town",
    senderId: agent.id,
    senderName: agent.name,
    content,
    timestamp: Date.now(),
  };

  await insertChatMessage(db, message);

  return jsonResponse<ApiResponse>({
    ok: true,
    data: { message },
  }, 201);
}

/**
 * POST /chat/clan
 * Sends a message to the agent's clan chat. Only works if agent is in a clan.
 */
export async function handleClanChat(
  body: { content?: string },
  agent: Agent,
  db: Db
): Promise<Response> {
  if (!agent.clanId) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "You are not in a clan" },
      403
    );
  }

  const clan = await getClanById(db, agent.clanId);
  if (!clan) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Clan not found" },
      404
    );
  }

  if (!body.content || typeof body.content !== "string") {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Missing or invalid 'content' field" },
      400
    );
  }

  const content = body.content.trim().slice(0, MAX_CHAT_MESSAGE_LENGTH);
  if (content.length === 0) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Message content cannot be empty" },
      400
    );
  }

  const message: ChatMessage = {
    id: crypto.randomUUID(),
    channel: "clan",
    senderId: agent.id,
    senderName: agent.name,
    clanId: agent.clanId,
    content,
    timestamp: Date.now(),
  };

  await insertChatMessage(db, message);

  // Notify clan members
  for (const memberId of clan.memberIds) {
    if (memberId !== agent.id) {
      await insertNotification(
        db,
        memberId,
        "clan_chat",
        `[${clan.tag}] ${agent.name}: ${content.slice(0, 50)}${content.length > 50 ? "..." : ""}`
      );
    }
  }

  return jsonResponse<ApiResponse>({
    ok: true,
    data: { message },
  }, 201);
}

/**
 * POST /chat/dm/:agent
 * Sends a direct message to another agent.
 */
export async function handleDM(
  recipientId: string,
  body: { content?: string },
  agent: Agent,
  db: Db
): Promise<Response> {
  if (recipientId === agent.id) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Cannot send a DM to yourself" },
      400
    );
  }

  const recipient = await getAgentById(db, recipientId);
  if (!recipient) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Recipient agent not found" },
      404
    );
  }

  if (!body.content || typeof body.content !== "string") {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Missing or invalid 'content' field" },
      400
    );
  }

  const content = body.content.trim().slice(0, MAX_CHAT_MESSAGE_LENGTH);
  if (content.length === 0) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Message content cannot be empty" },
      400
    );
  }

  const message: ChatMessage = {
    id: crypto.randomUUID(),
    channel: "dm",
    senderId: agent.id,
    senderName: agent.name,
    recipientId,
    content,
    timestamp: Date.now(),
  };

  await insertChatMessage(db, message);

  // Notify recipient
  await insertNotification(
    db,
    recipientId,
    "dm",
    `DM from ${agent.name}: ${content.slice(0, 50)}${content.length > 50 ? "..." : ""}`
  );

  return jsonResponse<ApiResponse>({
    ok: true,
    data: { message },
  }, 201);
}

/**
 * GET /chat/town, /chat/clan, /chat/dm/:agent
 * Returns recent chat messages for the given channel, optionally filtered.
 */
export async function handleGetChat(
  query: { channel: ChatChannel; recipientId?: string; limit?: number },
  agent: Agent,
  db: Db
): Promise<Response> {
  const { channel, recipientId } = query;
  const limit = Math.min(query.limit || 50, 100);

  let messages: ChatMessage[];

  switch (channel) {
    case "town":
      messages = await getChatByChannel(db, "town", limit);
      break;

    case "clan":
      if (!agent.clanId) {
        return jsonResponse<ApiResponse>(
          { ok: false, error: "You are not in a clan" },
          403
        );
      }
      messages = await getClanChat(db, agent.clanId, limit);
      break;

    case "dm":
      if (!recipientId) {
        return jsonResponse<ApiResponse>(
          { ok: false, error: "Missing recipient ID for DM channel" },
          400
        );
      }
      messages = await getDMChat(db, agent.id, recipientId, limit);
      break;

    default:
      return jsonResponse<ApiResponse>(
        { ok: false, error: "Invalid chat channel" },
        400
      );
  }

  return jsonResponse<ApiResponse>({
    ok: true,
    data: { messages },
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
