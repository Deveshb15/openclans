/**
 * One-time migration: recalculate plotCount for all agents.
 *
 * The old code incremented plotCount by 1 per plot instead of by
 * width * height (tile count). This script sets each agent's plotCount
 * to the sum of (width * height) across all their plots.
 *
 * Usage:
 *   npx tsx scripts/fix-plot-counts.ts
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, sql } from "drizzle-orm";
import * as schema from "../party/db/schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const db = drizzle(neon(databaseUrl), { schema });

async function main() {
  // Calculate correct plotCount per agent: SUM(width * height)
  const correctCounts = await db
    .select({
      ownerId: schema.plots.ownerId,
      tileCount: sql<number>`COALESCE(SUM(${schema.plots.width} * ${schema.plots.height}), 0)::int`,
    })
    .from(schema.plots)
    .groupBy(schema.plots.ownerId);

  // Also get agents with 0 plots (they might have a stale plotCount > 0)
  const allAgents = await db
    .select({ id: schema.agents.id, plotCount: schema.agents.plotCount })
    .from(schema.agents);

  const correctMap = new Map<string, number>();
  for (const row of correctCounts) {
    correctMap.set(row.ownerId, row.tileCount);
  }

  let updated = 0;
  let skipped = 0;

  for (const agent of allAgents) {
    const correctCount = correctMap.get(agent.id) ?? 0;
    if (agent.plotCount !== correctCount) {
      await db
        .update(schema.agents)
        .set({ plotCount: correctCount })
        .where(eq(schema.agents.id, agent.id));
      console.log(`  ${agent.id}: ${agent.plotCount} -> ${correctCount}`);
      updated++;
    } else {
      skipped++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, Already correct: ${skipped}`);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
