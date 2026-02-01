import { GRID_WIDTH, GRID_HEIGHT } from "./shared/constants";

export const GAME_CONFIG = {
  // PartyKit connection
  PARTYKIT_HOST:
    import.meta.env.VITE_PARTYKIT_HOST || "localhost:8787",
  ROOM_ID: "town",

  // Grid
  GRID_WIDTH,
  GRID_HEIGHT,

  // 3D World
  TILE_UNIT: 1, // 1 Three.js unit per grid tile
  CAMERA_ANGLE: 45, // degrees from horizontal
  CAMERA_HEIGHT: 80, // units above ground
  CAMERA_DISTANCE: 100, // units from center
  CAMERA_FOV: 50,

  // Camera controls
  MIN_ZOOM: 20, // min camera distance
  MAX_ZOOM: 200, // max camera distance
  PAN_SPEED: 0.5,
  ZOOM_SPEED: 5,

  // Sun lighting
  SUN_COLOR: 0xfff5e6,
  SUN_INTENSITY: 1.2,
  AMBIENT_COLOR: 0xfff8f0,
  AMBIENT_INTENSITY: 0.6,

  // Day/Night
  DAY_CYCLE_DURATION: 5 * 60_000,

  // Chat
  SPEECH_BUBBLE_DURATION: 4000,
  MAX_VISIBLE_CHAT: 50,

  // Minimap
  MINIMAP_SIZE: 156,

  // Terrain colors (for canvas rendering - flat minimap)
  TERRAIN_COLORS: {
    grass: 0x4caf50,
    dirt: 0x8d6e63,
    stone: 0x9e9e9e,
    water: 0x2196f3,
    sand: 0xfdd835,
  } as Record<string, number>,

  // 3D Building colors (base color — Three.js materials handle shading)
  BUILDING_COLORS_3D: {
    house: { walls: 0xc4956a, roof: 0xb83a2a },
    farm: { walls: 0x8b6b4a, roof: 0x6b8e3a },
    lumbermill: { walls: 0x5d4037, roof: 0x33691e },
    quarry: { walls: 0x78909c, roof: 0x546e7a },
    market: { walls: 0xe8c170, roof: 0xd32f2f },
    workshop: { walls: 0x6d4c41, roof: 0x424242 },
    tavern: { walls: 0x8d6e63, roof: 0xbf360c },
    townhall: { walls: 0xd4c5a0, roof: 0x1565c0 },
    wall: { walls: 0x9e9e9e, roof: 0x9e9e9e },
    garden: { walls: 0x66bb6a, roof: 0x43a047 },
    monument: { walls: 0xe0e0e0, roof: 0xffd700 },
    road: { walls: 0x8d8d8d, roof: 0x8d8d8d },
  } as Record<string, { walls: number; roof: number }>,

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

  // Terrain colors for 3D ground texture generation
  TERRAIN_COLORS_3D: {
    grass: [0x4caf50, 0x66bb6a, 0x388e3c, 0x2e7d32],
    dirt: [0x8d6e63, 0x795548, 0x6d4c41],
    stone: [0x9e9e9e, 0x757575, 0x616161],
    water: [0x2196f3, 0x42a5f5, 0x1976d2],
    sand: [0xfdd835, 0xfbc02d, 0xf9a825],
  } as Record<string, number[]>,
};
