/**
 * Calendar connection requests — POST/GET /api/calendar-request, proved end to end.
 *
 * Why this exists: the Calendar card on Settings tells a customer that Google/Outlook sync is
 * not installable yet and offers a request instead. Two things make that honest and both are
 * pinned here against the REAL serve.ts request handler (not a re-implementation):
 *   - a second request from the same org updates the one row instead of piling up duplicates
 *     (unique index on organization_id + provider, ON CONFLICT DO UPDATE);
 *   - the endpoint is org-scoped and authenticated — another business's request is invisible,
 *     and an unauthenticated caller gets 401.
 * Postgres is replaced by an in-memory SQLite database, Resend is stubbed, so no production row
 * and no email is touched.
 *
 * Run: bun test scripts/calendar-request.test.ts
 * Hold the server open for a manual curl: HOLD=1 bun test scripts/calendar-request.test.ts
 */
import { test, expect, beforeAll, mock } from "bun:test";
import { Database } from "bun:sqlite";
import { join } from "node:path";
import { SignJWT } from "jose";

const REPO = process.env.RECEPTIONAI_REPO || join(import.meta.dir, "..");
// Env is read when serve.ts loads, so it must be set before anything imports it.
process.env.PORT = "3217"; // fixed: never the platform default port
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-test-secret-test-secret-1234";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://fake/fake";
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "test-key";
const PORT = Number(process.env.PORT);
const BASE = `http://127.0.0.1:${PORT}`;
const realFetch = globalThis.fetch.bind(globalThis);

const ORG_A = "11111111-1111-1111-1111-111111111111";
const ORG_B = "22222222-2222-2222-2222-222222222222";
const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const db = new Database(":memory:");

// SQLite has no uuid/timestamptz/gen_random_uuid — enough translation to run the real statements.
function translate(text: string): string {
  return text
    .replace(/::[a-z_]+(\[\])?/gi, "")
    .replace(/gen_random_uuid\(\)/gi, "(lower(hex(randomblob(16))))")
    .replace(/\bNOW\(\)/gi, "CURRENT_TIMESTAMP")
    .replace(/\btimestamptz\b/gi, "TEXT")
    .replace(/\bjsonb\b/gi, "TEXT")
    .replace(/\buuid\b/gi, "TEXT");
}

function sqlTag(strings: TemplateStringsArray, ...params: any[]) {
  const text = translate(strings.reduce((a, s, i) => a + s + (i < params.length ? "?" : ""), ""));
  try {
    const stmt = db.query(text);
    const returnsRows = /^\s*(select|with)/i.test(text) || /\breturning\b/i.test(text);
    const out = returnsRows ? stmt.all(...params) : (stmt.run(...params), []);
    return Promise.resolve(out);
  } catch (err) {
    // Background sweeps hit tables this fake DB does not model. A calendar_requests failure is
    // re-thrown: the handler turns it into a 500, so a broken upsert can never pass this test.
    if (/calendar_requests/i.test(text)) throw err;
    return Promise.resolve([]);
  }
}

mock.module("@neondatabase/serverless", () => ({ neon: () => sqlTag }));

let tokenA = "";
let tokenB = "";

