import type { Agent, ApiResponse, Plot, GridCell } from "../../src/shared/types";
import {
  MIN_PLOT_SIZE,
  MAX_PLOT_SIZE,
  CLAIM_TILE_COST_TOKENS,
} from "../../src/shared/constants";
import type { Db } from "../db/client";
import {
  getAllPlots,
  getPlotById,
  getPlotsByOwnerId,
  getBuildingsByPlotId,
  insertPlot,
  deletePlot,
  updateAgent,
  getAgentById,
  getAllBuildings,
  insertNotification,
  insertActivity,
} from "../db/queries";
import { getMaxPlots } from "../state/AgentState";
import { isAreaFree, markPlotOnGrid, clearPlotFromGrid } from "../state/GridState";
import { transferPlot as transferPlotTx } from "../db/transactions";

/**
 * POST /plots — claims a plot. Costs tokens.
 */
export async function handleClaimPlot(
  body: { x?: number; y?: number; width?: number; height?: number },
  agent: Agent,
  db: Db,
  grid: GridCell[][]
): Promise<Response> {
  const { x, y, width, height } = body;

  if (x === undefined || y === undefined || width === undefined || height === undefined) {
    return jsonResponse<ApiResponse>({ ok: false, error: "Missing required fields: x, y, width, height" }, 400);
  }
  if (typeof x !== "number" || typeof y !== "number" || typeof width !== "number" || typeof height !== "number") {
    return jsonResponse<ApiResponse>({ ok: false, error: "x, y, width, height must be numbers" }, 400);
  }
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(width) || !Number.isInteger(height)) {
    return jsonResponse<ApiResponse>({ ok: false, error: "x, y, width, height must be integers" }, 400);
  }
  if (width < MIN_PLOT_SIZE || width > MAX_PLOT_SIZE || height < MIN_PLOT_SIZE || height > MAX_PLOT_SIZE) {
    return jsonResponse<ApiResponse>({ ok: false, error: `Plot dimensions must be between ${MIN_PLOT_SIZE} and ${MAX_PLOT_SIZE}` }, 400);
  }

  const allBuildings = await getAllBuildings(db);
  const buildingsMap: Record<string, typeof allBuildings[0]> = {};
  for (const b of allBuildings) buildingsMap[b.id] = b;
  const maxPlots = getMaxPlots(agent, buildingsMap);
  if (agent.plotCount + width * height > maxPlots) {
    return jsonResponse<ApiResponse>({ ok: false, error: `Max plot limit reached (${maxPlots}). Build houses to increase.` }, 403);
  }

  if (!isAreaFree(grid, x, y, width, height)) {
    return jsonResponse<ApiResponse>({ ok: false, error: "Area is not available" }, 409);
  }

  // Check all tiles are cleared (no forest)
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const cell = grid[y + dy]?.[x + dx];
      if (cell && !cell.isCleared) {
        return jsonResponse<ApiResponse>(
          { ok: false, error: `Tile (${x + dx}, ${y + dy}) has forest — clear it first` },
          400
        );
      }
    }
  }

  // Token-based cost
  const totalCost = CLAIM_TILE_COST_TOKENS * width * height;
  if (agent.inventory.tokens < totalCost) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: `Not enough tokens. Cost: ${totalCost} (${CLAIM_TILE_COST_TOKENS}/tile). You have ${agent.inventory.tokens}.` },
      403
    );
  }

  const plot: Plot = {
    id: crypto.randomUUID(),
    ownerId: agent.id,
    x, y, width, height,
    claimedAt: Date.now(),
  };

  await insertPlot(db, plot);
  // Single updateAgent call to avoid race condition
  await updateAgent(db, agent.id, {
    tokens: agent.inventory.tokens - totalCost,
    plotCount: agent.plotCount + width * height,
    x: x + Math.floor(width / 2),
    y: y + Math.floor(height / 2),
  });
  markPlotOnGrid(grid, plot.id, x, y, width, height);

  await insertActivity(db, "plot_claimed", agent.id, agent.name,
    `${agent.name} claimed a ${width}x${height} plot at (${x}, ${y})`);

  return jsonResponse<ApiResponse>({
    ok: true,
    data: { plot, cost: totalCost, message: `Plot claimed for ${totalCost} tokens.` },
  }, 201);
}

