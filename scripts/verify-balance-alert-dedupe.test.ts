/**
 * The balance watchdog must not email the owner the same number over and over.
 *
 * Why this exists: between 2026-11-04 03:00 and 2026-11-07 15:00 the owner received 14
 * identical emails — "ReceptionAI: Telnyx balance CRITICAL $14.19 - calls stop at $0" —
 * one every ~6.5 hours, because the watchdog throttled by LEVEL only and never compared
 * the amount it had already reported. The owner complained directly.
 *
 * The rule under test (owner-approved, 2026-11-07):
 *   1. fire once on entering a level (warn <$50, urgent <$20, critical <$5, empty ≤$0);
 *   2. then stay silent for the same figure — a re-alert needs the balance to have fallen
 *      ≥$5 since the last alert AND ≥6h since it;
 *   3. always fire once when crossing into a more severe level, whatever the cooldown;
 *   4. a material rise (top-up) clears the fired state, so the next decline alerts once;
 *   5. a DB outage must not fail open into a flood — the in-memory mirror still suppresses.
 *
 * This runs the REAL serve.ts (see the `receptionai-serve-in-bun-test` skill) with only the
 * outside world replaced: Postgres → bun:sqlite, Telnyx/Resend → a stub fetch, Date.now →
 * a clock the test moves. So the request hook, the decision, the persistence and the email
 * path are all the production ones; no real email, text or API call leaves this process.
 *
 *   bun test scripts/verify-balance-alert-dedupe.test.ts
 */
import { test, expect, mock, beforeAll } from "bun:test";
import { Database } from "bun:sqlite";
import { join, resolve } from "node:path";

const PORT = 3213;
const BASE = `http://127.0.0.1:${PORT}`;
// Test the tree this file lives in (a clone, a CI checkout, whatever) — not a fixed path.
const REPO = process.env.RECEPTIONAI_REPO ? resolve(process.env.RECEPTIONAI_REPO) : join(import.meta.dir, "..");

// ── Fake Postgres (SQLite): real SQL, real PRIMARY KEY / ON CONFLICT ─────────
const db = new Database(":memory:");
let alertStateOutage = false; // simulate the DB being unreachable for the alert-state table
function sqlTag(strings: TemplateStringsArray, ...params: any[]) {
  const text = strings.reduce((acc, s, i) => acc + s + (i < params.length ? "?" : ""), "");
  try {
    if (alertStateOutage && /^\s*select/i.test(text) && text.includes("system_alert_state")) {
      throw new Error("connection terminated (simulated outage)");
    }
    const stmt = db.query(text);
    if (/^\s*select/i.test(text)) return Promise.resolve(stmt.all(...params));
    stmt.run(...params);
    return Promise.resolve([]);
  } catch (err) {
    return Promise.reject(err);
  }
}
mock.module("@neondatabase/serverless", () => ({ neon: () => sqlTag }));

