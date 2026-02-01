import type { Agent, ApiResponse, WorldEvent, VictoryMilestone } from "../../src/shared/types";
import type { Db } from "../db/client";
import { getActiveWorldEvents, getAllMilestones, getPublicTreasury, insertWorldEvent } from "../db/queries";

/**
 * GET /events — returns active world events
 */
export async function handleGetEvents(tick: number, db: Db): Promise<Response> {
  const events = await getActiveWorldEvents(db, tick);
  return jsonResponse<ApiResponse>({ ok: true, data: { events } });
}

/**
 * GET /milestones — returns all victory milestones achieved
 */
export async function handleGetMilestones(db: Db): Promise<Response> {
  const milestones = await getAllMilestones(db);
  return jsonResponse<ApiResponse>({ ok: true, data: { milestones } });
}

/**
 * GET /treasury — returns public treasury value
 */
export async function handleGetTreasury(db: Db): Promise<Response> {
  const treasury = await getPublicTreasury(db);
  return jsonResponse<ApiResponse>({ ok: true, data: { treasury } });
}

function jsonResponse<T>(data: T, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
