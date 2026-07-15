import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

/**
 * Database client singleton.
 *
 * Uses Neon serverless Postgres (HTTP driver).
 * Initialize with `getDb()` — lazy-initialized so it works
 * even when DATABASE_URL isn't set yet during build.
 */

let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!dbInstance) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL is not set. Connect a Neon database to continue."
      );
    }
    const sql = neon(databaseUrl);
    dbInstance = drizzle(sql, { schema });
  }
  return dbInstance;
}

/**
 * Convenience re-export for server functions.
 * Usage: import { db } from "~/db";
 */
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});

// Re-export schema for convenience
export { schema };
