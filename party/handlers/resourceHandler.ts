import type { Agent, ApiResponse, Resources } from "../../src/shared/types";
import { COLLECTION_CAP_HOURS } from "../../src/shared/constants";
import type { Db } from "../db/client";
import {
  getBuildingsByOwnerId,
  getAgentById,
  updateAgent,
  insertActivity,
} from "../db/queries";
import { collectResources } from "../db/transactions";

/**
 * GET /resources
 * Returns the agent's current resources plus a summary of pending resources from buildings.
 */
export async function handleGetResources(
  agent: Agent,
  db: Db
): Promise<Response> {
  // Sum up pending resources from all agent's completed buildings
  const agentBuildings = await getBuildingsByOwnerId(db, agent.id);
  const pending: Resources = { wood: 0, stone: 0, food: 0, gold: 0 };
  for (const building of agentBuildings) {
    if (building.completed) {
      pending.wood += building.pendingResources.wood;
      pending.stone += building.pendingResources.stone;
      pending.food += building.pendingResources.food;
      pending.gold += building.pendingResources.gold;
    }
  }

  return jsonResponse<ApiResponse>({
    ok: true,
    data: {
      resources: agent.resources,
      pending: {
        wood: Math.floor(pending.wood),
        stone: Math.floor(pending.stone),
        food: Math.floor(pending.food),
        gold: Math.floor(pending.gold),
      },
      collectionCapHours: COLLECTION_CAP_HOURS,
    },
  });
}

/**
 * POST /resources/collect
 * Collects (moves) pending resources from all agent's completed buildings
 * into the agent's resource pool. Resets pending counters.
 */
export async function handleCollectResources(
  agent: Agent,
  db: Db
): Promise<Response> {
  const agentBuildings = await getBuildingsByOwnerId(db, agent.id);

  const { collected, buildingsCollected } = await collectResources(db, agent, agentBuildings);

  // Update agent position to a completed building
  const positionBuilding = agentBuildings.find(b => b.completed) ?? agentBuildings[0];
  if (positionBuilding && buildingsCollected > 0) {
    await updateAgent(db, agent.id, { x: positionBuilding.x, y: positionBuilding.y });
  }

  if (buildingsCollected === 0) {
    return jsonResponse<ApiResponse>({
      ok: true,
      data: {
        collected: { wood: 0, stone: 0, food: 0, gold: 0 },
        message: "No resources to collect",
        resources: agent.resources,
      },
    });
  }

  await insertActivity(
    db,
    "resources_collected",
    agent.id,
    agent.name,
    `${agent.name} collected resources from ${buildingsCollected} building(s)`
  );

  // Fetch fresh agent data for response
  const updatedAgent = await getAgentById(db, agent.id);
  const newResources = updatedAgent?.resources ?? agent.resources;

  return jsonResponse<ApiResponse>({
    ok: true,
    data: {
      collected,
      buildingsCollected,
      resources: newResources,
      message: `Collected resources from ${buildingsCollected} building(s): +${collected.wood} wood, +${collected.stone} stone, +${collected.food} food, +${collected.gold} gold`,
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
