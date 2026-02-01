import {
  GRID_WIDTH,
  GRID_HEIGHT,
  ISO_TILE_WIDTH,
  ISO_TILE_HEIGHT,
} from "./shared/constants";

export const GAME_CONFIG = {
  // PartyKit connection
  PARTYKIT_HOST:
    import.meta.env.VITE_PARTYKIT_HOST || "localhost:8787",
  ROOM_ID: "town",

  // Grid
  GRID_WIDTH,
  GRID_HEIGHT,

  // Isometric
  ISO_TILE_WIDTH,
  ISO_TILE_HEIGHT,

  // Camera
  MIN_ZOOM: 0.15,
  MAX_ZOOM: 3,
  DEFAULT_ZOOM: 0.5,

  // Day/Night
  DAY_CYCLE_DURATION: 5 * 60_000,

  // Chat
  SPEECH_BUBBLE_DURATION: 4000,
  MAX_VISIBLE_CHAT: 50,

  // Minimap
  MINIMAP_SIZE: 156,

  // Terrain colors (flat, for minimap)
  TERRAIN_COLORS: {
    grass: 0x4caf50,
    dirt: 0x8d6e63,
    stone: 0x9e9e9e,
    water: 0x2196f3,
    sand: 0xfdd835,
  } as Record<string, number>,

  // Building colors (flat, for minimap)
  BUILDING_COLORS: {
    house: 0x8b4513,
    farm: 0xffd700,
    lumbermill: 0x228b22,
    quarry: 0x808080,
    market: 0xff6347,
    workshop: 0xdaa520,
    tavern: 0x8b0000,
    townhall: 0x4169e1,
    wall: 0xa0a0a0,
    garden: 0x32cd32,
    monument: 0xffffff,
    road: 0x696969,
  } as Record<string, number>,
};
