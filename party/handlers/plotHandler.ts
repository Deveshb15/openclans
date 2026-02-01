import type { Agent, ApiResponse, Plot, GridCell } from "../../src/shared/types";
import {
  MIN_PLOT_SIZE,
  MAX_PLOT_SIZE,
  ADDITIONAL_PLOT_COST,
} from "../../src/shared/constants";
import type { Db } from "../db/client";
import {
  getAllPlots,
  getPlotById,
  getPlotsByOwnerId,
  getBuildingsByPlotId,
  insertPlot,
  deletePlot,
  updatePlot,
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
 * POST /plots
 * Claims a new plot of land. First plot is free, subsequent ones cost gold.
 */
export async function handleClaimPlot(
  body: { x?: number; y?: number; width?: number; height?: number },
  agent: Agent,
  db: Db,
  grid: GridCell[][]
): Promise<Response> {
  const { x, y, width, height } = body;

  // Validate presence
  if (x === undefined || y === undefined || width === undefined || height === undefined) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Missing required fields: x, y, width, height" },
      400
    );
  }

  // Validate types
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof width !== "number" ||
    typeof height !== "number"
  ) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "x, y, width, height must be numbers" },
      400
    );
  }

  // Validate integers
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(width) || !Number.isInteger(height)) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "x, y, width, height must be integers" },
      400
    );
  }

  // Validate size constraints
  if (
    width < MIN_PLOT_SIZE ||
    width > MAX_PLOT_SIZE ||
    height < MIN_PLOT_SIZE ||
    height > MAX_PLOT_SIZE
  ) {
    return jsonResponse<ApiResponse>(
      {
        ok: false,
        error: `Plot dimensions must be between ${MIN_PLOT_SIZE} and ${MAX_PLOT_SIZE}`,
      },
      400
    );
  }

  // Check max plots - need buildings to calculate max
  const allBuildings = await getAllBuildings(db);
  const buildingsMap: Record<string, typeof allBuildings[0]> = {};
  for (const b of allBuildings) buildingsMap[b.id] = b;
  const maxPlots = getMaxPlots(agent, buildingsMap);
  if (agent.plotCount >= maxPlots) {
    return jsonResponse<ApiResponse>(
      {
        ok: false,
        error: `You have reached your maximum plot limit (${maxPlots}). Build houses to increase it.`,
      },
      403
    );
  }

  // Check if area is free (no other plots, no buildings, no water)
  if (!isAreaFree(grid, x, y, width, height)) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Area is not available (overlaps existing plots, buildings, water, or out of bounds)" },
      409
    );
  }

  // Cost: first plot is free, subsequent ones cost gold
  const isFirstPlot = agent.plotCount === 0;
  if (!isFirstPlot) {
    if (agent.resources.gold < ADDITIONAL_PLOT_COST.gold) {
      return jsonResponse<ApiResponse>(
        {
          ok: false,
          error: `Not enough gold. Additional plots cost ${ADDITIONAL_PLOT_COST.gold} gold. You have ${agent.resources.gold}.`,
        },
        403
      );
    }
    // Deduct cost
    await updateAgent(db, agent.id, {
      resourceGold: agent.resources.gold - ADDITIONAL_PLOT_COST.gold,
      resourceWood: agent.resources.wood - ADDITIONAL_PLOT_COST.wood,
      resourceStone: agent.resources.stone - ADDITIONAL_PLOT_COST.stone,
      resourceFood: agent.resources.food - ADDITIONAL_PLOT_COST.food,
    });
  }

  // Create the plot
  const plot: Plot = {
    id: crypto.randomUUID(),
    ownerId: agent.id,
    x,
    y,
    width,
    height,
    claimedAt: Date.now(),
  };

  // Save plot to DB
  await insertPlot(db, plot);

  // Update agent plot count
  await updateAgent(db, agent.id, {
    plotCount: agent.plotCount + 1,
  });

  // Mark grid cells (in-memory)
  markPlotOnGrid(grid, plot.id, x, y, width, height);

  await insertActivity(
    db,
    "plot_claimed",
    agent.id,
    agent.name,
    `${agent.name} claimed a ${width}x${height} plot at (${x}, ${y})`
  );

  return jsonResponse<ApiResponse>({
    ok: true,
    data: {
      plot,
      message: isFirstPlot
        ? "Your first plot has been claimed for free!"
        : `Plot claimed for ${ADDITIONAL_PLOT_COST.gold} gold.`,
    },
  }, 201);
}

