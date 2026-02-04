import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Main game tick every 45 seconds
crons.interval("gameTick", { seconds: 45 }, internal.tick.internal.runGameTick);

// Cleanup expired trades hourly
crons.interval("expireTrades", { hours: 1 }, internal.tick.internal.expireTrades);

export default crons;