/**
 * GET /plots
 */
export async function handleGetPlots(db: Db): Promise<Response> {
  const allPlots = await getAllPlots(db);
  return jsonResponse<ApiResponse>({ ok: true, data: { plots: allPlots } });
}

/**
 * GET /plots/mine
 */
export async function handleGetMyPlots(agent: Agent, db: Db): Promise<Response> {
  const myPlots = await getPlotsByOwnerId(db, agent.id);
  return jsonResponse<ApiResponse>({ ok: true, data: { plots: myPlots } });
}

/**
 * DELETE /plots/:id
 */
export async function handleReleasePlot(
  plotId: string,
  agent: Agent,
  db: Db,
  grid: GridCell[][]
): Promise<Response> {
  const plot = await getPlotById(db, plotId);
  if (!plot) return jsonResponse<ApiResponse>({ ok: false, error: "Plot not found" }, 404);
  if (plot.ownerId !== agent.id) return jsonResponse<ApiResponse>({ ok: false, error: "You do not own this plot" }, 403);

  const buildingsOnPlot = await getBuildingsByPlotId(db, plotId);
  if (buildingsOnPlot.length > 0) {
    return jsonResponse<ApiResponse>({ ok: false, error: "Cannot release a plot with buildings on it. Demolish buildings first." }, 409);
  }

  clearPlotFromGrid(grid, plot.id, plot.x, plot.y, plot.width, plot.height);
  await deletePlot(db, plotId);
  await updateAgent(db, agent.id, { plotCount: agent.plotCount - plot.width * plot.height });
  await insertActivity(db, "plot_released", agent.id, agent.name, `${agent.name} released a plot at (${plot.x}, ${plot.y})`);

  return jsonResponse<ApiResponse>({ ok: true, data: { message: "Plot released successfully" } });
}

/**
 * POST /plots/:id/transfer
 */
export async function handleTransferPlot(
  plotId: string,
  body: { recipientId?: string },
  agent: Agent,
  db: Db
): Promise<Response> {
  const plot = await getPlotById(db, plotId);
  if (!plot) return jsonResponse<ApiResponse>({ ok: false, error: "Plot not found" }, 404);
  if (plot.ownerId !== agent.id) return jsonResponse<ApiResponse>({ ok: false, error: "You do not own this plot" }, 403);
  if (!body.recipientId || typeof body.recipientId !== "string") return jsonResponse<ApiResponse>({ ok: false, error: "Missing 'recipientId'" }, 400);

  const recipient = await getAgentById(db, body.recipientId);
  if (!recipient) return jsonResponse<ApiResponse>({ ok: false, error: "Recipient not found" }, 404);

  const allBuildings = await getAllBuildings(db);
  const buildingsMap: Record<string, typeof allBuildings[0]> = {};
  for (const b of allBuildings) buildingsMap[b.id] = b;
  const recipientMaxPlots = getMaxPlots(recipient, buildingsMap);
  if (recipient.plotCount >= recipientMaxPlots) {
    return jsonResponse<ApiResponse>({ ok: false, error: "Recipient at max plot limit" }, 409);
  }

  const buildingsOnPlot = await getBuildingsByPlotId(db, plotId);
  await transferPlotTx(db, plot, agent, recipient, buildingsOnPlot);

  return jsonResponse<ApiResponse>({
    ok: true,
    data: { message: `Plot transferred to ${recipient.name}`, plot: { ...plot, ownerId: recipient.id } },
  });
}

function jsonResponse<T>(data: T, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
