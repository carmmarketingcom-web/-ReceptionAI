/**
 * Database client for the TanStack Start site.
 *
 * Uses Neon serverless Postgres via Drizzle ORM.
 * Lazy-initialized — works even before DATABASE_URL is set (returns mock mode).
 */

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema/index";

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let mockMode = false;
const mockStore = new Map<string, any[]>();

export function getDb() {
  if (dbInstance) return dbInstance;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn("[DB] DATABASE_URL not set — running in mock mode");
    mockMode = true;
    // Return a proxy that simulates DB operations
    return createMockDb();
  }

  const sql = neon(databaseUrl);
  dbInstance = drizzle(sql, { schema });
  return dbInstance;
}

export function isMockMode() {
  return mockMode;
}

/**
 * Mock DB for development without a real database.
 * Stores data in memory and supports basic CRUD operations.
 */
function createMockDb(): any {
  return new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "select") {
          return () => ({
            from: (table: any) => ({
              where: () => ({
                limit: () => mockStore.get(table.name || "default") || [],
                orderBy: () => ({
                  limit: () => mockStore.get(table.name || "default") || [],
                }),
              }),
              limit: () => mockStore.get(table.name || "default") || [],
              orderBy: () => ({
                limit: () => mockStore.get(table.name || "default") || [],
              }),
              all: () => mockStore.get(table.name || "default") || [],
            }),
          });
        }
        if (prop === "insert") {
          return (table: any) => ({
            values: (data: any) => {
              const key = table.name || "default";
              const rows = mockStore.get(key) || [];
              const newRow = {
                ...data,
                id: data.id || crypto.randomUUID(),
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              rows.push(newRow);
              mockStore.set(key, rows);
              return { returning: () => [newRow] };
            },
          });
        }
        if (prop === "update") {
          return (table: any) => ({
            set: (data: any) => ({
              where: () => ({
                returning: () => {
                  const key = table.name || "default";
                  const rows = mockStore.get(key) || [];
                  if (rows.length > 0) {
                    Object.assign(rows[0], { ...data, updatedAt: new Date() });
                  }
                  return rows;
                },
              }),
            }),
          });
        }
        if (prop === "delete") {
          return (table: any) => ({
            where: () => {
              const key = table.name || "default";
              mockStore.set(key, []);
              return { returning: () => [] };
            },
          });
        }
        if (prop === "query") {
          return {
            users: {
              findFirst: () => null,
            },
          };
        }
        if (prop === "_mockStore") return mockStore;
        return () => ({});
      },
    }
  );
}

// Convenience re-export
export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});

export { schema };
