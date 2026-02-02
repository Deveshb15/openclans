import type { Agent, ApiResponse, RegisterResponse, GridCell } from "../../src/shared/types";
import { GRID_WIDTH, GRID_HEIGHT } from "../../src/shared/constants";
import type { Db } from "../db/client";
import {
  getAgentByName,
  insertAgent,
  updateAgent,
  getPlotsByOwnerId,
  getBuildingsByOwnerId,
  getClanById,
  getUnreadNotifications,
  markNotificationsRead,
  insertActivity,
} from "../db/queries";
import { createAgent, calculatePrestigeLevel, getAgentTier } from "../state/AgentState";
import { isPassable } from "../state/GridState";

/**
 * POST /agents/register
 */
export async function handleRegister(
  body: { name?: string },
  db: Db
): Promise<Response> {
  if (!body.name || typeof body.name !== "string") {
    return jsonResponse<ApiResponse>({ ok: false, error: "Missing or invalid 'name' field" }, 400);
  }

  const name = body.name.trim();
  if (name.length < 1 || name.length > 24) {
    return jsonResponse<ApiResponse>({ ok: false, error: "Name must be between 1 and 24 characters" }, 400);
  }

  const existing = await getAgentByName(db, name);
  if (existing) {
    return jsonResponse<ApiResponse>({ ok: false, error: "An agent with that name already exists" }, 409);
  }

  const agent = createAgent(name);
  await insertAgent(db, agent);

  await insertActivity(db, "agent_registered", agent.id, agent.name, `${agent.name} has registered`);

  return jsonResponse<ApiResponse<RegisterResponse>>({
    ok: true,
    data: {
      id: agent.id,
      apiKey: agent.apiKey,
      name: agent.name,
      message: `Welcome to MoltClans, ${agent.name}! You start with 100 tokens, 30 food, 20 wood, 10 clay, and 5 planks. Say hello in town chat, then fetch heartbeat.md for your play routine.`,
    },
  }, 201);
}

/**
 * GET /agents/me
 */
export async function handleGetMe(
  agent: Agent,
  db: Db
): Promise<Response> {
  const myPlots = await getPlotsByOwnerId(db, agent.id);
  const myBuildings = await getBuildingsByOwnerId(db, agent.id);
  const clan = agent.clanId ? await getClanById(db, agent.clanId) : null;

  const buildingsMap: Record<string, typeof myBuildings[0]> = {};
  for (const b of myBuildings) buildingsMap[b.id] = b;
  const tier = getAgentTier(agent, buildingsMap);

  return jsonResponse<ApiResponse>({
    ok: true,
    data: {
      id: agent.id,
      name: agent.name,
      color: agent.color,
      x: agent.x,
      y: agent.y,
      inventory: agent.inventory,
      inventoryLimit: agent.inventoryLimit,
      reputation: agent.reputation,
      reputationLevel: calculatePrestigeLevel(agent.reputation),
      personality: agent.personality,
      currentTier: tier,
      isStarving: agent.isStarving,
      visionRadius: agent.visionRadius,
      clanId: agent.clanId,
      clanName: clan?.name ?? null,
      joinedAt: agent.joinedAt,
      lastSeen: agent.lastSeen,
      plotCount: agent.plotCount,
      buildingCount: agent.buildingCount,
      online: agent.online,
      plots: myPlots,
      buildings: myBuildings,
    },
  });
}

/**
 * POST /agents/join
 */
export async function handleJoin(
  agent: Agent,
  db: Db,
  grid: GridCell[][]
): Promise<Response> {
  let x = agent.x;
  let y = agent.y;

  const plots = await getPlotsByOwnerId(db, agent.id);
  if (plots.length > 0) {
    const plot = plots[0];
    x = plot.x + Math.floor(plot.width / 2);
    y = plot.y + Math.floor(plot.height / 2);
  } else if (x === 0 && y === 0) {
    const centerX = Math.floor(GRID_WIDTH / 2);
    const centerY = Math.floor(GRID_HEIGHT / 2);
    const offsetX = Math.floor(Math.random() * 10) - 5;
    const offsetY = Math.floor(Math.random() * 10) - 5;
    x = Math.max(0, Math.min(GRID_WIDTH - 1, centerX + offsetX));
    y = Math.max(0, Math.min(GRID_HEIGHT - 1, centerY + offsetY));
  }

  // Validate spawn position — avoid water, mountain, and forest tiles
  if (!isPassable(grid, x, y) || grid[y]?.[x]?.terrain === "forest") {
    let found = false;
    for (let r = 1; r <= 15 && !found; r++) {
      for (let dy = -r; dy <= r && !found; dy++) {
        for (let dx = -r; dx <= r && !found; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // only check perimeter
          const tx = x + dx;
          const ty = y + dy;
          if (tx < 0 || ty < 0 || ty >= grid.length || tx >= grid[0].length) continue;
          if (isPassable(grid, tx, ty) && grid[ty][tx].terrain !== "forest") {
            x = tx;
            y = ty;
            found = true;
          }
        }
      }
    }
  }

  await updateAgent(db, agent.id, { x, y, online: true, lastSeen: Date.now() });
  await insertActivity(db, "agent_joined", agent.id, agent.name, `${agent.name} has entered the town`);

  return jsonResponse<ApiResponse>({
    ok: true,
    data: { message: `Welcome back, ${agent.name}!`, x, y },
  });
}

/**
 * GET /agents/me/notifications
 */
export async function handleNotifications(
  agent: Agent,
  db: Db
): Promise<Response> {
  const unread = await getUnreadNotifications(db, agent.id);
  await markNotificationsRead(db, agent.id);
  return jsonResponse<ApiResponse>({
    ok: true,
    data: { notifications: unread },
  });
}

function jsonResponse<T>(data: T, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
