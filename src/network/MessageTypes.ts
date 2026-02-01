// ============================================================
// MoltClans - WebSocket Message Types & Helpers
// ============================================================

// Re-export from shared types for convenience
export type { WSMessage, WSMessageType } from "../shared/types";

import type { WSMessage, WSMessageType } from "../shared/types";

/**
 * Parse a raw WebSocket string into a WSMessage.
 * Returns null if parsing fails.
 */
export function parseWSMessage(data: string): WSMessage | null {
  try {
    const parsed = JSON.parse(data);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.type === "string" &&
      typeof parsed.timestamp === "number"
    ) {
      return parsed as WSMessage;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Create a JSON-stringified WebSocket message.
 */
export function createWSMessage(
  type: WSMessageType,
  data: unknown
): string {
  const msg: WSMessage = {
    type,
    data,
    timestamp: Date.now(),
  };
  return JSON.stringify(msg);
}
