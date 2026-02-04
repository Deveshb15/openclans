import { internalMutation, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import {
  generateTerrain,
  GridCell,
} from "../helpers";
import {
  FOOD_CONSUMPTION_PER_TICK,
  TAX_RATE,
  RENT_CONTRACTS,
  BUILDING_DEFINITIONS,
  WORLD_EVENT_INTERVAL,
  RESOURCE_RESPAWN,
  PROPOSAL_MIN_VOTERS,
  PROPOSAL_PASS_THRESHOLD,
} from "../constants";

// Initialize game state (run once)
export const initializeGame = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if already initialized
    const existingGrid = await ctx.db.query("gridState").first();
    if (existingGrid) {
      return { ok: false, error: "Game already initialized" };
    }

    // Generate terrain
    const grid = generateTerrain();

    await ctx.db.insert("gridState", {
      grid,
      generatedAt: Date.now(),
    });

    // Initialize game meta
    await ctx.db.insert("gameMeta", { key: "tick", value: "0" });
    await ctx.db.insert("gameMeta", { key: "publicTreasury", value: "0" });
    await ctx.db.insert("gameMeta", { key: "lastTick", value: Date.now().toString() });

    return { ok: true };
  },
});

// Main game tick (run every 45 seconds via cron)
export const runGameTick = internalMutation({
  args: {},
  handler: async (ctx) => {
    const gridState = await ctx.db.query("gridState").first();
    if (!gridState) {
      // Initialize if not done
      const grid = generateTerrain();
      await ctx.db.insert("gridState", {
        grid,
        generatedAt: Date.now(),
      });
      await ctx.db.insert("gameMeta", { key: "tick", value: "0" });
      await ctx.db.insert("gameMeta", { key: "publicTreasury", value: "0" });
      await ctx.db.insert("gameMeta", { key: "lastTick", value: Date.now().toString() });
      return;
    }

    const grid = gridState.grid as GridCell[][];

    // Get current tick
    const tickMeta = await ctx.db
      .query("gameMeta")
      .withIndex("by_key", (q) => q.eq("key", "tick"))
      .first();
    const currentTick = tickMeta ? parseInt(tickMeta.value) : 0;
    const newTick = currentTick + 1;

    // Get public treasury
    const treasuryMeta = await ctx.db
      .query("gameMeta")
      .withIndex("by_key", (q) => q.eq("key", "publicTreasury"))
      .first();
    let publicTreasury = treasuryMeta ? parseFloat(treasuryMeta.value) : 0;

    // Get all online agents
    const allAgents = await ctx.db.query("agents").collect();
    const onlineAgents = allAgents.filter((a) => a.online);

    // 1. Food consumption for online agents
    for (const agent of onlineAgents) {
      const newFood = agent.rawFood - FOOD_CONSUMPTION_PER_TICK;

      if (newFood <= 0) {
        // Agent is starving
        if (!agent.isStarving) {
          await ctx.db.patch(agent._id, {
            rawFood: 0,
            isStarving: true,
            foodConsumedAt: Date.now(),
          });

          // Notify
          await ctx.db.insert("notifications", {
            agentId: agent._id,
            type: "starvation",
            message: "You are starving! Get food immediately.",
            timestamp: Date.now(),
            read: false,
          });
        }
      } else {
        // Agent has food
        await ctx.db.patch(agent._id, {
          rawFood: newFood,
          isStarving: false,
          foodConsumedAt: Date.now(),
        });
      }
    }

    // 2. Building production + token income
    const allBuildings = await ctx.db.query("buildings").collect();
    const completedBuildings = allBuildings.filter((b) => b.completed);

    for (const building of completedBuildings) {
      const definition = BUILDING_DEFINITIONS[building.type];
      if (!definition) continue;

      // Calculate income
      let tokenIncome = building.tokenIncome * building.level;

      // Apply rent contract multiplier
      if (building.rentContractType && building.rentTicksRemaining > 0) {
        const contract = RENT_CONTRACTS[building.rentContractType as keyof typeof RENT_CONTRACTS];
        if (contract) {
          tokenIncome *= contract.incomeMultiplier;
        }

        // Decrement rent ticks
        await ctx.db.patch(building._id, {
          rentTicksRemaining: building.rentTicksRemaining - 1,
        });
      }

      // Calculate tax
      const tax = tokenIncome * TAX_RATE;
      publicTreasury += tax;
      tokenIncome -= tax;

      // Add pending tokens
      let pendingTokens = building.pendingTokens + tokenIncome;

      // Add production resources
      let pendingRawFood = building.pendingRawFood;
      let pendingRawWood = building.pendingRawWood;
      let pendingRawWater = building.pendingRawWater;

      if (definition.production) {
        if (definition.production.food) {
          pendingRawFood += definition.production.food * building.level;
        }
        if (definition.production.wood) {
          pendingRawWood += definition.production.wood * building.level;
        }
        if (definition.production.water) {
          pendingRawWater += definition.production.water * building.level;
        }
      }

      await ctx.db.patch(building._id, {
        pendingTokens,
        pendingRawFood,
        pendingRawWood,
        pendingRawWater,
      });
    }

    // 3. Building decay
    for (const building of completedBuildings) {
      const newDurability = building.durability - building.decayRate;

      if (newDurability <= 0) {
        // Building destroyed
        // Clear from grid
        for (let dy = 0; dy < building.height; dy++) {
          for (let dx = 0; dx < building.width; dx++) {
            const x = building.x + dx;
            const y = building.y + dy;
            if (grid[y] && grid[y][x]) {
              grid[y][x].buildingId = null;
            }
          }
        }

        // Update owner building count
        const owner = await ctx.db.get(building.ownerId);
        if (owner) {
          await ctx.db.patch(owner._id, {
            buildingCount: Math.max(0, owner.buildingCount - 1),
          });

          // Notify
          await ctx.db.insert("notifications", {
            agentId: owner._id,
            type: "building_decayed",
            message: `Your ${building.type} has decayed and was destroyed!`,
            timestamp: Date.now(),
            read: false,
          });
        }

        // Log activity
        await ctx.db.insert("activity", {
          type: "building_decayed",
          agentId: building.ownerId,
          agentName: owner?.name || "Unknown",
          description: `A ${building.type} has decayed`,
          timestamp: Date.now(),
        });

        await ctx.db.delete(building._id);
      } else {
        await ctx.db.patch(building._id, {
          durability: newDurability,
        });
      }
    }

    // 4. Building completion check
    const incompleteBuildings = allBuildings.filter((b) => !b.completed);
    const now = Date.now();

    for (const building of incompleteBuildings) {
      const definition = BUILDING_DEFINITIONS[building.type];
      if (!definition) continue;

      const elapsedSeconds = (now - building.startedAt) / 1000;
      const progress = Math.min(100, (elapsedSeconds / definition.buildTime) * 100);

      if (progress >= 100) {
        // Mark building
        for (let dy = 0; dy < building.height; dy++) {
          for (let dx = 0; dx < building.width; dx++) {
            const x = building.x + dx;
            const y = building.y + dy;
            if (grid[y] && grid[y][x]) {
              grid[y][x].buildingId = building._id;
            }
          }
        }

        await ctx.db.patch(building._id, {
          progress: 100,
          completed: true,
          completedAt: now,
        });

        // Grant reputation
        const owner = await ctx.db.get(building.ownerId);
        if (owner) {
          await ctx.db.patch(owner._id, {
            reputation: owner.reputation + 2,
          });

          // Notify
          await ctx.db.insert("notifications", {
            agentId: owner._id,
            type: "building_completed",
            message: `Your ${building.type} is complete! (+2 reputation)`,
            timestamp: now,
            read: false,
          });
        }

        // Log activity
        await ctx.db.insert("activity", {
          type: "building_completed",
          agentId: building.ownerId,
          agentName: owner?.name || "Unknown",
          description: `${owner?.name || "Unknown"} completed a ${building.type}`,
          timestamp: now,
        });
      } else {
        await ctx.db.patch(building._id, { progress });
      }
    }

    // 5. Resource node respawn
    const resourceNodes = await ctx.db.query("resourceNodes").collect();
    for (const node of resourceNodes) {
      if (node.depletedAt && node.currentAmount <= 0) {
        const respawnTime = RESOURCE_RESPAWN[node.type as keyof typeof RESOURCE_RESPAWN] || 10;
        const depletedTicks = currentTick - Math.floor(node.depletedAt / 45000);

        if (depletedTicks >= respawnTime) {
          await ctx.db.patch(node._id, {
            currentAmount: node.maxAmount,
            depletedAt: undefined,
          });
        }
      }
    }

    // 6. Proposal expiration
    const activeProposals = await ctx.db
      .query("proposals")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    for (const proposal of activeProposals) {
      if (now > proposal.expiresAt) {
        const votes = proposal.votes as Record<string, string>;
        const voteCount = Object.keys(votes).length;
        const yesVotes = Object.values(votes).filter((v) => v === "yes").length;

        let status = "expired";
        let result: string | undefined;

        if (voteCount >= PROPOSAL_MIN_VOTERS) {
          const yesPercentage = yesVotes / voteCount;
          if (yesPercentage >= PROPOSAL_PASS_THRESHOLD) {
            status = "passed";
            result = `Passed with ${yesVotes}/${voteCount} votes (${Math.round(yesPercentage * 100)}%)`;

            // Grant proposer reputation
            const proposer = await ctx.db.get(proposal.proposerId);
            if (proposer) {
              await ctx.db.patch(proposer._id, {
                reputation: proposer.reputation + 10,
              });
            }
          } else {
            status = "failed";
            result = `Failed with ${yesVotes}/${voteCount} votes (${Math.round(yesPercentage * 100)}%)`;
          }
        } else {
          result = `Expired with insufficient votes (${voteCount}/${PROPOSAL_MIN_VOTERS} required)`;
        }

        await ctx.db.patch(proposal._id, { status, result });
      }
    }

    // 7. Trade expiration (48 hours)
    const TRADE_EXPIRE_MS = 48 * 60 * 60 * 1000;
    const openTrades = await ctx.db
      .query("trades")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();

    for (const trade of openTrades) {
      if (now - trade.createdAt > TRADE_EXPIRE_MS) {
        // Return offering to seller
        const seller = await ctx.db.get(trade.sellerId);
        if (seller) {
          await ctx.db.patch(seller._id, {
            rawWood: seller.rawWood + trade.offeringRawWood,
            rawStone: seller.rawStone + trade.offeringRawStone,
            rawWater: seller.rawWater + trade.offeringRawWater,
            rawFood: seller.rawFood + trade.offeringRawFood,
            rawClay: seller.rawClay + trade.offeringRawClay,
            refinedPlanks: seller.refinedPlanks + trade.offeringRefinedPlanks,
            refinedBricks: seller.refinedBricks + trade.offeringRefinedBricks,
            refinedCement: seller.refinedCement + trade.offeringRefinedCement,
            refinedGlass: seller.refinedGlass + trade.offeringRefinedGlass,
            refinedSteel: seller.refinedSteel + trade.offeringRefinedSteel,
            tokens: seller.tokens + trade.offeringTokens,
          });

          // Notify
          await ctx.db.insert("notifications", {
            agentId: seller._id,
            type: "trade_expired",
            message: "Your trade offer expired. Resources returned.",
            timestamp: now,
            read: false,
          });
        }

        await ctx.db.patch(trade._id, {
          status: "expired",
          resolvedAt: now,
        });
      }
    }

    // 8. World events (every WORLD_EVENT_INTERVAL ticks)
    if (newTick % WORLD_EVENT_INTERVAL === 0) {
      const eventTypes = [
        { type: "resource_boom", description: "A resource boom! Gathering yields +50% for 10 ticks." },
        { type: "drought", description: "A drought strikes! Food production halved for 10 ticks." },
        { type: "trade_festival", description: "Trade festival! All trades complete instantly for 10 ticks." },
        { type: "earthquake", description: "Earthquake! All buildings lose 10% durability." },
        { type: "migration_wave", description: "Migration wave! New settlers arriving." },
      ];

      const event = eventTypes[Math.floor(Math.random() * eventTypes.length)];

      await ctx.db.insert("worldEvents", {
        type: event.type,
        description: event.description,
        startTick: newTick,
        endTick: newTick + 10,
        effects: {},
      });

      // Log activity
      await ctx.db.insert("activity", {
        type: "world_event",
        agentId: "" as any,
        agentName: "System",
        description: event.description,
        timestamp: now,
      });
    }

    // Update grid state
    await ctx.db.patch(gridState._id, { grid });

    // Update game meta
    if (tickMeta) {
      await ctx.db.patch(tickMeta._id, { value: newTick.toString() });
    }
    if (treasuryMeta) {
      await ctx.db.patch(treasuryMeta._id, { value: publicTreasury.toString() });
    }

    const lastTickMeta = await ctx.db
      .query("gameMeta")
      .withIndex("by_key", (q) => q.eq("key", "lastTick"))
      .first();
    if (lastTickMeta) {
      await ctx.db.patch(lastTickMeta._id, { value: now.toString() });
    }
  },
});

