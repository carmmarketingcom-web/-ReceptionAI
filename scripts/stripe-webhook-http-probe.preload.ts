/**
 * HTTP probe preload for POST /api/stripe/webhook.
 *
 * Runs the REAL production server — `bun --preload ./scripts/stripe-webhook-http-probe.preload.ts serve.ts`
 * — with only the outside world replaced, so the routing, the request hand-off and the
 * signature check are exercised exactly as they are in production:
 *
 *   • @neondatabase/serverless  → tagged-template SQL executed against bun:sqlite (real SQL,
 *     real UNIQUE constraint on stripe_event_id, real row counts), so no production row is
 *     read or written;
 *   • src/lib/email.ts          → capture stub (records what WOULD be sent);
 *   • globalThis.fetch          → throws on ANY outbound call, so a real Stripe/Telnyx/email
 *     request cannot happen and would fail the probe loudly if the code ever made one;
 *   • a small read-only sidecar on :3112/db reports what the handler actually wrote.
 *
 * STRIPE_WEBHOOK_SECRET is set to a throwaway value, so signatures are really verified.
 *
 * Nothing here is imported by the app: it is only ever loaded with `bun --preload`.
 */
import { mock } from "bun:test";
import { Database } from "bun:sqlite";

const REPO = "/tmp/receptionai-live";
const DB_FILE = process.env.PROBE_DB || "/tmp/stripe-webhook-probe.sqlite";
const db = new Database(DB_FILE);
db.exec(`

  CREATE TABLE organizations (
    id TEXT PRIMARY KEY, name TEXT, slug TEXT, email TEXT, phone TEXT, transfer_number TEXT,
    timezone TEXT, locale TEXT, industry TEXT, postal_code TEXT, stripe_customer_id TEXT,
    metadata TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE users (
    id TEXT PRIMARY KEY, organization_id TEXT, email TEXT, name TEXT, role TEXT,
    password_hash TEXT, metadata TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE subscription_plans (id TEXT PRIMARY KEY, name TEXT);
  CREATE TABLE subscriptions (
    id TEXT PRIMARY KEY, organization_id TEXT, plan_id TEXT, stripe_subscription_id TEXT,
    stripe_customer_id TEXT, status TEXT, billing_cycle TEXT, metadata TEXT,
    current_period_start TEXT, current_period_end TEXT, cancel_at_period_end INTEGER,
    canceled_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE phone_numbers (
    id TEXT PRIMARY KEY, organization_id TEXT, phone_number TEXT, provider TEXT,
    telnyx_number_id TEXT, is_active INTEGER, capabilities TEXT, metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE business_hours (
    id TEXT PRIMARY KEY, organization_id TEXT, day_of_week TEXT, open_time TEXT,
    close_time TEXT, is_closed INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE stripe_events (
    id TEXT PRIMARY KEY, stripe_event_id TEXT NOT NULL UNIQUE, event_type TEXT NOT NULL,
    payload TEXT NOT NULL, processed_at TEXT, error TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE password_set_tokens (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, organization_id TEXT, token_hash TEXT NOT NULL UNIQUE,
    purpose TEXT NOT NULL DEFAULT 'set-password', expires_at TEXT NOT NULL, used_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  INSERT INTO subscription_plans (id, name) VALUES ('plan-starter','starter'),('plan-growth','growth'),('plan-scale','scale');
`);

/**
 * A `neon()` stand-in: executes the handler's tagged-template SQL against SQLite.
 * Casts (`::jsonb`) and NOW() are translated; booleans become 0/1; $N placeholders are kept
 * (SQLite accepts ?N).
 */
function fakeNeon(_url?: string) {
  return (strings: TemplateStringsArray, ...values: any[]) => {
    let sql = strings[0];
    for (let i = 0; i < values.length; i++) sql += `?${i + 1}` + strings[i + 1];
    sql = sql
      .replace(/::\s*(jsonb|json|timestamptz|timestamp|text|uuid|varchar)/gi, "")
      .replace(/\bNOW\(\)/gi, "CURRENT_TIMESTAMP");
    const params = values.map((v) => (typeof v === "boolean" ? (v ? 1 : 0) : v === undefined ? null : v));
    return Promise.resolve(db.prepare(sql).all(...params));
  };
}
mock.module("@neondatabase/serverless", () => ({ neon: fakeNeon, Pool: class {}, Client: class {} }));

// ── Email capture stub ───────────────────────────────────────────────────────────────────
const outbox: Array<{ to: string; subject: string }> = [];
mock.module(`${REPO}/src/lib/email.ts`, () => ({
  sendEmail: async (to: string, subject: string) => {
    outbox.push({ to, subject });
    return true;
  },
}));

// ── Outbound network stub: nothing real may leave this process ───────────────────────────
const outbound: string[] = [];
globalThis.fetch = (async (input: any) => {
  const url = typeof input === "string" ? input : input.url;
  outbound.push(url);
  throw new Error(`OUTBOUND CALL BLOCKED BY PROBE: ${url}`);
}) as any;

// ── Environment: throwaway values only ───────────────────────────────────────────────────
process.env.DATABASE_URL = "postgres://probe/probe";
process.env.JWT_SECRET = "probe-secret-that-is-at-least-32-chars-long";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_probe_only_do_not_use";
process.env.PORT = process.env.PORT || "3111";
delete process.env.TELNYX_API_KEY;
delete process.env.TELNYX_CONNECTION_ID;
delete process.env.STRIPE_SECRET_KEY;
delete process.env.RESEND_API_KEY;
delete process.env.SUPPORT_ALERT_TO;
delete process.env.SUPPORT_ALERT_FROM;

// ── Sidecar: what did the handler actually write? ────────────────────────────────────────
Bun.serve({
  port: Number(process.env.PROBE_ADMIN_PORT || 3112),
  hostname: "127.0.0.1",
  fetch(req) {
    const { pathname } = new URL(req.url);
    if (pathname !== "/db") return new Response("not found", { status: 404 });
    return Response.json({
      stripe_events: db
        .prepare("SELECT stripe_event_id, event_type, processed_at, error FROM stripe_events ORDER BY stripe_event_id")
        .all(),
      organizations: db.prepare("SELECT COUNT(*) AS n FROM organizations").get(),
      subscriptions: db.prepare("SELECT COUNT(*) AS n FROM subscriptions").get(),
      phone_numbers: db.prepare("SELECT COUNT(*) AS n FROM phone_numbers").get(),
      outbound_calls: outbound,
      emails: outbox,
    });
  },
});
console.log("[probe] sqlite-backed DB at " + DB_FILE + ", sidecar on :" + (process.env.PROBE_ADMIN_PORT || 3112) + "/db");
