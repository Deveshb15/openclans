import type { BuildingDefinition, Resources } from "./types";

// --- Grid ---
export const GRID_WIDTH = 128;
export const GRID_HEIGHT = 128;
export const TILE_SIZE = 16;
export const WORLD_WIDTH = GRID_WIDTH * TILE_SIZE;
export const WORLD_HEIGHT = GRID_HEIGHT * TILE_SIZE;

// --- Isometric ---
export const ISO_TILE_WIDTH = 64;
export const ISO_TILE_HEIGHT = 32;
export const ISO_TILE_DEPTH = 12;
export const ISO_WORLD_WIDTH = (GRID_WIDTH + GRID_HEIGHT) * (ISO_TILE_WIDTH / 2); // 8192
export const ISO_WORLD_HEIGHT = (GRID_WIDTH + GRID_HEIGHT) * (ISO_TILE_HEIGHT / 2) + ISO_TILE_DEPTH; // 4108
export const AGENT_SPRITE_WIDTH = 32;
export const AGENT_SPRITE_HEIGHT = 40;

// --- Plots ---
export const MIN_PLOT_SIZE = 3;
export const MAX_PLOT_SIZE = 8;
export const MAX_PLOTS_PER_AGENT = 5;
export const ADDITIONAL_PLOT_COST: Resources = {
  wood: 0,
  stone: 0,
  food: 0,
  gold: 50,
};

// --- Starter Resources ---
export const STARTER_RESOURCES: Resources = {
  wood: 50,
  stone: 30,
  food: 40,
  gold: 20,
};

// --- Rate Limits ---
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_REQUESTS = 120;
export const BUILD_COOLDOWN_MS = 5 * 60_000;
export const CHAT_COOLDOWN_MS = 10_000;
export const TRADE_COOLDOWN_MS = 30_000;

// --- Resource Collection ---
export const COLLECTION_CAP_HOURS = 48;
export const RESOURCE_TICK_INTERVAL_MS = 60_000; // 1 min production ticks

// --- Prestige Thresholds ---
export const PRESTIGE = {
  BUILD: 5,
  UPGRADE: 3,
  TRADE: 2,
  VOTE: 1,
  PROPOSAL_PASSED: 10,
  THRESHOLD_PROPOSALS: 50,
  THRESHOLD_CLANS: 100,
  THRESHOLD_SPECIAL_BUILDINGS: 200,
  THRESHOLD_DOUBLE_VOTES: 500,
};

// --- Governance ---
export const PROPOSAL_DURATION_MS = 48 * 60 * 60_000;
export const PROPOSAL_MIN_VOTERS = 3;
export const PROPOSAL_PASS_THRESHOLD = 0.5;

// --- Chat ---
export const MAX_CHAT_MESSAGES = 200;
export const MAX_CHAT_MESSAGE_LENGTH = 280;
export const MAX_ACTIVITY_ENTRIES = 100;
export const MAX_NOTIFICATIONS_PER_AGENT = 50;

// --- Buildings ---
export const BUILDING_DEFINITIONS: Record<string, BuildingDefinition> = {
  house: {
    type: "house",
    width: 2,
    height: 2,
    cost: { wood: 20, stone: 10, food: 0, gold: 0 },
    benefit: "+1 max plots",
    buildTime: 120,
    upgradeCostMultiplier: 1.5,
    maxLevel: 3,
  },
  farm: {
    type: "farm",
    width: 2,
    height: 3,
    cost: { wood: 15, stone: 5, food: 0, gold: 0 },
    benefit: "+4 food/hr",
    buildTime: 90,
    upgradeCostMultiplier: 1.5,
    maxLevel: 3,
    production: { food: 4 },
  },
  lumbermill: {
    type: "lumbermill",
    width: 3,
    height: 2,
    cost: { wood: 10, stone: 15, food: 0, gold: 0 },
    benefit: "+4 wood/hr",
    buildTime: 90,
    upgradeCostMultiplier: 1.5,
    maxLevel: 3,
    production: { wood: 4 },
  },
  quarry: {
    type: "quarry",
    width: 3,
    height: 3,
    cost: { wood: 20, stone: 5, food: 0, gold: 0 },
    benefit: "+3 stone/hr",
    buildTime: 150,
    upgradeCostMultiplier: 1.5,
    maxLevel: 3,
    production: { stone: 3 },
  },
  market: {
    type: "market",
    width: 3,
    height: 3,
    cost: { wood: 30, stone: 30, food: 0, gold: 10 },
    benefit: "+2 gold/hr, enables trading",
    buildTime: 300,
    upgradeCostMultiplier: 2,
    maxLevel: 3,
    production: { gold: 2 },
  },
  workshop: {
    type: "workshop",
    width: 2,
    height: 2,
    cost: { wood: 25, stone: 25, food: 0, gold: 0 },
    benefit: "-10% build costs",
    buildTime: 180,
    upgradeCostMultiplier: 1.5,
    maxLevel: 3,
  },
  tavern: {
    type: "tavern",
    width: 3,
    height: 2,
    cost: { wood: 30, stone: 15, food: 20, gold: 0 },
    benefit: "Enables clans",
    buildTime: 240,
    upgradeCostMultiplier: 2,
    maxLevel: 3,
  },
  townhall: {
    type: "townhall",
    width: 4,
    height: 4,
    cost: { wood: 50, stone: 50, food: 0, gold: 25 },
    benefit: "Governance (collaborative build)",
    buildTime: 600,
    upgradeCostMultiplier: 2,
    maxLevel: 3,
    collaborative: true,
  },
  wall: {
    type: "wall",
    width: 1,
    height: 1,
    cost: { wood: 0, stone: 5, food: 0, gold: 0 },
    benefit: "Decorative border",
    buildTime: 15,
    upgradeCostMultiplier: 1.5,
    maxLevel: 1,
  },
  garden: {
    type: "garden",
    width: 2,
    height: 2,
    cost: { wood: 5, stone: 0, food: 10, gold: 0 },
    benefit: "+1 food/hr, +10% to adjacent farms",
    buildTime: 60,
    upgradeCostMultiplier: 1.5,
    maxLevel: 3,
    production: { food: 1 },
    adjacencyBonus: {
      target: "farm",
      resource: "food",
      multiplier: 0.1,
    },
  },
  monument: {
    type: "monument",
    width: 2,
    height: 2,
    cost: { wood: 0, stone: 40, food: 0, gold: 20 },
    benefit: "Custom inscription, prestige",
    buildTime: 300,
    upgradeCostMultiplier: 2,
    maxLevel: 1,
    requiresPrestige: 200,
  },
  road: {
    type: "road",
    width: 1,
    height: 1,
    cost: { wood: 0, stone: 3, food: 0, gold: 0 },
    benefit: "Connects buildings",
    buildTime: 10,
    upgradeCostMultiplier: 1,
    maxLevel: 1,
  },
};

// --- Agent Colors ---
export const AGENT_COLORS = [
  "#e74c3c",
  "#e67e22",
  "#f1c40f",
  "#2ecc71",
  "#1abc9c",
  "#3498db",
  "#9b59b6",
  "#e91e63",
  "#00bcd4",
  "#ff5722",
  "#795548",
  "#607d8b",
  "#8bc34a",
  "#ff9800",
  "#673ab7",
  "#009688",
];

// --- Terrain Generation ---
export const TERRAIN_WEIGHTS = {
  center: { grass: 0.7, dirt: 0.2, sand: 0.1, stone: 0, water: 0 },
  edge: { grass: 0.2, dirt: 0.2, sand: 0.2, stone: 0.2, water: 0.2 },
};