beforeAll(async () => {
  db.run(`CREATE TABLE organizations (id TEXT PRIMARY KEY, name TEXT, email TEXT, phone TEXT,
    transfer_number TEXT, sms_enabled INTEGER DEFAULT 0, timezone TEXT)`);
  db.run(`CREATE TABLE subscriptions (id TEXT PRIMARY KEY, organization_id TEXT, plan_id TEXT, created_at TEXT)`);
  db.run(`CREATE TABLE subscription_plans (id TEXT PRIMARY KEY, display_name TEXT)`);
  db.run(`CREATE TABLE appointments (id TEXT PRIMARY KEY, organization_id TEXT)`);
  db.run(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, organization_id TEXT)`);

  db.run(`INSERT INTO organizations (id, name, email, sms_enabled, timezone) VALUES (?,?,?,?,?)`,
    ORG_A, "Ridgeline HVAC", "owner-a@example.com", 0, "America/New_York");
  db.run(`INSERT INTO organizations (id, name, email, sms_enabled, timezone) VALUES (?,?,?,?,?)`,
    ORG_B, "Blue Sky Dental", "owner-b@example.com", 0, "America/Chicago");
  db.run(`INSERT INTO users (id, email, organization_id) VALUES (?,?,?)`, USER_A, "owner-a@example.com", ORG_A);
  for (let i = 0; i < 3; i++) {
    db.run(`INSERT INTO appointments (id, organization_id) VALUES (?,?)`, `appt-a-${i}`, ORG_A);
  }

  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const mint = (organizationId: string, userId: string) =>
    new SignJWT({ organizationId, userId, role: "owner" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secret);
  tokenA = await mint(ORG_A, USER_A);
  tokenB = await mint(ORG_B, "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

  // Resend only. Everything on 127.0.0.1 goes to the real server under test.
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input?.url || "";
    if (url.includes("127.0.0.1") || url.includes("localhost")) return realFetch(input, init);
    return new Response(JSON.stringify({ id: "stub" }), { status: 200 });
  }) as any;

  process.chdir(REPO);
  await import(join(REPO, "serve.ts"));

  for (let i = 0; i < 60; i++) {
    try {
      const r = await realFetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("server did not boot");
});

async function post(body: unknown, token: string | null) {
  const r = await realFetch(`${BASE}/api/calendar-request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: (await r.json().catch(() => null)) as any };
}

async function get(token: string | null) {
  const r = await realFetch(`${BASE}/api/calendar-request`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: r.status, json: (await r.json().catch(() => null)) as any };
}

function rowCount() {
  try {
    return (db.query("SELECT COUNT(*) AS n FROM calendar_requests").get() as any).n;
  } catch {
    return 0; // the table is created by the first successful request, not before
  }
}

test("an unauthenticated request is refused", async () => {
  const r = await post({ provider: "google", note: "hi" }, null);
  expect(r.status).toBe(401);
  expect(rowCount()).toBe(0);
});

test("the first request is stored and the team is told", async () => {
  const r = await post({ provider: "google", note: "We live in Google Calendar all day." }, tokenA);
  expect(r.status).toBe(200);
  expect(r.json.ok).toBe(true);
  expect(r.json.request.provider).toBe("google");
  expect(r.json.request.note).toBe("We live in Google Calendar all day.");
  expect(r.json.request.status).toBe("requested");
  expect(rowCount()).toBe(1);
  expect(r.json.teamNotified).toBe(true);
});

test("a second request UPDATES the same row — it never duplicates", async () => {
  const before = db.query("SELECT id FROM calendar_requests WHERE provider = 'google'").get() as any;
  const r = await post({ provider: "google", note: "Actually, Outlook too — we share both." }, tokenA);
  expect(r.status).toBe(200);
  expect(r.json.request.id).toBe(before.id);
  expect(r.json.request.note).toBe("Actually, Outlook too — we share both.");
  expect(rowCount()).toBe(1);
});

test("the note is capped at 1000 characters and an unknown provider falls back to both", async () => {
  const r = await post({ provider: "yahoo", note: "x".repeat(1500) }, tokenA);
  expect(r.status).toBe(200);
  expect(r.json.request.provider).toBe("both");
  expect(r.json.request.note.length).toBe(1000);
  expect(rowCount()).toBe(2); // google + both — one row per org and provider
});

test("the endpoint is org-scoped: another business sees nothing of ours", async () => {
  const mine = await get(tokenA);
  expect(mine.status).toBe(200);
  expect(mine.json.requests.length).toBe(2);
  expect(mine.json.requests.every((r: any) => r.id)).toBe(true);

  const theirs = await get(tokenB);
  expect(theirs.status).toBe(200);
  expect(theirs.json.requests).toEqual([]);

  // And a request from org B lands as org B's row, never touching org A's.
  const bPost = await post({ provider: "outlook", note: "Our front desk runs Outlook." }, tokenB);
  expect(bPost.status).toBe(200);
  const bRows = db.query("SELECT organization_id FROM calendar_requests WHERE provider = 'outlook'").all() as any[];
  expect(bRows.length).toBe(1);
  expect(bRows[0].organization_id).toBe(ORG_B);
  expect((await get(tokenA)).json.requests.length).toBe(2);
});

