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
    plains: 0x4caf50,
    fertile: 0x2e7d32,
    forest: 0x1b5e20,
    mountain: 0x78909c,
    water: 0x2196f3,
    riverbank: 0x8d6e63,
    desert: 0xfdd835,
  } as Record<string, number>,

  // Building colors (flat, for minimap)
  BUILDING_COLORS: {
    // Tier 1
    wooden_hut: 0xc4956a,
    farm: 0xffd700,
    sawmill: 0x228b22,
    storage_shed: 0x8b6b4a,
    dirt_road: 0x8d8d8d,
    well: 0x2196f3,
    // Tier 2
    kiln: 0xbf360c,
    stone_house: 0xa07850,
    marketplace: 0xff6347,
    stone_wall: 0xa0a0a0,
    warehouse: 0x6d4c41,
    paved_road: 0x696969,
    workshop: 0xdaa520,
    inn: 0x8b0000,
    // Tier 3
    cement_works: 0x757575,
    town_hall: 0x4169e1,
    apartment_block: 0x90a4ae,
    bank: 0xffc107,
    university: 0x1565c0,
    hospital: 0xf44336,
    commercial_tower: 0x00897b,
    forge: 0xff6f00,
    embassy: 0x7b1fa2,
    // Tier 4
    skyscraper: 0x546e7a,
    grand_bazaar: 0xe65100,
    mint: 0xffd700,
    monument: 0xffffff,
    spaceport: 0x37474f,
  } as Record<string, number>,
};
