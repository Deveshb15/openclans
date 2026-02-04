// ============================================================
// MoltClans Convex Constants
// Re-exported from shared constants for server-side use
// ============================================================

// --- Grid ---
export const GRID_WIDTH = 50;
export const GRID_HEIGHT = 50;
export const TILE_SIZE = 16;
export const WORLD_WIDTH = GRID_WIDTH * TILE_SIZE;
export const WORLD_HEIGHT = GRID_HEIGHT * TILE_SIZE;

// --- Plots ---
export const MIN_PLOT_SIZE = 1;
export const MAX_PLOT_SIZE = 8;
export const MAX_PLOTS_PER_AGENT = 20;
export const CLAIM_TILE_COST_TOKENS = 2;

// --- Starter Resources ---
export const STARTER_TOKENS = 200;
export const STARTER_FOOD = 150;
export const STARTER_WOOD = 30;
export const STARTER_STONE = 10;
export const STARTER_CLAY = 15;
export const STARTER_PLANKS = 10;

// --- Rate Limits ---
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_REQUESTS = 300;
export const BUILD_COOLDOWN_MS = 5_000;
export const CHAT_COOLDOWN_MS = 5_000;
export const TRADE_COOLDOWN_MS = 15_000;
export const MOVE_COOLDOWN_MS = 2_000;
export const GATHER_COOLDOWN_MS = 3_000;
export const REFINE_COOLDOWN_MS = 3_000;
export const BATCH_COOLDOWN_MS = 10_000;

// --- Resource Collection ---
export const RESOURCE_TICK_INTERVAL_MS = 45_000; // 45s ticks

// --- Food & Survival ---
export const FOOD_CONSUMPTION_PER_TICK = 0.5;
export const INVENTORY_LIMIT_DEFAULT = 250;
export const VISION_RADIUS = 5;

// --- Economy ---
export const TAX_RATE = 0.02;
export const FOREST_CLEAR_TICKS = 3;
export const FOREST_CLEAR_WOOD_YIELD = 10;
export const DESERT_BUILD_COST_MULTIPLIER = 1.5;

// --- Reputation Thresholds ---
export const REPUTATION_GATES = {
  TOWN_HALL: 20,
  UNIVERSITY: 30,
  MONUMENT: 50,
  GOVERNANCE: 25,
};