test("both serve.ts trees carry the identical handler, and the migration is idempotent", async () => {
  const root = await Bun.file(`${REPO}/serve.ts`).text();
  const site = await Bun.file(`${REPO}/site/serve.ts`).text();
  const marker = 'if (pathname === "/api/calendar-request" && req.method === "POST") {';
  const end = 'if (pathname === "/api/support/tickets" && req.method === "POST") {';
  const grab = (src: string) => {
    const a = src.indexOf(marker);
    const b = src.indexOf(end, a);
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
    return src.slice(a, b);
  };
  const rootBlock = grab(root);
  expect(grab(site)).toBe(rootBlock);
  // Authenticated before any DB connection is opened, and org-scoped in both statements.
  expect(rootBlock.indexOf("requireOrgAuth")).toBeLessThan(rootBlock.indexOf("DATABASE_URL"));
  expect(rootBlock).toContain("ON CONFLICT (organization_id, provider) DO UPDATE");
  expect(rootBlock).toContain("WHERE organization_id = ${organizationId}");
  // Never an install link, never a promise that sync exists.
  expect(/connect\.google|oauth|accounts\.google/i.test(rootBlock)).toBe(false);

  const migration = await Bun.file(`${REPO}/backend/db/migrations/0016_calendar_requests.sql`).text();
  expect(migration).toContain("CREATE TABLE IF NOT EXISTS calendar_requests");
  expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS calendar_requests_org_provider_idx");
  expect(migration).toContain("organization_id uuid NOT NULL");
  expect(migration).toContain("provider text NOT NULL DEFAULT 'both'");
  expect(migration).toContain("status text NOT NULL DEFAULT 'requested'");
});

test("the Settings page shows the recommendation and no install link, in both trees", async () => {
  const rootPage = await Bun.file(`${REPO}/src/routes/dashboard/settings.tsx`).text();
  const sitePage = await Bun.file(`${REPO}/site/src/routes/dashboard/settings.tsx`).text();
  for (const [label, page] of [["src", rootPage], ["site/src", sitePage]] as const) {
    expect({ label, has: page.includes("<CalendarSection />") }).toEqual({ label, has: true });
    expect({ label, recommended: page.includes("Recommended") }).toEqual({ label, recommended: true });
    expect({ label, inUse: page.includes("In use") }).toEqual({ label, inUse: true });
    expect({ label, notYet: page.includes("Not connected yet") }).toEqual({ label, notYet: true });
    expect({ label, request: page.includes("Request a connection") }).toEqual({ label, request: true });
    // The spec's copy, verbatim: the recommendation and the honest "not yet" line.
    expect({
      label,
      recommend: page.includes("We recommend keeping it."),
      notYetCopy: page.includes(
        "Two-way sync with Google Calendar and Outlook is not available to install yourself yet.",
      ),
      update: page.includes("Update my request"),
      placeholder: page.includes("Anything we should know? Optional"),
    }).toEqual({ label, recommend: true, notYetCopy: true, update: true, placeholder: true });
    // No button or link that implies a working Google/Outlook install.
    expect({ label, connectBtn: /Connect Google|Sign in with Google/.test(page) }).toEqual({
      label,
      connectBtn: false,
    });
    // No OAuth URL, no connect/disconnect call: the page cannot imply an install that exists.
    expect({
      label,
      oauth: /accounts\.google|login\.microsoftonline|\/api\/calendar\/(connect|disconnect)/i.test(page),
    }).toEqual({ label, oauth: false });
  }
});

// A manual curl proof against this very server: HOLD=1 bun test scripts/calendar-request.test.ts
test("hold the server open for a manual curl", async () => {
  if (!process.env.HOLD) return;
  const seconds = Number(process.env.HOLD) || 60;
  console.log(`\nServer is up at ${BASE} for ${seconds}s — token for org A printed below.\n`);
  console.log(`Authorization: Bearer ${tokenA}\n`);
  await new Promise((r) => setTimeout(r, seconds * 1000));
}, 300_000);
