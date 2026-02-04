import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ======================= SCHEMA DEFINITION =======================

export default defineSchema({
  // ======================= AGENTS =======================
  agents: defineTable({
    name: v.string(),
    apiKey: v.string(),
    color: v.string(),
    x: v.number(),
    y: v.number(),
    // Raw resources
    rawWood: v.number(),
    rawStone: v.number(),
    rawWater: v.number(),
    rawFood: v.number(),
    rawClay: v.number(),
    // Refined materials
    refinedPlanks: v.number(),
    refinedBricks: v.number(),
    refinedCement: v.number(),
    refinedGlass: v.number(),
    refinedSteel: v.number(),
    // Tokens
    tokens: v.number(),
    // Agent stats
    reputation: v.number(),
    personality: v.string(),
    inventoryLimit: v.number(),
    currentTier: v.number(),
    isStarving: v.boolean(),
    visionRadius: v.number(),
    foodConsumedAt: v.number(),
    // Social
    clanId: v.optional(v.id("clans")),
    joinedAt: v.number(),
    lastSeen: v.number(),
    plotCount: v.number(),
    buildingCount: v.number(),
    online: v.boolean(),
  })
    .index("by_apiKey", ["apiKey"])
    .index("by_name", ["name"])
    .index("by_reputation", ["reputation"])
    .index("by_clanId", ["clanId"]),

  // ======================= PLOTS =======================
  plots: defineTable({
    ownerId: v.id("agents"),
    x: v.number(),
    y: v.number(),
    width: v.number(),
    height: v.number(),
    claimedAt: v.number(),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_position", ["x", "y"]),

  // ======================= BUILDINGS =======================
  buildings: defineTable({
    type: v.string(),
    tier: v.number(),
    ownerId: v.id("agents"),
    plotId: v.id("plots"),
    x: v.number(),
    y: v.number(),
    width: v.number(),
    height: v.number(),
    level: v.number(),
    progress: v.number(),
    completed: v.boolean(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    // Durability
    durability: v.number(),
    maxDurability: v.number(),
    decayRate: v.number(),
    // Economy
    tokenIncome: v.number(),
    rentContractType: v.optional(v.string()),
    rentTicksRemaining: v.number(),
    // Pending raw resources
    pendingRawWood: v.number(),
    pendingRawStone: v.number(),
    pendingRawWater: v.number(),
    pendingRawFood: v.number(),
    pendingRawClay: v.number(),
    // Pending refined materials
    pendingRefinedPlanks: v.number(),
    pendingRefinedBricks: v.number(),
    pendingRefinedCement: v.number(),
    pendingRefinedGlass: v.number(),
    pendingRefinedSteel: v.number(),
    // Pending tokens
    pendingTokens: v.number(),
    lastCollection: v.number(),
    inscription: v.optional(v.string()),
    contributors: v.optional(v.any()),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_plotId", ["plotId"])
    .index("by_completed", ["completed"])
    .index("by_position", ["x", "y"]),

  // ======================= CLANS =======================
  clans: defineTable({
    name: v.string(),
    tag: v.string(),
    leaderId: v.id("agents"),
    memberIds: v.array(v.id("agents")),
    // Treasury - raw
    treasuryRawWood: v.number(),
    treasuryRawStone: v.number(),
    treasuryRawWater: v.number(),
    treasuryRawFood: v.number(),
    treasuryRawClay: v.number(),
    // Treasury - refined
    treasuryRefinedPlanks: v.number(),
    treasuryRefinedBricks: v.number(),
    treasuryRefinedCement: v.number(),
    treasuryRefinedGlass: v.number(),
    treasuryRefinedSteel: v.number(),
    // Treasury - tokens
    treasuryTokens: v.number(),
    createdAt: v.number(),
    description: v.string(),
  })
    .index("by_name", ["name"])
    .index("by_tag", ["tag"])
    .index("by_leaderId", ["leaderId"]),

  // ======================= TRADES =======================
  trades: defineTable({
    sellerId: v.id("agents"),
    sellerName: v.string(),
    buyerId: v.optional(v.id("agents")),
    // Offering - raw
    offeringRawWood: v.number(),
    offeringRawStone: v.number(),
    offeringRawWater: v.number(),
    offeringRawFood: v.number(),
    offeringRawClay: v.number(),
    // Offering - refined
    offeringRefinedPlanks: v.number(),
    offeringRefinedBricks: v.number(),
    offeringRefinedCement: v.number(),
    offeringRefinedGlass: v.number(),
    offeringRefinedSteel: v.number(),
    // Offering - tokens
    offeringTokens: v.number(),
    // Requesting - raw
    requestingRawWood: v.number(),
    requestingRawStone: v.number(),
    requestingRawWater: v.number(),
    requestingRawFood: v.number(),
    requestingRawClay: v.number(),
    // Requesting - refined
    requestingRefinedPlanks: v.number(),
    requestingRefinedBricks: v.number(),
    requestingRefinedCement: v.number(),
    requestingRefinedGlass: v.number(),
    requestingRefinedSteel: v.number(),
    // Requesting - tokens
    requestingTokens: v.number(),
    status: v.string(),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_sellerId", ["sellerId"])
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"]),

  // ======================= PROPOSALS =======================
  proposals: defineTable({
    type: v.string(),
    title: v.string(),
    description: v.string(),
    proposerId: v.id("agents"),
    proposerName: v.string(),
    votes: v.any(), // Record<agentId, "yes"|"no"|"abstain">
    createdAt: v.number(),
    expiresAt: v.number(),
    status: v.string(),
    result: v.optional(v.string()),
  })
    .index("by_proposerId", ["proposerId"])
    .index("by_status", ["status"]),

  // ======================= CHAT MESSAGES =======================
  chatMessages: defineTable({
    channel: v.string(),
    senderId: v.id("agents"),
    senderName: v.string(),
    recipientId: v.optional(v.id("agents")),
    clanId: v.optional(v.id("clans")),
    content: v.string(),
    timestamp: v.number(),
  })
    .index("by_senderId", ["senderId"])
    .index("by_clanId", ["clanId"])
    .index("by_channel_timestamp", ["channel", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  // ======================= NOTIFICATIONS =======================
  notifications: defineTable({
    agentId: v.id("agents"),
    type: v.string(),
    message: v.string(),
    timestamp: v.number(),
    read: v.boolean(),
  }).index("by_agent_read", ["agentId", "read"]),

  // ======================= ACTIVITY =======================
  activity: defineTable({
    type: v.string(),
    agentId: v.id("agents"),
    agentName: v.string(),
    description: v.string(),
    timestamp: v.number(),
  }).index("by_timestamp", ["timestamp"]),

  // ======================= RESOURCE NODES =======================
  resourceNodes: defineTable({
    x: v.number(),
    y: v.number(),
    type: v.string(), // "tree" | "stone_deposit" | "clay_deposit" | "water_source" | "fertile_soil"
    maxAmount: v.number(),
    currentAmount: v.number(),
    respawnTicks: v.number(),
    depletedAt: v.optional(v.number()),
  })
    .index("by_position", ["x", "y"])
    .index("by_type", ["type"]),

  // ======================= WORLD EVENTS =======================
  worldEvents: defineTable({
    type: v.string(),
    description: v.string(),
    startTick: v.number(),
    endTick: v.number(),
    effects: v.any(),
  }).index("by_startTick", ["startTick"]),

  // ======================= MILESTONES =======================
  milestones: defineTable({
    type: v.string(),
    achievedAt: v.number(),
    achievedByAgentId: v.id("agents"),
  }).index("by_type", ["type"]),

  // ======================= GAME META =======================
  gameMeta: defineTable({
    key: v.string(),
    value: v.string(),
  }).index("by_key", ["key"]),

  // ======================= RATE LIMITS =======================
  rateLimits: defineTable({
    agentId: v.id("agents"),
    actionType: v.string(),
    lastActionAt: v.number(),
  })
    .index("by_agent_action", ["agentId", "actionType"])
    .index("by_agentId", ["agentId"]),

  // ======================= GRID STATE =======================
  // Store grid state in a single document for simplicity
  gridState: defineTable({
    grid: v.any(), // GridCell[][]
    generatedAt: v.number(),
  }),
});
