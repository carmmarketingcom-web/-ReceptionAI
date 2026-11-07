/**
 * Telnyx prepaid balance watchdog — verification.
 *
 * Run:  cd /tmp/receptionai-live && bun test scripts/verify-balance-watchdog.test.ts
 *
 * This runs the REAL production server (`serve.ts`) with only the outside world
 * replaced, so the request hook, /api/health and the alert path are exercised
 * exactly as they are in production:
 *
 *   • @neondatabase/serverless → tagged-template SQL run against bun:sqlite
 *     (real SQL, real PRIMARY KEY / ON CONFLICT, real rows), so nothing touches
 *     the production database — and the persisted-alert guard is really tested;
 *   • globalThis.fetch → answers only the two Telnyx endpoints the watchdog uses
 *     (GET /v2/balance, POST /v2/messages), records every SMS that WOULD be sent,
 *     and can be switched to fail on demand. Every other outbound call gets a
 *     benign 200 so no real vendor is ever reached;
 *   • Date.now is shifted by the test to walk past the 24h/6h cooldowns.
 *
 * SUPPORT_ALERT_TO/FROM are throwaway values — the real owner number is never
 * in the repo and no real SMS can leave this process.
 */
import { test, expect, mock, beforeAll } from "bun:test";
import { Database } from "bun:sqlite";
import { join, resolve } from "node:path";

const PORT = 3211;
const BASE = `http://127.0.0.1:${PORT}`;
// Test the tree this file lives in (a clone, a CI checkout, whatever) — not a fixed path.
const REPO = process.env.RECEPTIONAI_REPO ? resolve(process.env.RECEPTIONAI_REPO) : join(import.meta.dir, "..");

// ── Fake Postgres (SQLite) ───────────────────────────────────────────────────
const db = new Database(":memory:");
function sqlTag(strings: TemplateStringsArray, ...params: any[]) {
  const text = strings.reduce((acc, s, i) => acc + s + (i < params.length ? "?" : ""), "");
  try {
    const stmt = db.query(text);
    if (/^\s*select/i.test(text)) return Promise.resolve(stmt.all(...params));
    stmt.run(...params);
    return Promise.resolve([]);
  } catch (err) {
    return Promise.reject(err);
  }
}
mock.module("@neondatabase/serverless", () => ({ neon: () => sqlTag }));