/**
 * GET /plots
 * Returns all plots in the town.
 */
export async function handleGetPlots(db: Db): Promise<Response> {
  const allPlots = await getAllPlots(db);
  return jsonResponse<ApiResponse>({
    ok: true,
    data: { plots: allPlots },
  });
}

/**
 * GET /plots/mine
 * Returns all plots owned by the authenticated agent.
 */
export async function handleGetMyPlots(
  agent: Agent,
  db: Db
): Promise<Response> {
  const myPlots = await getPlotsByOwnerId(db, agent.id);
  return jsonResponse<ApiResponse>({
    ok: true,
    data: { plots: myPlots },
  });
}

/**
 * DELETE /plots/:id
 * Releases a plot if there are no buildings on it.
 */
export async function handleReleasePlot(
  plotId: string,
  agent: Agent,
  db: Db,
  grid: GridCell[][]
): Promise<Response> {
  const plot = await getPlotById(db, plotId);
  if (!plot) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Plot not found" },
      404
    );
  }

  if (plot.ownerId !== agent.id) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "You do not own this plot" },
      403
    );
  }

  // Check if any buildings are on this plot
  const buildingsOnPlot = await getBuildingsByPlotId(db, plotId);
  if (buildingsOnPlot.length > 0) {
    return jsonResponse<ApiResponse>(
      {
        ok: false,
        error: "Cannot release a plot with buildings on it. Demolish buildings first.",
      },
      409
    );
  }

  // Clear grid cells (in-memory)
  clearPlotFromGrid(grid, plot.id, plot.x, plot.y, plot.width, plot.height);

  // Remove plot from DB
  await deletePlot(db, plotId);
  await updateAgent(db, agent.id, { plotCount: agent.plotCount - 1 });

  await insertActivity(
    db,
    "plot_released",
    agent.id,
    agent.name,
    `${agent.name} released a plot at (${plot.x}, ${plot.y})`
  );

  return jsonResponse<ApiResponse>({
    ok: true,
    data: { message: "Plot released successfully" },
  });
}

/**
 * POST /plots/:id/transfer
 * Transfers a plot to another agent.
 */
export async function handleTransferPlot(
  plotId: string,
  body: { recipientId?: string },
  agent: Agent,
  db: Db
): Promise<Response> {
  const plot = await getPlotById(db, plotId);
  if (!plot) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Plot not found" },
      404
    );
  }

  if (plot.ownerId !== agent.id) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "You do not own this plot" },
      403
    );
  }

  if (!body.recipientId || typeof body.recipientId !== "string") {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Missing or invalid 'recipientId' field" },
      400
    );
  }

  const recipient = await getAgentById(db, body.recipientId);
  if (!recipient) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Recipient agent not found" },
      404
    );
  }

  // Check recipient plot limit
  const allBuildings = await getAllBuildings(db);
  const buildingsMap: Record<string, typeof allBuildings[0]> = {};
  for (const b of allBuildings) buildingsMap[b.id] = b;
  const recipientMaxPlots = getMaxPlots(recipient, buildingsMap);
  if (recipient.plotCount >= recipientMaxPlots) {
    return jsonResponse<ApiResponse>(
      { ok: false, error: "Recipient has reached their maximum plot limit" },
      409
    );
  }

  // Get buildings on the plot for the transaction
  const buildingsOnPlot = await getBuildingsByPlotId(db, plotId);

  await transferPlotTx(db, plotId, agent, recipient, buildingsOnPlot);

  return jsonResponse<ApiResponse>({
    ok: true,
    data: {
      message: `Plot transferred to ${recipient.name}`,
      plot: { ...plot, ownerId: recipient.id },
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
