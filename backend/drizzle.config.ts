import type { Config } from "drizzle-kit";

/**
 * Drizzle Kit configuration for ReceptionAI.
 *
 * Uses DATABASE_URL from environment (Neon serverless Postgres).
 * Migrations output to ./db/migrations/
 */
export default {
  schema: "./db/schema/index.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Multi-tenant schema uses schemas for tenant isolation:
  // organizations each get their own schema namespace.
  // We use a shared `public` schema as the starting point.
  tablesFilter: ["!drizzle_*"],
} satisfies Config;