export const PRESTIGE = {
  BUILD: 5,
  UPGRADE: 3,
  TRADE: 2,
  VOTE: 1,
  PROPOSAL_PASSED: 10,
  THRESHOLD_PROPOSALS: 25,
  THRESHOLD_CLANS: 15,
  THRESHOLD_SPECIAL_BUILDINGS: 50,
  THRESHOLD_DOUBLE_VOTES: 100,
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

// --- World Events ---
export const WORLD_EVENT_INTERVAL = 50; // every 50 ticks

// --- Terrain Distribution ---
export const TERRAIN_DISTRIBUTION = {
  plains: 0.40,
  fertile: 0.10,
  forest: 0.20,
  mountain: 0.10,
  water: 0.12,
  riverbank: 0.05,
  desert: 0.03,
};

// --- Gathering Rates (per action) ---
export const GATHERING_RATES = {
  hand: {
    chop: { wood: 5 },
    mine: { stone: 3 },
    collect_water: { water: 4 },
    forage: { food: 4 },
    dig: { clay: 3 },
  },
  structure: {
    sawmill: { wood: 10 },
    quarry: { stone: 6 },
    well: { water: 8 },
    farm: { food: 5 },
  },
};

// --- Refining Recipes ---
export interface RefiningRecipe {
  name: string;
  inputs: Record<string, number>;
  outputs: Record<string, number>;
  requiresStructure: string | null;
  handCraftable: boolean;
  handYieldMultiplier: number;
}

export const REFINING_RECIPES: Record<string, RefiningRecipe> = {
  planks: {
    name: "planks",
    inputs: { wood: 3 },
    outputs: { planks: 2 },
    requiresStructure: null,
    handCraftable: true,
    handYieldMultiplier: 0.5,
  },
  bricks: {
    name: "bricks",
    inputs: { clay: 2, water: 1 },
    outputs: { bricks: 3 },
    requiresStructure: "kiln",
    handCraftable: true,
    handYieldMultiplier: 0.5,
  },
  cement: {
    name: "cement",
    inputs: { stone: 3, water: 1, clay: 1 },
    outputs: { cement: 2 },
    requiresStructure: "cement_works",
    handCraftable: false,
    handYieldMultiplier: 0,
  },
  glass: {
    name: "glass",
    inputs: { stone: 4, wood: 2 },
    outputs: { glass: 1 },
    requiresStructure: "forge",
    handCraftable: false,
    handYieldMultiplier: 0,
  },
  steel: {
    name: "steel",
    inputs: { stone: 5, wood: 3, water: 1 },
    outputs: { steel: 1 },
    requiresStructure: "forge",
    handCraftable: false,
    handYieldMultiplier: 0,
  },
};

// --- Rent Contracts ---
export const RENT_CONTRACTS = {
  sprint: { ticks: 3, incomeMultiplier: 1.5, collectWindow: 2 },
  standard: { ticks: 10, incomeMultiplier: 1.0, collectWindow: 5 },
  long_term: { ticks: 30, incomeMultiplier: 0.7, collectWindow: 30 },
};

// --- Resource Node Respawn (in ticks) ---
export const RESOURCE_RESPAWN = {
  tree: 8,
  stone_deposit: 20,
  clay_deposit: 10,
  water_source: 0, // never depletes
  fertile_soil: 8,
};

// --- Agent Colors ---
export const AGENT_COLORS = [
  "#e74c3c", "#e67e22", "#f1c40f", "#2ecc71",
  "#1abc9c", "#3498db", "#9b59b6", "#e91e63",
  "#00bcd4", "#ff5722", "#795548", "#607d8b",
  "#8bc34a", "#ff9800", "#673ab7", "#009688",
];

// --- Personalities ---
export const PERSONALITIES: string[] = [
  "builder", "trader", "politician", "explorer", "hoarder", "diplomat",
];

// --- Building Definitions ---
export interface BuildingDefinition {
  type: string;
  tier: number;
  width: number;
  height: number;
  cost: {
    raw: Record<string, number>;
    refined: Record<string, number>;
    tokens: number;
  };
  benefit: string;
  buildTime: number;
  maxLevel: number;
  tokenIncome: number;
  production?: Record<string, number>;
  durability: number;
  maxDurability: number;
  decayRate: number;
  gateRequirement?: string;
  reputationGate?: number;
  residential?: boolean;
  refineryRecipe?: string;
  adjacencyBonus?: {
    target: string;
    bonusPercent: number;
  };
  areaOfEffect?: number;
}

export const BUILDING_DEFINITIONS: Record<string, BuildingDefinition> = {
  // ======================== TIER 1 ========================
  wooden_hut: {
    type: "wooden_hut",
    tier: 1,
    width: 1,
    height: 1,
    cost: { raw: { wood: 10 }, refined: { planks: 5 }, tokens: 10 },
    benefit: "+4 tokens/tick rent",
    buildTime: 10,
    maxLevel: 3,
    tokenIncome: 4,
    durability: 50,
    maxDurability: 50,
    decayRate: 1,
    residential: true,
  },
  farm: {
    type: "farm",
    tier: 1,
    width: 2,
    height: 2,
    cost: { raw: { wood: 8, clay: 3 }, refined: { planks: 3 }, tokens: 15 },
    benefit: "+6 food/tick",
    buildTime: 10,
    maxLevel: 3,
    tokenIncome: 0,
    production: { food: 6 },
    durability: 50,
    maxDurability: 50,
    decayRate: 1,
  },
  sawmill: {
    type: "sawmill",
    tier: 1,
    width: 2,
    height: 2,
    cost: { raw: { wood: 5, stone: 3 }, refined: { planks: 5 }, tokens: 10 },
    benefit: "2x wood gathering, enables plank refining",
    buildTime: 10,
    maxLevel: 3,
    tokenIncome: 0,
    production: { wood: 3 },
    durability: 50,
    maxDurability: 50,
    decayRate: 1,
    refineryRecipe: "planks",
  },
  storage_shed: {
    type: "storage_shed",
    tier: 1,
    width: 1,
    height: 1,
    cost: { raw: { wood: 8 }, refined: { planks: 4 }, tokens: 5 },
    benefit: "+50 inventory capacity",
    buildTime: 5,
    maxLevel: 3,
    tokenIncome: 0,
    durability: 50,
    maxDurability: 50,
    decayRate: 1,
  },
  dirt_road: {
    type: "dirt_road",
    tier: 1,
    width: 1,
    height: 1,
    cost: { raw: { stone: 2 }, refined: {}, tokens: 2 },
    benefit: "+10% income to adjacent buildings",
    buildTime: 2,
    maxLevel: 1,
    tokenIncome: 0,
    durability: 30,
    maxDurability: 30,
    decayRate: 1,
    adjacencyBonus: { target: "wooden_hut", bonusPercent: 10 },
  },
  well: {
    type: "well",
    tier: 1,
    width: 1,
    height: 1,
    cost: { raw: { stone: 5, wood: 3 }, refined: {}, tokens: 10 },
    benefit: "Water without river",
    buildTime: 10,
    maxLevel: 1,
    tokenIncome: 0,
    production: { water: 4 },
    durability: 50,
    maxDurability: 50,
    decayRate: 1,
  },

  // ======================== TIER 2 ========================
  kiln: {
    type: "kiln",
    tier: 2,
    width: 2,
    height: 2,
    cost: { raw: { stone: 5, clay: 3 }, refined: { planks: 15 }, tokens: 20 },
    benefit: "Enables brick production, unlocks Tier 2",
    buildTime: 15,
    maxLevel: 3,
    tokenIncome: 0,
    durability: 80,
    maxDurability: 80,
    decayRate: 1,
    refineryRecipe: "bricks",
  },
  stone_house: {
    type: "stone_house",
    tier: 2,
    width: 2,
    height: 2,
    cost: { raw: { stone: 10 }, refined: { bricks: 10, planks: 5 }, tokens: 25 },
    benefit: "+8 tokens/tick rent",
    buildTime: 15,
    maxLevel: 3,
    tokenIncome: 8,
    durability: 100,
    maxDurability: 100,
    decayRate: 1,
    gateRequirement: "kiln",
    residential: true,
  },
  marketplace: {
    type: "marketplace",
    tier: 2,
    width: 3,
    height: 3,
    cost: { raw: { stone: 8 }, refined: { bricks: 8, planks: 10 }, tokens: 30 },
    benefit: "+5 tokens/tick from trade fees",
    buildTime: 15,
    maxLevel: 3,
    tokenIncome: 5,
    durability: 80,
    maxDurability: 80,
    decayRate: 1,
    gateRequirement: "kiln",
  },
  stone_wall: {
    type: "stone_wall",
    tier: 2,
    width: 1,
    height: 1,
    cost: { raw: { stone: 5 }, refined: { bricks: 3 }, tokens: 3 },
    benefit: "Decorative border, +durability to adjacent",
    buildTime: 5,
    maxLevel: 1,
    tokenIncome: 0,
    durability: 100,
    maxDurability: 100,
    decayRate: 0.5,
    gateRequirement: "kiln",
  },
  warehouse: {
    type: "warehouse",
    tier: 2,
    width: 2,
    height: 2,
    cost: { raw: { stone: 8 }, refined: { bricks: 6, planks: 8 }, tokens: 20 },
    benefit: "+100 inventory capacity",
    buildTime: 10,
    maxLevel: 3,
    tokenIncome: 0,
    durability: 80,
    maxDurability: 80,
    decayRate: 1,
    gateRequirement: "kiln",
  },
  paved_road: {
    type: "paved_road",
    tier: 2,
    width: 1,
    height: 1,
    cost: { raw: { stone: 3 }, refined: { bricks: 2 }, tokens: 5 },
    benefit: "+15% income to adjacent buildings",
    buildTime: 5,
    maxLevel: 1,
    tokenIncome: 0,
    durability: 80,
    maxDurability: 80,
    decayRate: 0.5,
    gateRequirement: "kiln",
    adjacencyBonus: { target: "stone_house", bonusPercent: 15 },
  },
  workshop: {
    type: "workshop",
    tier: 2,
    width: 2,
    height: 2,
    cost: { raw: { stone: 6 }, refined: { bricks: 5, planks: 8 }, tokens: 20 },
    benefit: "-10% build costs",
    buildTime: 10,
    maxLevel: 3,
    tokenIncome: 0,
    durability: 80,
    maxDurability: 80,
    decayRate: 1,
    gateRequirement: "kiln",
  },
  inn: {
    type: "inn",
    tier: 2,
    width: 2,
    height: 2,
    cost: { raw: { wood: 5 }, refined: { bricks: 8, planks: 10 }, tokens: 25 },
    benefit: "+4 tokens/tick, enables clans",
    buildTime: 15,
    maxLevel: 3,
    tokenIncome: 4,
    durability: 80,
    maxDurability: 80,
    decayRate: 1,
    gateRequirement: "kiln",
  },

  // ======================== TIER 3 ========================
  cement_works: {
    type: "cement_works",
    tier: 3,
    width: 3,
    height: 3,
    cost: { raw: { stone: 15 }, refined: { bricks: 30, planks: 10 }, tokens: 50 },
    benefit: "Enables cement production",
    buildTime: 20,
    maxLevel: 3,
    tokenIncome: 0,
    durability: 150,
    maxDurability: 150,
    decayRate: 1,
    gateRequirement: "kiln",
    refineryRecipe: "cement",
  },
  town_hall: {
    type: "town_hall",
    tier: 3,
    width: 4,
    height: 4,
    cost: { raw: {}, refined: { bricks: 20, cement: 10, glass: 5 }, tokens: 100 },
    benefit: "Governance system, unlocks Tier 3",
    buildTime: 30,
    maxLevel: 3,
    tokenIncome: 10,
    durability: 200,
    maxDurability: 200,
    decayRate: 1,
    gateRequirement: "kiln",
    reputationGate: 20,
  },
  apartment_block: {
    type: "apartment_block",
    tier: 3,
    width: 2,
    height: 2,
    cost: { raw: {}, refined: { bricks: 15, cement: 8, planks: 5 }, tokens: 40 },
    benefit: "+20 tokens/tick rent",
    buildTime: 20,
    maxLevel: 3,
    tokenIncome: 20,
    durability: 150,
    maxDurability: 150,
    decayRate: 1,
    gateRequirement: "town_hall",
    residential: true,
  },
  bank: {
    type: "bank",
    tier: 3,
    width: 3,
    height: 3,
    cost: { raw: {}, refined: { cement: 15, glass: 5, steel: 3 }, tokens: 80 },
    benefit: "+15 tokens/tick, lending economy",
    buildTime: 25,
    maxLevel: 3,
    tokenIncome: 15,
    durability: 200,
    maxDurability: 200,
    decayRate: 1,
    gateRequirement: "town_hall",
  },
  university: {
    type: "university",
    tier: 3,
    width: 3,
    height: 3,
    cost: { raw: {}, refined: { cement: 25, glass: 10, bricks: 15 }, tokens: 100 },
    benefit: "Unlocks Tier 4, +reputation generation",
    buildTime: 30,
    maxLevel: 3,
    tokenIncome: 5,
    durability: 200,
    maxDurability: 200,
    decayRate: 1,
    gateRequirement: "town_hall",
    reputationGate: 30,
  },
  hospital: {
    type: "hospital",
    tier: 3,
    width: 3,
    height: 3,
    cost: { raw: {}, refined: { cement: 20, glass: 8, steel: 5 }, tokens: 80 },
    benefit: "50% less decay for buildings within 5 tiles",
    buildTime: 25,
    maxLevel: 3,
    tokenIncome: 3,
    durability: 200,
    maxDurability: 200,
    decayRate: 0.5,
    gateRequirement: "town_hall",
    areaOfEffect: 5,
  },
  commercial_tower: {
    type: "commercial_tower",
    tier: 3,
    width: 2,
    height: 2,
    cost: { raw: {}, refined: { cement: 12, glass: 6, steel: 4 }, tokens: 60 },
    benefit: "+25 tokens/tick (needs residential nearby)",
    buildTime: 20,
    maxLevel: 3,
    tokenIncome: 25,
    durability: 150,
    maxDurability: 150,
    decayRate: 1,
    gateRequirement: "town_hall",
  },
  forge: {
    type: "forge",
    tier: 3,
    width: 2,
    height: 2,
    cost: { raw: { stone: 10 }, refined: { bricks: 15, cement: 10 }, tokens: 50 },
    benefit: "Enables glass + steel production",
    buildTime: 20,
    maxLevel: 3,
    tokenIncome: 0,
    durability: 150,
    maxDurability: 150,
    decayRate: 1,
    gateRequirement: "town_hall",
    refineryRecipe: "steel",
  },
  embassy: {
    type: "embassy",
    tier: 3,
    width: 2,
    height: 2,
    cost: { raw: {}, refined: { bricks: 12, cement: 8, glass: 4 }, tokens: 60 },
    benefit: "+5 reputation/tick to owner, clan bonuses",
    buildTime: 20,
    maxLevel: 3,
    tokenIncome: 5,
    durability: 150,
    maxDurability: 150,
    decayRate: 1,
    gateRequirement: "town_hall",
  },

  // ======================== TIER 4 ========================
  skyscraper: {
    type: "skyscraper",
    tier: 4,
    width: 2,
    height: 2,
    cost: { raw: {}, refined: { steel: 20, glass: 15, cement: 20 }, tokens: 200 },
    benefit: "+80 tokens/tick rent!",
    buildTime: 60,
    maxLevel: 3,
    tokenIncome: 80,
    durability: 200,
    maxDurability: 200,
    decayRate: 1,
    gateRequirement: "university",
    reputationGate: 50,
    residential: true,
  },
  grand_bazaar: {
    type: "grand_bazaar",
    tier: 4,
    width: 4,
    height: 4,
    cost: { raw: {}, refined: { steel: 15, glass: 10, cement: 15, bricks: 20 }, tokens: 150 },
    benefit: "+30 tokens/tick, mega-trade radius",
    buildTime: 45,
    maxLevel: 3,
    tokenIncome: 30,
    durability: 200,
    maxDurability: 200,
    decayRate: 1,
    gateRequirement: "university",
  },
  mint: {
    type: "mint",
    tier: 4,
    width: 3,
    height: 3,
    cost: { raw: {}, refined: { steel: 15, glass: 8, cement: 12 }, tokens: 150 },
    benefit: "+50 tokens/tick, money generation",
    buildTime: 40,
    maxLevel: 3,
    tokenIncome: 50,
    durability: 200,
    maxDurability: 200,
    decayRate: 1,
    gateRequirement: "university",
    reputationGate: 50,
  },
  monument: {
    type: "monument",
    tier: 4,
    width: 2,
    height: 2,
    cost: { raw: {}, refined: { steel: 10, glass: 10, cement: 10 }, tokens: 100 },
    benefit: "Custom inscription, +10 reputation, prestige",
    buildTime: 30,
    maxLevel: 1,
    tokenIncome: 0,
    durability: 200,
    maxDurability: 200,
    decayRate: 0.5,
    gateRequirement: "university",
    reputationGate: 50,
  },
  spaceport: {
    type: "spaceport",
    tier: 4,
    width: 5,
    height: 5,
    cost: { raw: {}, refined: { steel: 50, glass: 30, cement: 40 }, tokens: 500 },
    benefit: "Victory condition! Collective achievement.",
    buildTime: 120,
    maxLevel: 1,
    tokenIncome: 100,
    durability: 200,
    maxDurability: 200,
    decayRate: 0.5,
    gateRequirement: "university",
    reputationGate: 50,
  },
};

// --- Terrain Generation ---
export const TERRAIN_WEIGHTS = {
  center: { plains: 0.7, fertile: 0.2, desert: 0.1 },
  edge: { plains: 0.2, forest: 0.3, mountain: 0.2, desert: 0.15, water: 0.15 },
};
