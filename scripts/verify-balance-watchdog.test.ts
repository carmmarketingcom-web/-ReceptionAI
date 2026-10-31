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

const PORT = 3211;
const BASE = `http://127.0.0.1:${PORT}`;
const REPO = "/tmp/receptionai-live";

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
  if (url.includes("127.0.0.1") || url.includes("localhost")) return realFetch(input, init);
  return new Response(JSON.stringify({ ok: true }), { status: 200 }); // no real vendor is reached
}) as any;

// ── Time travel ──────────────────────────────────────────────────────────────
const realNow = Date.now.bind(Date);
let clockOffsetMs = 0;
Date.now = () => realNow() + clockOffsetMs;
const advance = (ms: number) => { clockOffsetMs += ms; };
const HOUR = 60 * 60 * 1000;

// ── Boot the real server ─────────────────────────────────────────────────────
beforeAll(async () => {
  process.env.PORT = String(PORT);
  process.env.JWT_SECRET = "test-only-jwt-secret-that-is-long-enough-32";
  process.env.DATABASE_URL = "postgres://fake@localhost/fake";
  process.env.TELNYX_API_KEY = "KEY_test";
  process.env.SUPPORT_ALERT_TO = "+15550000001";
  process.env.SUPPORT_ALERT_FROM = "+15550000002";
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

test("warn below $50 → one SMS, and the balance is readable from /api/health", async () => {
  telnyx.balance = "42.10";
  const { status, body } = await health();
  expect(status).toBe(200);
  expect(body.telnyxBalance).toBe(42.1);
  expect(body.telnyxBalanceStatus).toBe("low");
  expect(body.telnyxBalanceCurrency).toBe("USD");
  expect(typeof body.telnyxBalanceCheckedAt).toBe("string");
  expect(telnyx.sms.length).toBe(1);
  expect(telnyx.sms[0].text).toContain("Telnyx balance low $42.10");
  expect(telnyx.sms[0].to).toBe("+15550000001");
  expect(telnyx.sms[0].from).toBe("+15550000002");
});

test("second check 2h later (new hour, still inside 24h) sends nothing", async () => {
  advance(2 * HOUR);
  const callsBefore = telnyx.balanceCalls;
  const { status, body } = await health();
  expect(status).toBe(200);
  expect(body.telnyxBalance).toBe(42.1);
  expect(telnyx.balanceCalls).toBe(callsBefore + 1); // it really re-asked Telnyx…
  expect(telnyx.sms.length).toBe(1); // …and still did not text twice
});

test("the fired timestamp is persisted in system_alert_state (survives a restart)", async () => {
  const row = db.query("SELECT last_fired_at_ms, last_level, last_value FROM system_alert_state WHERE alert_key='telnyx_balance.warn'").get() as any;
  expect(row).toBeTruthy();
  expect(row.last_level).toBe("warn");
  expect(row.last_value).toBe("42.10");
  expect(Number(row.last_fired_at_ms)).toBeGreaterThan(0);
});

test("after 24h the same warn level may fire again", async () => {
  advance(23 * HOUR); // ~25h since the first warn
  const { body } = await health();
  expect(body.telnyxBalanceStatus).toBe("low");
  expect(telnyx.sms.length).toBe(2);
  expect(telnyx.sms[1].text).toContain("Telnyx balance low $42.10");
});

test("below $20 escalates to urgent on its own 6h cooldown", async () => {
  telnyx.balance = "17.68";
  advance(HOUR);
  const { body } = await health();
  expect(body.telnyxBalance).toBe(17.68);
  expect(body.telnyxBalanceStatus).toBe("urgent");
  expect(telnyx.sms.length).toBe(3);
  expect(telnyx.sms[2].text).toContain("TELNYX BALANCE CRITICAL $17.68");
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
  expect(telnyx.sms.length).toBe(3); // nothing new was sent
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
  expect(telnyx.sms.length).toBe(4);
  expect(telnyx.sms[3].text).toContain("$30.00");
});