// ── Fake Telnyx ──────────────────────────────────────────────────────────────
const telnyx = {
  balance: "42.10" as string | null, // null → answer HTTP 500
  currency: "USD",
  fail: false,
  sms: [] as { to: string; from: string; text: string }[],
  balanceCalls: 0,
};
const resend = { emails: [] as { to: string; subject: string; body: string }[] };
const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : (input?.url ?? String(input));
  if (url.includes("api.telnyx.com/v2/balance")) {
    telnyx.balanceCalls++;
    if (telnyx.fail) return new Response(JSON.stringify({ errors: [{ detail: "boom" }] }), { status: 500 });
    return new Response(
      JSON.stringify({ data: { balance: telnyx.balance, available_credit: telnyx.balance, currency: telnyx.currency } }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  if (url.includes("api.telnyx.com/v2/messages")) {
    const body = JSON.parse(init?.body || "{}");
    telnyx.sms.push({ to: body.to, from: body.from, text: body.text });
    return new Response(JSON.stringify({ data: { id: "msg_fake" } }), { status: 200 });
  }
  if (url.includes("api.resend.com/emails")) {
    const body = JSON.parse(init?.body || "{}");
    resend.emails.push({ to: body.to, subject: body.subject, body: body.text });
    return new Response(JSON.stringify({ id: "email_fake" }), { status: 200 });
  }
  if (url.includes("127.0.0.1") || url.includes("localhost")) return realFetch(input, init);
  return new Response(JSON.stringify({ ok: true }), { status: 200 }); // no real vendor is reached
}) as any;

// ── Time travel ──────────────────────────────────────────────────────────────
const realNow = Date.now.bind(Date);
let clockOffsetMs = 0;
Date.now = () => realNow() + clockOffsetMs;
const advance = (ms: number) => { clockOffsetMs += ms; };
const HOUR = 60 * 60 * 1000;
// Throwaway alert address: the watchdog emails first, and the real owner address is never
// in the repo.
const ALERT_EMAIL = "alerts@example.test";

// ── Boot the real server ─────────────────────────────────────────────────────
beforeAll(async () => {
  process.env.PORT = String(PORT);
  process.env.JWT_SECRET = "test-only-jwt-secret-that-is-long-enough-32";
  process.env.DATABASE_URL = "postgres://fake@localhost/fake";
  process.env.TELNYX_API_KEY = "KEY_test";
  process.env.SUPPORT_ALERT_TO = "+15550000001";
  process.env.SUPPORT_ALERT_FROM = "+15550000002";
  process.env.RESEND_API_KEY = "re_test_only";
  process.env.SUPPORT_ALERT_EMAIL = ALERT_EMAIL;
  process.env.CRON_SECRET = "test-cron";
  process.chdir(REPO);
  await import("../serve.ts");
  // wait for the listener
  for (let i = 0; i < 60; i++) {
    try {
      await realFetch(`${BASE}/api/health`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error("server never came up");
});

const health = async () => {
  const res = await realFetch(`${BASE}/api/health`);
  return { status: res.status, body: (await res.json()) as any };
};

test("warn below $50 → one EMAIL, no text, and the balance is readable from /api/health", async () => {
  telnyx.balance = "42.10";
  // The warm-up health call in beforeAll already ran the watchdog once; that alert is the
  // one this test counts (the array is not reset here on purpose).
  const { status, body } = await health();
  expect(status).toBe(200);
  expect(body.telnyxBalance).toBe(42.1);
  expect(body.telnyxBalanceStatus).toBe("low");
  expect(body.telnyxBalanceCurrency).toBe("USD");
  expect(typeof body.telnyxBalanceCheckedAt).toBe("string");
  // The alarm that protects live calls now travels on the channel that actually delivers.
  expect(resend.emails.length).toBe(1);
  expect(resend.emails[0].to).toBe(ALERT_EMAIL);
  expect(resend.emails[0].subject).toContain("Telnyx balance low $42.10");
  expect(resend.emails[0].body).toContain("portal.telnyx.com");
  // Texting is off by default, so the secondary channel stayed silent.
  expect(telnyx.sms.length).toBe(0);
});

test("second check 2h later (new hour, still inside 24h) sends nothing", async () => {
  advance(2 * HOUR);
  const callsBefore = telnyx.balanceCalls;
  const { status, body } = await health();
  expect(status).toBe(200);
  expect(body.telnyxBalance).toBe(42.1);
  expect(telnyx.balanceCalls).toBe(callsBefore + 1); // it really re-asked Telnyx…
  expect(resend.emails.length).toBe(1); // …and still did not alert twice
});

test("the fired timestamp is persisted in system_alert_state (survives a restart)", async () => {
  const row = db.query("SELECT last_fired_at_ms, last_level, last_value FROM system_alert_state WHERE alert_key='telnyx_balance.warn'").get() as any;
  expect(row).toBeTruthy();
  expect(row.last_level).toBe("warn");
  expect(row.last_value).toBe("42.10");
  expect(Number(row.last_fired_at_ms)).toBeGreaterThan(0);
});

test("after 24h the SAME $42.10 still sends nothing — the amount, not the clock, decides", async () => {
  // This is the rule that killed the 14 identical "CRITICAL $14.19" emails: a cooldown alone
  // used to be enough to re-send the same figure every 6h, forever.
  advance(23 * HOUR); // ~25h since the first warn
  const { body } = await health();
  expect(body.telnyxBalanceStatus).toBe("low");
  expect(resend.emails.length).toBe(1);
});

test("below $20 escalates to urgent at once, whatever the clock says", async () => {
  telnyx.balance = "17.68";
  advance(HOUR);
  const { body } = await health();
  expect(body.telnyxBalance).toBe(17.68);
  expect(body.telnyxBalanceStatus).toBe("urgent");
  // Crossing into a more severe level is the "calls stop at $0" moment: it fires immediately.
  expect(resend.emails.length).toBe(2);
  expect(resend.emails[1].subject).toContain("CRITICAL $17.68");
});

test("a Telnyx API error is swallowed: health still 200, no SMS, no throw", async () => {
  telnyx.fail = true;
  advance(HOUR);
  const { status, body } = await health();
  expect(status).toBe(200);
  expect(body.status).toBe("ok");
  expect(body.telnyxBalance).toBeNull();
  expect(body.telnyxBalanceStatus).toBe("unknown");
  expect(body.telnyxBalanceError).toContain("500");
  expect(resend.emails.length).toBe(2); // nothing new was sent
});

test("the server keeps serving after the API failure (a call flow is never broken)", async () => {
  telnyx.fail = false;
  advance(HOUR);
  const { status, body } = await health();
  expect(status).toBe(200);
  expect(body.telnyxBalance).toBe(17.68);
});

test("recovering above $50 clears the state so the next drop alerts immediately", async () => {
  telnyx.balance = "80.00";
  advance(HOUR);
  let r = await health();
  expect(r.body.telnyxBalanceStatus).toBe("ok");
  const rows = db.query("SELECT * FROM system_alert_state").all();
  expect(rows.length).toBe(0);

  telnyx.balance = "30.00"; // a fresh drop, well inside the old 24h window
  advance(HOUR);
  r = await health();
  expect(r.body.telnyxBalanceStatus).toBe("low");
  expect(resend.emails.length).toBe(3);
  expect(resend.emails[2].subject).toContain("$30.00");
});

// ── The text is a SECONDARY channel, and only for a business that opted in ──
test("with texting on for the platform line, the same alert also texts from the shared sender", async () => {
  db.run(`CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY, name TEXT, email TEXT, sms_enabled INTEGER DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS phone_numbers (
    id TEXT PRIMARY KEY, organization_id TEXT, phone_number TEXT, is_active INTEGER DEFAULT 1
  )`);
  db.run(`INSERT OR REPLACE INTO organizations VALUES ('org-platform', 'Carm Marketing', NULL, 1)`);
  db.run(`INSERT OR REPLACE INTO phone_numbers VALUES ('pn-platform', 'org-platform', '+15550000002', 1)`);

  telnyx.balance = "11.00"; // a fresh drop, past both cooldowns
  advance(7 * HOUR);
  resend.emails.length = 0;
  telnyx.sms.length = 0;

  const { body } = await health();
  expect(body.telnyxBalanceStatus).toBe("urgent");
  expect(resend.emails.length).toBe(1);   // email still leads
  expect(telnyx.sms.length).toBe(1);      // the text follows, because sms_enabled is on
  expect(telnyx.sms[0].from).toBe("+18339261247"); // the shared toll-free line
  expect(telnyx.sms[0].to).toBe("+15550000001");
  expect(telnyx.sms[0].text).toContain("CRITICAL");
});