// ── Fake Telnyx / Resend ─────────────────────────────────────────────────────
const telnyx = { balance: "60.00" as string | null, currency: "USD", sms: [] as { text: string }[] };
const resend = { emails: [] as { to: string; subject: string; body: string }[] };
const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : (input?.url ?? String(input));
  if (url.includes("api.telnyx.com/v2/balance")) {
    return new Response(
      JSON.stringify({ data: { balance: telnyx.balance, available_credit: telnyx.balance, currency: telnyx.currency } }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  if (url.includes("api.telnyx.com/v2/messages")) {
    telnyx.sms.push({ text: JSON.parse(init?.body || "{}").text });
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

// ── Fake clock ───────────────────────────────────────────────────────────────
const realNow = Date.now.bind(Date);
let clockOffsetMs = 0;
Date.now = () => realNow() + clockOffsetMs;
const HOUR = 60 * 60 * 1000;
const advance = (ms: number) => { clockOffsetMs += ms; };

const ALERT_EMAIL = "alerts@example.test"; // throwaway; the owner's address is never in source

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

/** One watchdog check: an hourly /api/health request (the hook runs the check). */
async function check(balance: string) {
  telnyx.balance = balance;
  const res = await realFetch(`${BASE}/api/health`);
  expect(res.status).toBe(200);
  return (await res.json()) as any;
}
const alertStateRows = () => db.query("SELECT alert_key, last_fired_at_ms, last_value FROM system_alert_state").all() as any[];

// ── (a) the flood: one figure, four checks, 24 hours, ONE email ─────────────
test("(a) four checks at $14.19 over 24h send exactly one email", async () => {
  resend.emails.length = 0;
  advance(HOUR);
  await check("14.19");
  expect(resend.emails.length).toBe(1);
  expect(resend.emails[0].subject).toContain("CRITICAL $14.19");

  // …and it really is silent for the same figure, even though 6h (the old cooldown) passes.
  for (let i = 0; i < 3; i++) {
    advance(6 * HOUR);
    const body = await check("14.19");
    expect(body.telnyxBalance).toBe(14.19);
    expect(resend.emails.length).toBe(1);
  }
  // The amount it told him about is persisted, which is what the next decision compares to.
  const row = alertStateRows().find((r) => r.alert_key === "telnyx_balance.urgent");
  expect(row?.last_value).toBe("14.19");
});

// ── (b) a real decline: ≥$5 lower AND ≥6h later → one more email ────────────
test("(b) a drop to $9.19 six hours later sends a second email", async () => {
  advance(6 * HOUR);
  await check("9.19");
  expect(resend.emails.length).toBe(2);
  expect(resend.emails[1].subject).toContain("CRITICAL $9.19");
});

// ── (c) the "calls are about to stop" crossing ignores the cooldown ────────
test("(c) a drop to $4.00 alerts immediately, inside the 6h window", async () => {
  advance(HOUR); // only 1h since the $9.19 alert — the old rule would have stayed silent
  await check("4.00");
  expect(resend.emails.length).toBe(3);
  expect(resend.emails[2].subject).toContain("ALMOST EMPTY $4.00");
  // …but still never twice for the same figure.
  advance(HOUR);
  await check("4.00");
  expect(resend.emails.length).toBe(3);
});

// ── (d) top-up clears the state; the next decline alerts exactly once ──────
test("(d) a top-up clears the fired state and the next decline alerts once", async () => {
  advance(HOUR);
  await check("40.00"); // a real top-up: no alert, and the fired state is forgotten
  expect(resend.emails.length).toBe(3);
  expect(alertStateRows().length).toBe(0);

  // The next decline re-enters at its first threshold and says so once…
  advance(HOUR);
  await check("40.00");
  expect(resend.emails.length).toBe(4);
  expect(resend.emails[3].subject).toContain("low $40.00");

  // …and not again for the same figure.
  advance(HOUR);
  await check("40.00");
  expect(resend.emails.length).toBe(4);

  // A further ≥$5 decline after 6h is a real change: one more email, once.
  advance(6 * HOUR);
  await check("34.00");
  expect(resend.emails.length).toBe(5);
  expect(resend.emails[4].subject).toContain("low $34.00");
  advance(HOUR);
  await check("34.00");
  expect(resend.emails.length).toBe(5);
});

// ── (e) a DB outage must not fail open into a flood ────────────────────────
test("(e) with the alert-state table unreachable, repeats are still suppressed", async () => {
  const before = resend.emails.length;
  alertStateOutage = true;
  try {
    advance(HOUR);
    await check("34.00"); // state unknown → the in-memory mirror still knows about $34.00
    expect(resend.emails.length).toBe(before);
    advance(6 * HOUR);
    await check("34.00");
    expect(resend.emails.length).toBe(before);
  } finally {
    alertStateOutage = false;
  }
});

// ── the "calls have stopped" step ──────────────────────────────────────────
test("empty (≤$0) fires once, and the email leads while texting stays off", async () => {
  const before = resend.emails.length;
  advance(HOUR);
  await check("0.00");
  expect(resend.emails.length).toBe(before + 1);
  expect(resend.emails[before].to).toBe(ALERT_EMAIL);
  expect(resend.emails[before].subject).toContain("EMPTY $0.00");
  expect(resend.emails[before].body).toContain("portal.telnyx.com");
  expect(telnyx.sms.length).toBe(0); // no business has texting switched on

  advance(HOUR);
  await check("0.00");
  expect(resend.emails.length).toBe(before + 1); // the same $0.00 is never re-sent
});
