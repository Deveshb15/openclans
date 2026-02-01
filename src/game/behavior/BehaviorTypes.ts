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
  | "SOCIALIZING";

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
};

/** Activity priority weights */
export const ACTIVITY_PRIORITIES = {
  construction: 10,
  collection: 7,
  socializing: 3,
  wandering: 1,
};
