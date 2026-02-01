import type {
  Agent,
  ApiResponse,
  Trade,
  TradeResources,
  RawResources,
  RefinedMaterials,
} from "../../src/shared/types";
import { PRESTIGE } from "../../src/shared/constants";
import type { Db } from "../db/client";
import {
  getTradeById,
  getOpenTrades,
  insertTrade,
  updateTrade,
  getAgentById,
  updateAgent,
  insertNotification,
  insertActivity,
} from "../db/queries";
import { acceptTrade as acceptTradeTx } from "../db/transactions";

/**
 * POST /trades — create a new trade offer with 11 resource types + tokens
 */
export async function handleCreateTrade(
  body: {
    offering?: Partial<TradeResources>;
    requesting?: Partial<TradeResources>;
    buyerId?: string | null;
  },
  agent: Agent,
  db: Db
): Promise<Response> {
  if (!body.offering || !body.requesting) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Missing required fields: offering, requesting" },
      400
    );
  }

  const offering = normalizeTradeResources(body.offering);
  const requesting = normalizeTradeResources(body.requesting);

  const totalOffering = sumTradeResources(offering);
  const totalRequesting = sumTradeResources(requesting);

  if (totalOffering <= 0) {
    return jsonResponse<ApiResponse>({ ok: false, error: "Must offer at least some resources" }, 400);
  }
  if (totalRequesting <= 0) {
    return jsonResponse<ApiResponse>({ ok: false, error: "Must request at least some resources" }, 400);
  }

  // Validate seller has offered resources
  const inv = agent.inventory;
  for (const [key, amount] of Object.entries(offering.raw)) {
    if (amount && amount > 0 && (inv.raw[key as keyof RawResources] ?? 0) < amount) {
      return jsonResponse<ApiResponse>(
        { ok: false, error: `Insufficient ${key}. You have ${inv.raw[key as keyof RawResources]}, offering ${amount}.` },
        403
      );
    }
  }
  for (const [key, amount] of Object.entries(offering.refined)) {
    if (amount && amount > 0 && (inv.refined[key as keyof RefinedMaterials] ?? 0) < amount) {
      return jsonResponse<ApiResponse>(
        { ok: false, error: `Insufficient ${key}. You have ${inv.refined[key as keyof RefinedMaterials]}, offering ${amount}.` },
        403
      );
    }
  }
  if (offering.tokens > 0 && inv.tokens < offering.tokens) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: `Insufficient tokens. You have ${inv.tokens}, offering ${offering.tokens}.` },
      403
    );
  }

  if (body.buyerId) {
    const buyer = await getAgentById(db, body.buyerId);
    if (!buyer) return jsonResponse<ApiResponse>({ ok: false, error: "Target buyer not found" }, 404);
    if (body.buyerId === agent.id) return jsonResponse<ApiResponse>({ ok: false, error: "Cannot trade with yourself" }, 400);
  }

  // Reserve offered resources
  const updates: Record<string, number> = {};
  if ((offering.raw.wood ?? 0) > 0) updates.rawWood = inv.raw.wood - (offering.raw.wood ?? 0);
  if ((offering.raw.stone ?? 0) > 0) updates.rawStone = inv.raw.stone - (offering.raw.stone ?? 0);
  if ((offering.raw.water ?? 0) > 0) updates.rawWater = inv.raw.water - (offering.raw.water ?? 0);
  if ((offering.raw.food ?? 0) > 0) updates.rawFood = inv.raw.food - (offering.raw.food ?? 0);
  if ((offering.raw.clay ?? 0) > 0) updates.rawClay = inv.raw.clay - (offering.raw.clay ?? 0);
  if ((offering.refined.planks ?? 0) > 0) updates.refinedPlanks = inv.refined.planks - (offering.refined.planks ?? 0);
  if ((offering.refined.bricks ?? 0) > 0) updates.refinedBricks = inv.refined.bricks - (offering.refined.bricks ?? 0);
  if ((offering.refined.cement ?? 0) > 0) updates.refinedCement = inv.refined.cement - (offering.refined.cement ?? 0);
  if ((offering.refined.glass ?? 0) > 0) updates.refinedGlass = inv.refined.glass - (offering.refined.glass ?? 0);
  if ((offering.refined.steel ?? 0) > 0) updates.refinedSteel = inv.refined.steel - (offering.refined.steel ?? 0);
  if (offering.tokens > 0) updates.tokens = inv.tokens - offering.tokens;

  if (Object.keys(updates).length > 0) {
    await updateAgent(db, agent.id, updates);
  }

  const trade: Trade = {
    id: crypto.randomUUID(),
    sellerId: agent.id,
    sellerName: agent.name,
    buyerId: body.buyerId || null,
    offering,
    requesting,
    status: "open",
    createdAt: Date.now(),
    resolvedAt: null,
  };

  await insertTrade(db, trade);

  if (trade.buyerId) {
    await insertNotification(db, trade.buyerId, "trade_offer", `${agent.name} sent you a trade offer`);
  }

  await insertActivity(db, "trade_created", agent.id, agent.name, `${agent.name} posted a trade offer`);

  return jsonResponse<ApiResponse>({ ok: true, data: { trade } }, 201);
}

/**
 * GET /trades
 */
