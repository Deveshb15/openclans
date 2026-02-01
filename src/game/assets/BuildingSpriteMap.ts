// ============================================================
// MoltClans - Building Type -> Sprite Mapping
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
  // Tier 1
  wooden_hut: {
    smoke: true, flag: false, gear: false, cropSway: false,
    warmGlow: true, signSway: false, flowerBob: false, glowPulse: false,
    dustParticles: false,
  },
  farm: {
    smoke: false, flag: false, gear: false, cropSway: true,
    warmGlow: false, signSway: false, flowerBob: false, glowPulse: false,
    dustParticles: false,
  },
  sawmill: {
    smoke: false, flag: false, gear: false, cropSway: false,
    warmGlow: false, signSway: false, flowerBob: false, glowPulse: false,
    dustParticles: true,
  },
  storage_shed: {
    smoke: false, flag: false, gear: false, cropSway: false,
    warmGlow: false, signSway: false, flowerBob: false, glowPulse: false,
    dustParticles: false,
  },
  dirt_road: {
    smoke: false, flag: false, gear: false, cropSway: false,
    warmGlow: false, signSway: false, flowerBob: false, glowPulse: false,
    dustParticles: false,
  },
  well: {
    smoke: false, flag: false, gear: false, cropSway: false,
    warmGlow: false, signSway: false, flowerBob: false, glowPulse: false,
    dustParticles: false,
  },
  // Tier 2
  kiln: {
    smoke: true, flag: false, gear: false, cropSway: false,
    warmGlow: true, signSway: false, flowerBob: false, glowPulse: false,
    dustParticles: false,
  },
  stone_house: {
    smoke: true, flag: false, gear: false, cropSway: false,
    warmGlow: true, signSway: false, flowerBob: false, glowPulse: false,
    dustParticles: false,
  },
  marketplace: {
    smoke: false, flag: false, gear: false, cropSway: false,
    warmGlow: false, signSway: true, flowerBob: false, glowPulse: false,
    dustParticles: false,
  },
  stone_wall: {
    smoke: false, flag: false, gear: false, cropSway: false,
    warmGlow: false, signSway: false, flowerBob: false, glowPulse: false,
    dustParticles: false,
  },
  warehouse: {
    smoke: false, flag: false, gear: false, cropSway: false,
    warmGlow: false, signSway: false, flowerBob: false, glowPulse: false,
    dustParticles: false,
  },
  paved_road: {
    smoke: false, flag: false, gear: false, cropSway: false,
    warmGlow: false, signSway: false, flowerBob: false, glowPulse: false,
    dustParticles: false,
  },
  workshop: {
    smoke: true, flag: false, gear: true, cropSway: false,
    warmGlow: false, signSway: false, flowerBob: false, glowPulse: false,
    dustParticles: false,
  },
  inn: {
    smoke: true, flag: false, gear: false, cropSway: false,
    warmGlow: true, signSway: true, flowerBob: false, glowPulse: false,
    dustParticles: false,
  },
  // Tier 3
  cement_works: {
    smoke: true, flag: false, gear: true, cropSway: false,
    warmGlow: false, signSway: false, flowerBob: false, glowPulse: false,
    dustParticles: true,
  },
  town_hall: {
    smoke: false, flag: true, gear: false, cropSway: false,
    warmGlow: false, signSway: false, flowerBob: false, glowPulse: false,
    dustParticles: false,
  },
  apartment_block: {
    smoke: false, flag: false, gear: false, cropSway: false,
    warmGlow: true, signSway: false, flowerBob: false, glowPulse: false,
    dustParticles: false,
  },
  bank: {
    smoke: false, flag: false, gear: false, cropSway: false,
    warmGlow: false, signSway: false, flowerBob: false, glowPulse: true,
    dustParticles: false,
  },
  university: {
    smoke: false, flag: true, gear: false, cropSway: false,
    warmGlow: true, signSway: false, flowerBob: false, glowPulse: false,
    dustParticles: false,
  },
  hospital: {
    smoke: false, flag: false, gear: false, cropSway: false,
    warmGlow: true, signSway: false, flowerBob: false, glowPulse: true,
    dustParticles: false,
  },
  commercial_tower: {
    smoke: false, flag: false, gear: false, cropSway: false,
    warmGlow: true, signSway: false, flowerBob: false, glowPulse: false,
    dustParticles: false,
  },
  forge: {
    smoke: true, flag: false, gear: true, cropSway: false,
    warmGlow: true, signSway: false, flowerBob: false, glowPulse: false,
    dustParticles: true,
  },
  embassy: {
    smoke: false, flag: true, gear: false, cropSway: false,
    warmGlow: false, signSway: false, flowerBob: false, glowPulse: false,
    dustParticles: false,
  },
  // Tier 4
  skyscraper: {
    smoke: false, flag: false, gear: false, cropSway: false,
    warmGlow: true, signSway: false, flowerBob: false, glowPulse: false,
    dustParticles: false,
  },
  grand_bazaar: {
    smoke: false, flag: true, gear: false, cropSway: false,
    warmGlow: true, signSway: true, flowerBob: false, glowPulse: false,
    dustParticles: false,
  },
  mint: {
    smoke: false, flag: false, gear: true, cropSway: false,
    warmGlow: false, signSway: false, flowerBob: false, glowPulse: true,
    dustParticles: false,
  },
  monument: {
    smoke: false, flag: false, gear: false, cropSway: false,
    warmGlow: false, signSway: false, flowerBob: false, glowPulse: true,
    dustParticles: false,
  },
  spaceport: {
    smoke: true, flag: true, gear: false, cropSway: false,
    warmGlow: false, signSway: false, flowerBob: false, glowPulse: true,
    dustParticles: true,
  },
};

/** Resource type colors for the resource-ready indicator orbs */
export const RESOURCE_ORB_COLORS: Record<string, number> = {
  wood: 0x8b4513,
  stone: 0x9e9e9e,
  water: 0x2196f3,
  food: 0x4caf50,
  clay: 0xd4a574,
  planks: 0xdeb887,
  bricks: 0xb71c1c,
  cement: 0x757575,
  glass: 0x81d4fa,
  steel: 0x546e7a,
  tokens: 0xffd700,
};
