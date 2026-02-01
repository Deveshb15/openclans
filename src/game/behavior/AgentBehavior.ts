// ============================================================
// MoltClans - Per-Agent Behavior State Machine
// ============================================================

import type { BehaviorState, AgentBehaviorData } from "./BehaviorTypes";
import { STATE_DURATIONS } from "./BehaviorTypes";
import { PathFollower } from "../pathfinding/PathFollower";
import { Pathfinder } from "../pathfinding/Pathfinder";
import { directionFromDelta } from "../iso/IsoMath";
import type { AgentAnimState } from "../assets/CharacterSpriteMap";

export class AgentBehavior {
  public data: AgentBehaviorData;
  public pathFollower: PathFollower;
  public direction = 0;

  private pathfinder: Pathfinder;
  private needsNewActivity = true;

  constructor(agentId: string, x: number, y: number, pathfinder: Pathfinder) {
    this.pathfinder = pathfinder;
    this.pathFollower = new PathFollower();
    this.pathFollower.x = x;
    this.pathFollower.y = y;

    this.data = {
      agentId,
      state: "IDLE",
      targetX: x,
      targetY: y,
      targetBuildingId: null,
      homeX: x,
      homeY: y,
      stateStartTime: performance.now(),
      stateDuration: STATE_DURATIONS.IDLE ?? 2000,
    };
  }

  /** Current position */
  get x(): number { return this.pathFollower.x; }
  get y(): number { return this.pathFollower.y; }

  /** Whether this agent needs a new activity assigned */
  get needsActivity(): boolean {
    return this.needsNewActivity;
  }

  /** Get the animation state for the sprite */
  get animState(): AgentAnimState {
    switch (this.data.state) {
      case "WALKING_TO_BUILD":
      case "WALKING_TO_COLLECT":
      case "CARRYING_BACK":
      case "WALKING_HOME":
      case "WANDERING":
        return "walk";
      case "BUILDING":
      case "COLLECTING":
        return "action";
      case "SOCIALIZING":
      case "IDLE":
      default:
        return "idle";
    }
  }

  /** Transition to a new state */
  setState(state: BehaviorState, targetX: number, targetY: number, buildingId: string | null = null): void {
    this.data.state = state;
    this.data.targetX = targetX;
    this.data.targetY = targetY;
    this.data.targetBuildingId = buildingId;
    this.data.stateStartTime = performance.now();
    this.data.stateDuration = STATE_DURATIONS[state] ?? 2000;
    this.needsNewActivity = false;

    // Start pathfinding for walking states
    if (
      state === "WALKING_TO_BUILD" ||
      state === "WALKING_TO_COLLECT" ||
      state === "CARRYING_BACK" ||
      state === "WALKING_HOME" ||
      state === "WANDERING"
    ) {
      const result = this.pathfinder.findPath(
        Math.floor(this.x),
        Math.floor(this.y),
        Math.floor(targetX),
        Math.floor(targetY),
      );
      if (result.found) {
        this.pathFollower.startPath(result.path);
      } else {
        // Can't reach target, go idle
        this.needsNewActivity = true;
      }
    } else {
      this.pathFollower.stop();
    }
  }

  /** Update each frame */
  update(dt: number): void {
    const now = performance.now();

    switch (this.data.state) {
      case "WALKING_TO_BUILD":
      case "WALKING_TO_COLLECT":
      case "WALKING_HOME":
      case "WANDERING":
      case "CARRYING_BACK": {
        const delta = this.pathFollower.update(dt);
        if (delta.dx !== 0 || delta.dy !== 0) {
          this.direction = directionFromDelta(delta.dx, delta.dy);
        }
        if (this.pathFollower.arrived) {
          this.onArrived();
        }
        break;
      }

      case "BUILDING":
      case "COLLECTING":
      case "SOCIALIZING":
      case "IDLE": {
        // Check if duration elapsed
        const elapsed = now - this.data.stateStartTime;
        if (elapsed >= this.data.stateDuration) {
          this.onTimerExpired();
        }
        break;
      }
    }
  }

  /** Called when pathfollower arrives at target */
  private onArrived(): void {
    switch (this.data.state) {
      case "WALKING_TO_BUILD":
        this.data.state = "BUILDING";
        this.data.stateStartTime = performance.now();
        this.data.stateDuration = STATE_DURATIONS.BUILDING ?? 5000;
        break;

      case "WALKING_TO_COLLECT":
        this.data.state = "COLLECTING";
        this.data.stateStartTime = performance.now();
        this.data.stateDuration = STATE_DURATIONS.COLLECTING ?? 3000;
        break;

      case "CARRYING_BACK":
      case "WALKING_HOME":
      case "WANDERING":
        this.needsNewActivity = true;
        this.data.state = "IDLE";
        break;
    }
  }

  /** Called when timed state expires */
  private onTimerExpired(): void {
    switch (this.data.state) {
      case "BUILDING":
        // Walk back home
        this.setState("WALKING_HOME", this.data.homeX, this.data.homeY);
        break;

      case "COLLECTING":
        // Carry back to home
        this.setState("CARRYING_BACK", this.data.homeX, this.data.homeY);
        break;

      case "SOCIALIZING":
      case "IDLE":
        this.needsNewActivity = true;
        break;
    }
  }

  /** Set home position (first owned plot or initial position) */
  setHome(x: number, y: number): void {
    this.data.homeX = x;
    this.data.homeY = y;
  }

  /** Handle server event: building placed (trigger walk to build) */
  onBuildingPlaced(buildingId: string, x: number, y: number): void {
    this.setState("WALKING_TO_BUILD", x, y, buildingId);
  }

  /** Handle server event: building completed */
  onBuildingCompleted(): void {
    if (this.data.state === "BUILDING") {
      this.needsNewActivity = true;
      this.data.state = "IDLE";
    }
  }

  /** Handle server event: resources collected (trigger walk to collect) */
  onResourcesAvailable(buildingId: string, x: number, y: number): void {
    if (this.data.state === "IDLE" || this.needsNewActivity) {
      this.setState("WALKING_TO_COLLECT", x, y, buildingId);
    }
  }
}