export async function handleGetTrades(db: Db): Promise<Response> {
  const openTrades = await getOpenTrades(db);
  return jsonResponse<ApiResponse>({ ok: true, data: { trades: openTrades } });
}

/**
 * POST /trades/:id/accept
 */
export async function handleAcceptTrade(
  tradeId: string,
  agent: Agent,
  db: Db
): Promise<Response> {
  const trade = await getTradeById(db, tradeId);
  if (!trade) return jsonResponse<ApiResponse>({ ok: false, error: "Trade not found" }, 404);
  if (trade.status !== "open") return jsonResponse<ApiResponse>({ ok: false, error: `Trade is no longer open (status: ${trade.status})` }, 409);
  if (trade.sellerId === agent.id) return jsonResponse<ApiResponse>({ ok: false, error: "Cannot accept your own trade" }, 400);
  if (trade.buyerId && trade.buyerId !== agent.id) return jsonResponse<ApiResponse>({ ok: false, error: "This trade is for a specific buyer" }, 403);

  // Validate buyer has requested resources
  const inv = agent.inventory;
  const req = trade.requesting;
  for (const [key, amount] of Object.entries(req.raw)) {
    if (amount && amount > 0 && (inv.raw[key as keyof RawResources] ?? 0) < amount) {
      return jsonResponse<ApiResponse>({ ok: false, error: `Insufficient ${key}. You have ${inv.raw[key as keyof RawResources]}, trade requests ${amount}.` }, 403);
    }
  }
  for (const [key, amount] of Object.entries(req.refined)) {
    if (amount && amount > 0 && (inv.refined[key as keyof RefinedMaterials] ?? 0) < amount) {
      return jsonResponse<ApiResponse>({ ok: false, error: `Insufficient ${key}.` }, 403);
    }
  }
  if ((req.tokens ?? 0) > 0 && inv.tokens < (req.tokens ?? 0)) {
    return jsonResponse<ApiResponse>({ ok: false, error: `Insufficient tokens.` }, 403);
  }

  const seller = await getAgentById(db, trade.sellerId);
  if (!seller) {
    await updateTrade(db, tradeId, { status: "cancelled", resolvedAt: Date.now() });
    return jsonResponse<ApiResponse>({ ok: false, error: "Seller no longer exists" }, 410);
  }

  await acceptTradeTx(db, trade, agent, seller);
  const updatedTrade = await getTradeById(db, tradeId);

  return jsonResponse<ApiResponse>({
    ok: true,
    data: { trade: updatedTrade ?? trade, message: "Trade accepted! Resources swapped." },
  });
}

/**
 * DELETE /trades/:id
 */
export async function handleCancelTrade(
  tradeId: string,
  agent: Agent,
  db: Db
): Promise<Response> {
  const trade = await getTradeById(db, tradeId);
  if (!trade) return jsonResponse<ApiResponse>({ ok: false, error: "Trade not found" }, 404);
  if (trade.sellerId !== agent.id) return jsonResponse<ApiResponse>({ ok: false, error: "Only the seller can cancel" }, 403);
  if (trade.status !== "open") return jsonResponse<ApiResponse>({ ok: false, error: `Trade is no longer open (status: ${trade.status})` }, 409);

  // Refund offered resources
  const inv = agent.inventory;
  const off = trade.offering;
  const updates: Record<string, number> = {};
  updates.rawWood = inv.raw.wood + (off.raw.wood ?? 0);
  updates.rawStone = inv.raw.stone + (off.raw.stone ?? 0);
  updates.rawWater = inv.raw.water + (off.raw.water ?? 0);
  updates.rawFood = inv.raw.food + (off.raw.food ?? 0);
  updates.rawClay = inv.raw.clay + (off.raw.clay ?? 0);
  updates.refinedPlanks = inv.refined.planks + (off.refined.planks ?? 0);
  updates.refinedBricks = inv.refined.bricks + (off.refined.bricks ?? 0);
  updates.refinedCement = inv.refined.cement + (off.refined.cement ?? 0);
  updates.refinedGlass = inv.refined.glass + (off.refined.glass ?? 0);
  updates.refinedSteel = inv.refined.steel + (off.refined.steel ?? 0);
  updates.tokens = inv.tokens + (off.tokens ?? 0);

  await updateAgent(db, agent.id, updates);
  await updateTrade(db, tradeId, { status: "cancelled", resolvedAt: Date.now() });
  await insertActivity(db, "trade_cancelled", agent.id, agent.name, `${agent.name} cancelled a trade offer`);

  return jsonResponse<ApiResponse>({ ok: true, data: { message: "Trade cancelled. Resources refunded." } });
}

function normalizeTradeResources(input: Partial<TradeResources>): TradeResources {
  return {
    raw: input.raw ?? {},
    refined: input.refined ?? {},
    tokens: input.tokens ?? 0,
  };
}

function sumTradeResources(tr: TradeResources): number {
  let total = 0;
  for (const v of Object.values(tr.raw)) if (typeof v === "number" && v > 0) total += v;
  for (const v of Object.values(tr.refined)) if (typeof v === "number" && v > 0) total += v;
  if (tr.tokens > 0) total += tr.tokens;
  return total;
}

function jsonResponse<T>(data: T, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
