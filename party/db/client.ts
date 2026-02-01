import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

let cachedDb: Db | null = null;
let cachedUrl: string | null = null;

export function getDb(databaseUrl: string): Db {
  if (cachedDb && cachedUrl === databaseUrl) {
    return cachedDb;
  }
  cachedDb = createDb(databaseUrl);
  cachedUrl = databaseUrl;
  return cachedDb;
}
