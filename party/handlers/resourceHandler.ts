import type { Agent, ApiResponse } from "../../src/shared/types";
import type { Db } from "../db/client";
import {
  getBuildingsByOwnerId,
  getAgentById,
  updateAgent,
  insertActivity,
} from "../db/queries";
import { collectResources } from "../db/transactions";

/**
 * GET /resources — returns all 11 resource types + tokens + inventory usage
 */
export async function handleGetResources(
  agent: Agent,
  db: Db
): Promise<Response> {
  const agentBuildings = await getBuildingsByOwnerId(db, agent.id);
  const pendingRaw = { wood: 0, stone: 0, water: 0, food: 0, clay: 0 };
  const pendingRefined = { planks: 0, bricks: 0, cement: 0, glass: 0, steel: 0 };
  let pendingTokens = 0;

  for (const building of agentBuildings) {
    if (!building.completed) continue;
    pendingRaw.wood += building.pendingRawWood;
    pendingRaw.stone += building.pendingRawStone;
    pendingRaw.water += building.pendingRawWater;
    pendingRaw.food += building.pendingRawFood;
    pendingRaw.clay += building.pendingRawClay;
    pendingRefined.planks += building.pendingRefinedPlanks;
    pendingRefined.bricks += building.pendingRefinedBricks;
    pendingRefined.cement += building.pendingRefinedCement;
    pendingRefined.glass += building.pendingRefinedGlass;
    pendingRefined.steel += building.pendingRefinedSteel;
    pendingTokens += building.pendingTokens;
  }

  const inv = agent.inventory;
  const usage =
    inv.raw.wood + inv.raw.stone + inv.raw.water + inv.raw.food + inv.raw.clay +
    inv.refined.planks + inv.refined.bricks + inv.refined.cement + inv.refined.glass + inv.refined.steel;

  return jsonResponse<ApiResponse>({
    ok: true,
    data: {
      inventory: agent.inventory,
      inventoryUsage: usage,
      inventoryLimit: agent.inventoryLimit,
      pending: {
        raw: {
          wood: Math.floor(pendingRaw.wood),
          stone: Math.floor(pendingRaw.stone),
          water: Math.floor(pendingRaw.water),
          food: Math.floor(pendingRaw.food),
          clay: Math.floor(pendingRaw.clay),
        },
        refined: {
          planks: Math.floor(pendingRefined.planks),
          bricks: Math.floor(pendingRefined.bricks),
          cement: Math.floor(pendingRefined.cement),
          glass: Math.floor(pendingRefined.glass),
          steel: Math.floor(pendingRefined.steel),
        },
        tokens: Math.floor(pendingTokens),
      },
    },
  });
}

/**
 * POST /resources/collect — collects pending resources from all buildings
 */
export async function handleCollectResources(
  agent: Agent,
  db: Db
): Promise<Response> {
  const agentBuildings = await getBuildingsByOwnerId(db, agent.id);
  const { collectedRaw, collectedRefined, collectedTokens, buildingsCollected } =
    await collectResources(db, agent, agentBuildings);

  const positionBuilding = agentBuildings.find(b => b.completed) ?? agentBuildings[0];
  if (positionBuilding && buildingsCollected > 0) {
    await updateAgent(db, agent.id, { x: positionBuilding.x, y: positionBuilding.y });
  }

  if (buildingsCollected === 0) {
    return jsonResponse<ApiResponse>({
      ok: true,
      data: {
        collectedRaw: { wood: 0, stone: 0, water: 0, food: 0, clay: 0 },
        collectedRefined: { planks: 0, bricks: 0, cement: 0, glass: 0, steel: 0 },
        collectedTokens: 0,
        message: "No resources to collect",
      },
    });
  }

  await insertActivity(db, "resources_collected", agent.id, agent.name,
    `${agent.name} collected resources from ${buildingsCollected} building(s)`);

  const updatedAgent = await getAgentById(db, agent.id);

  return jsonResponse<ApiResponse>({
    ok: true,
    data: {
      collectedRaw,
      collectedRefined,
      collectedTokens,
      buildingsCollected,
      inventory: updatedAgent?.inventory ?? agent.inventory,
      message: `Collected from ${buildingsCollected} building(s)`,
    },
  });
}

function jsonResponse<T>(data: T, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
