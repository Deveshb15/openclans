import type {
  Agent,
  ApiResponse,
  Trade,
  Resources,
  ResourceType,
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
 * POST /trades
 * Creates a new trade offer. Validates the seller has enough resources.
 */
export async function handleCreateTrade(
  body: {
    offering?: Partial<Resources>;
    requesting?: Partial<Resources>;
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

  const offering = body.offering;
  const requesting = body.requesting;

  // Validate that at least something is being offered and requested
  const totalOffering = sumResources(offering);
  const totalRequesting = sumResources(requesting);
  if (totalOffering <= 0) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Must offer at least some resources" },
      400
    );
  }
  if (totalRequesting <= 0) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Must request at least some resources" },
      400
    );
  }

  // Validate seller has the offered resources
  for (const [key, amount] of Object.entries(offering)) {
    const resKey = key as ResourceType;
    if (amount && amount > 0 && agent.resources[resKey] < amount) {
      return jsonResponse<ApiResponse>(
        {
          ok: false,
          error: `Insufficient ${resKey}. You have ${agent.resources[resKey]}, but are offering ${amount}.`,
        },
        403
      );
    }
  }

  // If a specific buyer is targeted, verify they exist
  if (body.buyerId) {
    const buyer = await getAgentById(db, body.buyerId);
    if (!buyer) {
      return jsonResponse<ApiResponse>(
        { ok: false, error: "Target buyer agent not found" },
        404
      );
    }
    if (body.buyerId === agent.id) {
      return jsonResponse<ApiResponse>(
        { ok: false, error: "Cannot create a trade with yourself" },
        400
      );
    }
  }

  // Reserve the offered resources (deduct from seller)
  const deductWood = offering.wood && offering.wood > 0 ? offering.wood : 0;
  const deductStone = offering.stone && offering.stone > 0 ? offering.stone : 0;
  const deductFood = offering.food && offering.food > 0 ? offering.food : 0;
  const deductGold = offering.gold && offering.gold > 0 ? offering.gold : 0;

  await updateAgent(db, agent.id, {
    resourceWood: agent.resources.wood - deductWood,
    resourceStone: agent.resources.stone - deductStone,
    resourceFood: agent.resources.food - deductFood,
    resourceGold: agent.resources.gold - deductGold,
  });

  // Create trade
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

  // Notify targeted buyer if applicable
  if (trade.buyerId) {
    await insertNotification(
      db,
      trade.buyerId,
      "trade_offer",
      `${agent.name} sent you a trade offer`
    );
  }

  await insertActivity(
    db,
    "trade_created",
    agent.id,
    agent.name,
    `${agent.name} posted a trade offer`
  );

  return jsonResponse<ApiResponse>({
    ok: true,
    data: { trade },
  }, 201);
}

/**
 * GET /trades
 * Returns all open trades.
 */
export async function handleGetTrades(db: Db): Promise<Response> {
  const openTrades = await getOpenTrades(db);

  return jsonResponse<ApiResponse>({
    ok: true,
    data: { trades: openTrades },
  });
}

/**
 * POST /trades/:id/accept
 * Accepts a trade. Validates the buyer has the requested resources.
 * Performs the resource swap.
 */
export async function handleAcceptTrade(
  tradeId: string,
  agent: Agent,
  db: Db
): Promise<Response> {
  const trade = await getTradeById(db, tradeId);
  if (!trade) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Trade not found" },
      404
    );
  }

  if (trade.status !== "open") {
    return jsonResponse<ApiResponse>(
      { ok: false, error: `Trade is no longer open (status: ${trade.status})` },
      409
    );
  }

  if (trade.sellerId === agent.id) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Cannot accept your own trade" },
      400
    );
  }

  // If trade is targeted, only the target can accept
  if (trade.buyerId && trade.buyerId !== agent.id) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "This trade offer is for a specific buyer" },
      403
    );
  }

  // Validate buyer has the requested resources
  for (const [key, amount] of Object.entries(trade.requesting)) {
    const resKey = key as ResourceType;
    if (amount && amount > 0 && agent.resources[resKey] < amount) {
      return jsonResponse<ApiResponse>(
        {
          ok: false,
          error: `Insufficient ${resKey}. You have ${agent.resources[resKey]}, trade requests ${amount}.`,
        },
        403
      );
    }
  }

  const seller = await getAgentById(db, trade.sellerId);
  if (!seller) {
    // Seller no longer exists; cancel trade
    await updateTrade(db, tradeId, { status: "cancelled", resolvedAt: Date.now() });
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Seller no longer exists" },
      410
    );
  }

  // Execute trade atomically
  await acceptTradeTx(db, trade, agent, seller);

  // Re-fetch the trade for response
  const updatedTrade = await getTradeById(db, tradeId);

  return jsonResponse<ApiResponse>({
    ok: true,
    data: {
      trade: updatedTrade ?? trade,
      message: "Trade accepted! Resources swapped.",
    },
  });
}

/**
 * DELETE /trades/:id
 * Cancels a trade. Only the seller can cancel. Resources are refunded.
 */
export async function handleCancelTrade(
  tradeId: string,
  agent: Agent,
  db: Db
): Promise<Response> {
  const trade = await getTradeById(db, tradeId);
  if (!trade) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Trade not found" },
      404
    );
  }

  if (trade.sellerId !== agent.id) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Only the seller can cancel a trade" },
      403
    );
  }

  if (trade.status !== "open") {
    return jsonResponse<ApiResponse>(
      { ok: false, error: `Trade is no longer open (status: ${trade.status})` },
      409
    );
  }

  // Refund offered resources to seller
  const refundWood = trade.offering.wood ?? 0;
  const refundStone = trade.offering.stone ?? 0;
  const refundFood = trade.offering.food ?? 0;
  const refundGold = trade.offering.gold ?? 0;

  await updateAgent(db, agent.id, {
    resourceWood: agent.resources.wood + refundWood,
    resourceStone: agent.resources.stone + refundStone,
    resourceFood: agent.resources.food + refundFood,
    resourceGold: agent.resources.gold + refundGold,
  });

  await updateTrade(db, tradeId, {
    status: "cancelled",
    resolvedAt: Date.now(),
  });

  await insertActivity(
    db,
    "trade_cancelled",
    agent.id,
    agent.name,
    `${agent.name} cancelled a trade offer`
  );

  return jsonResponse<ApiResponse>({
    ok: true,
    data: {
      message: "Trade cancelled. Resources refunded.",
    },
  });
}

/**
 * Sums all resource values in a partial resources object.
 */
function sumResources(resources: Partial<Resources>): number {
  let total = 0;
  for (const amount of Object.values(resources)) {
    if (typeof amount === "number" && amount > 0) {
      total += amount;
    }
  }
  return total;
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