// Expire old trades (can be run separately)
export const expireTrades = internalMutation({
  args: {},
  handler: async (ctx) => {
    const TRADE_EXPIRE_MS = 48 * 60 * 60 * 1000;
    const now = Date.now();

    const openTrades = await ctx.db
      .query("trades")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();

    let expired = 0;
    for (const trade of openTrades) {
      if (now - trade.createdAt > TRADE_EXPIRE_MS) {
        // Return offering to seller
        const seller = await ctx.db.get(trade.sellerId);
        if (seller) {
          await ctx.db.patch(seller._id, {
            rawWood: seller.rawWood + trade.offeringRawWood,
            rawStone: seller.rawStone + trade.offeringRawStone,
            rawWater: seller.rawWater + trade.offeringRawWater,
            rawFood: seller.rawFood + trade.offeringRawFood,
            rawClay: seller.rawClay + trade.offeringRawClay,
            refinedPlanks: seller.refinedPlanks + trade.offeringRefinedPlanks,
            refinedBricks: seller.refinedBricks + trade.offeringRefinedBricks,
            refinedCement: seller.refinedCement + trade.offeringRefinedCement,
            refinedGlass: seller.refinedGlass + trade.offeringRefinedGlass,
            refinedSteel: seller.refinedSteel + trade.offeringRefinedSteel,
            tokens: seller.tokens + trade.offeringTokens,
          });
        }

        await ctx.db.patch(trade._id, {
          status: "expired",
          resolvedAt: now,
        });

        expired++;
      }
    }

    return { expired };
  },
});
