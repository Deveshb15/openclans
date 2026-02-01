// ============================================================
// MoltClans - Character Sprite Mapping
// ============================================================

/** Agent visual states that map to animation frames */
export type AgentAnimState = "idle" | "walk" | "action";

/** Held item overlay types */
export type HeldItem = "none" | "hammer" | "sack" | "basket" | "pickaxe";

/** Map agent behavior state to visual animation + held item */
export function getAgentVisuals(behaviorState: string): { anim: AgentAnimState; heldItem: HeldItem } {
  switch (behaviorState) {
    case "BUILDING":
      return { anim: "action", heldItem: "hammer" };
    case "COLLECTING":
      return { anim: "action", heldItem: "basket" };
    case "CARRYING_BACK":
      return { anim: "walk", heldItem: "sack" };
    case "WALKING_TO_BUILD":
    case "WALKING_TO_COLLECT":
    case "WANDERING":
      return { anim: "walk", heldItem: "none" };
    case "SOCIALIZING":
      return { anim: "idle", heldItem: "none" };
    case "IDLE":
    default:
      return { anim: "idle", heldItem: "none" };
  }
}

/** Walk animation speed (frames per second) */
export const WALK_ANIM_FPS = 6;

/** Idle fidget interval (ms) */
export const IDLE_FIDGET_INTERVAL = 3000;
