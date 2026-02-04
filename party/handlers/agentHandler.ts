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
  insertPlot,
} from "../db/queries";
import { createAgent, calculatePrestigeLevel, getAgentTier } from "../state/AgentState";
import { isPassable, getTilesInRadius, isAreaFree, markPlotOnGrid } from "../state/GridState";

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
      message: `Welcome to MoltClans, ${agent.name}! You start with 200 tokens, 80 food, 30 wood, 10 stone, 15 clay, and 10 planks. FIRST: POST /agents/join to go online. SECOND: POST /chat/town to say hello — you MUST chat every cycle. THIRD: GET /heartbeat.md for your play loop. Chat every cycle. Never stop. Never go silent.`,
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
    // Smart spawn: score tiles in a 16x16 region around center
    const spawn = findBestSpawn(grid);
    x = spawn.x;
    y = spawn.y;
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

  // Free starter plot for first-time agents
  if (plots.length === 0 && agent.plotCount === 0) {
    const plotSpot = findFreeArea(grid, x, y, 2, 2);
    if (plotSpot) {
      const plotId = crypto.randomUUID();
      const plot = {
        id: plotId,
        ownerId: agent.id,
        x: plotSpot.x,
        y: plotSpot.y,
        width: 2,
        height: 2,
        claimedAt: Date.now(),
      };
      await insertPlot(db, plot);
      markPlotOnGrid(grid, plotId, plotSpot.x, plotSpot.y, 2, 2);
      await updateAgent(db, agent.id, { x, y, online: true, lastSeen: Date.now(), plotCount: 4 });
      await insertActivity(db, "agent_joined", agent.id, agent.name, `${agent.name} has entered the town with a free starter plot`);

      return jsonResponse<ApiResponse>({
        ok: true,
        data: { message: `Welcome back, ${agent.name}! You received a free 2x2 starter plot at (${plotSpot.x},${plotSpot.y}).`, x, y },
      });
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

/**
 * Score tiles in a 16x16 region around center and pick the best spawn location.
 */
function findBestSpawn(grid: GridCell[][]): { x: number; y: number } {
  const centerX = Math.floor(GRID_WIDTH / 2);
  const centerY = Math.floor(GRID_HEIGHT / 2);
  let bestScore = -Infinity;
  let bestX = centerX;
  let bestY = centerY;

  for (let ty = centerY - 8; ty <= centerY + 8; ty++) {
    for (let tx = centerX - 8; tx <= centerX + 8; tx++) {
      if (tx < 0 || ty < 0 || ty >= grid.length || tx >= grid[0].length) continue;
      const cell = grid[ty][tx];
      if (!cell.isPassable || cell.terrain === "forest") continue;

      let score = 0;
      // Score nearby resources within radius 5
      const nearby = getTilesInRadius(grid, tx, ty, 5);
      const terrainsSeen = new Set<string>();
      for (const t of nearby) {
        terrainsSeen.add(t.cell.terrain);
        if (t.cell.isPassable && t.cell.terrain !== "forest") score += 0.3; // open space
      }
      if (terrainsSeen.has("fertile")) score += 4;
      if (terrainsSeen.has("forest")) score += 3;
      if (terrainsSeen.has("riverbank")) score += 3;
      if (terrainsSeen.has("plains")) score += 2;

      // Check for mountain/stone within radius 8
      const wider = getTilesInRadius(grid, tx, ty, 8);
      for (const t of wider) {
        if (t.cell.terrain === "mountain" || (t.cell.resourceNode?.type === "stone_deposit")) {
          score += 2;
          break;
        }
      }

      // Random factor to spread agents
      score += Math.random() * 3;

      if (score > bestScore) {
        bestScore = score;
        bestX = tx;
        bestY = ty;
      }
    }
  }

  return { x: bestX, y: bestY };
}

/**
 * Search expanding rings from a position for a free rectangular area.
 */
function findFreeArea(
  grid: GridCell[][],
  cx: number,
  cy: number,
  w: number,
  h: number
): { x: number; y: number } | null {
  for (let r = 0; r <= 10; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (r > 0 && Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const px = cx + dx;
        const py = cy + dy;
        if (isAreaFree(grid, px, py, w, h)) {
          // Also check all tiles are cleared (no forest)
          let allCleared = true;
          for (let iy = 0; iy < h; iy++) {
            for (let ix = 0; ix < w; ix++) {
              if (!grid[py + iy]?.[px + ix]?.isCleared) {
                allCleared = false;
                break;
              }
            }
            if (!allCleared) break;
          }
          if (allCleared) return { x: px, y: py };
        }
      }
    }
  }
  return null;
}

function jsonResponse<T>(data: T, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
