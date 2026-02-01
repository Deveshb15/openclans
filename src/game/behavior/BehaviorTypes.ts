// ============================================================
// MoltClans - Agent Behavior Types
// ============================================================

export type BehaviorState =
  | "IDLE"
  | "WALKING_TO_BUILD"
  | "BUILDING"
  | "WALKING_TO_COLLECT"
  | "COLLECTING"
  | "CARRYING_BACK"
  | "WALKING_HOME"
  | "WANDERING"
  | "SOCIALIZING"
  | "GATHERING"
  | "REFINING"
  | "CLEARING_FOREST"
  | "STARVING"
  | "REPAIRING";

export interface AgentBehaviorData {
  agentId: string;
  state: BehaviorState;
  targetX: number;
  targetY: number;
  targetBuildingId: string | null;
  homeX: number;
  homeY: number;
  stateStartTime: number;
  stateDuration: number; // how long to remain in this state (ms)
}

/** State durations (ms) */
export const STATE_DURATIONS: Partial<Record<BehaviorState, number>> = {
  BUILDING: 5000,
  COLLECTING: 3000,
  SOCIALIZING: 4000,
  IDLE: 2000,
  GATHERING: 5000,
  REFINING: 5000,
  CLEARING_FOREST: 10000,
  STARVING: 1000,
  REPAIRING: 4000,
};

/** Activity priority weights */
export const ACTIVITY_PRIORITIES = {
  construction: 10,
  collection: 7,
  socializing: 3,
  wandering: 1,
  gathering: 8,
  refining: 6,
  clearing: 5,
  repairing: 9,
};
