import {
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  BUILD_COOLDOWN_MS,
  CHAT_COOLDOWN_MS,
  TRADE_COOLDOWN_MS,
} from "../../src/shared/constants";

interface RateLimitEntry {
  count: number;
  windowStart: number;
  lastAction: Record<string, number>; // action -> last timestamp
}

/**
 * Simple in-memory rate limiter keyed by agent ID.
 * Tracks both general request counts per window and per-action cooldowns.
 */
const limits = new Map<string, RateLimitEntry>();

/**
 * Action-specific cooldown durations in milliseconds.
 */
const ACTION_COOLDOWNS: Record<string, number> = {
  build: BUILD_COOLDOWN_MS,
  chat: CHAT_COOLDOWN_MS,
  trade: TRADE_COOLDOWN_MS,
};

/**
 * Checks whether an agent is allowed to make a request.
 *
 * @param agentId - The agent's unique ID
 * @param action - Optional action type for action-specific cooldowns ("build", "chat", "trade")
 * @returns Object with `allowed` boolean, and `retryAfter` in seconds if rate limited
 */
export function checkRateLimit(
  agentId: string,
  action?: string
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();

  let entry = limits.get(agentId);
  if (!entry) {
    entry = {
      count: 0,
      windowStart: now,
      lastAction: {},
    };
    limits.set(agentId, entry);
  }

  // Reset window if expired
  if (now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }

  // Check general rate limit
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil(
      (entry.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000
    );
    return { allowed: false, retryAfter };
  }

  // Check action-specific cooldown
  if (action && ACTION_COOLDOWNS[action]) {
    const lastActionTime = entry.lastAction[action] || 0;
    const cooldown = ACTION_COOLDOWNS[action];
    if (now - lastActionTime < cooldown) {
      const retryAfter = Math.ceil(
        (lastActionTime + cooldown - now) / 1000
      );
      return { allowed: false, retryAfter };
    }
  }

  // Allow and record
  entry.count++;
  if (action) {
    entry.lastAction[action] = now;
  }

  return { allowed: true };
}

/**
 * Cleans up stale rate limit entries (older than 5 minutes).
 * Should be called periodically to prevent memory leaks.
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  const staleThreshold = 5 * 60 * 1000;

  for (const [agentId, entry] of limits.entries()) {
    if (now - entry.windowStart > staleThreshold) {
      limits.delete(agentId);
    }
  }
}
