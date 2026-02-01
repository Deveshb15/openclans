// ============================================================
// MoltClans - Building Type → Sprite Mapping
// ============================================================

import type { BuildingType } from "../../shared/types";

export interface BuildingVisualConfig {
  /** Has chimney smoke effect */
  smoke: boolean;
  /** Has waving flag */
  flag: boolean;
  /** Has rotating gear */
  gear: boolean;
  /** Has crop sway animation */
  cropSway: boolean;
  /** Has warm glow effect */
  warmGlow: boolean;
  /** Has a sign that sways */
  signSway: boolean;
  /** Has flower bob animation */
  flowerBob: boolean;
  /** Has glow pulse animation */
  glowPulse: boolean;
  /** Dust particle emission */
  dustParticles: boolean;
}

export const BUILDING_VISUAL_CONFIG: Record<BuildingType, BuildingVisualConfig> = {
  house: {
    smoke: true, flag: false, gear: false, cropSway: false,
    warmGlow: true, signSway: false, flowerBob: false, glowPulse: false,
    dustParticles: false,
  },
  farm: {
    smoke: false, flag: false, gear: false, cropSway: true,
    warmGlow: false, signSway: false, flowerBob: false, glowPulse: false,
    dustParticles: false,
  },
  lumbermill: {
    smoke: false, flag: false, gear: false, cropSway: false,
    warmGlow: false, signSway: false, flowerBob: false, glowPulse: false,
    dustParticles: true,
  },
  quarry: {
    smoke: false, flag: false, gear: false, cropSway: false,
    warmGlow: false, signSway: false, flowerBob: false, glowPulse: false,
    dustParticles: true,
  },
  market: {
    smoke: false, flag: false, gear: false, cropSway: false,
    warmGlow: false, signSway: true, flowerBob: false, glowPulse: false,
    dustParticles: false,
  },
  workshop: {
    smoke: true, flag: false, gear: true, cropSway: false,
    warmGlow: false, signSway: false, flowerBob: false, glowPulse: false,
    dustParticles: false,
  },
  tavern: {
    smoke: false, flag: false, gear: false, cropSway: false,
    warmGlow: true, signSway: true, flowerBob: false, glowPulse: false,
    dustParticles: false,
  },
  townhall: {
    smoke: false, flag: true, gear: false, cropSway: false,
    warmGlow: false, signSway: false, flowerBob: false, glowPulse: false,
    dustParticles: false,
  },
  wall: {
    smoke: false, flag: false, gear: false, cropSway: false,
    warmGlow: false, signSway: false, flowerBob: false, glowPulse: false,
    dustParticles: false,
  },
  garden: {
    smoke: false, flag: false, gear: false, cropSway: false,
    warmGlow: false, signSway: false, flowerBob: true, glowPulse: false,
    dustParticles: false,
  },
  monument: {
    smoke: false, flag: false, gear: false, cropSway: false,
    warmGlow: false, signSway: false, flowerBob: false, glowPulse: true,
    dustParticles: false,
  },
  road: {
    smoke: false, flag: false, gear: false, cropSway: false,
    warmGlow: false, signSway: false, flowerBob: false, glowPulse: false,
    dustParticles: false,
  },
};

/** Resource type colors for the resource-ready indicator orbs */
export const RESOURCE_ORB_COLORS: Record<string, number> = {
  wood: 0x8b4513,
  stone: 0x9e9e9e,
  food: 0x4caf50,
  gold: 0xffd700,
};
