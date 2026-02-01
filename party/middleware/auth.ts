import type { Agent } from "../../src/shared/types";
import type { Db } from "../db/client";
import { getAgentByApiKey } from "../db/queries";

/**
 * Extracts the Bearer token from the Authorization header and finds the
 * matching agent by API key via indexed DB lookup.
 *
 * @param request - The incoming HTTP request
 * @param db - The Drizzle database instance
 * @returns The matched Agent, or null if authentication fails
 */
export async function authenticateAgent(
  request: Request,
  db: Db
): Promise<Agent | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;

  const apiKey = parts[1];
  if (!apiKey) return null;

  return getAgentByApiKey(db, apiKey);
}
