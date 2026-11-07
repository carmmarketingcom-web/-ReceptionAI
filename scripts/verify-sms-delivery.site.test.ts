/**
 * Outbound SMS delivery tracking — verification, site/ tree.
 *
 * serve.ts (production, repo root) and site/serve.ts (cto.new) are hand-synced
 * copies. This file is the same proof run against the site/ copy, so a change
 * that only landed in one tree cannot pass unnoticed.
 *
 * Run:  cd /tmp/receptionai-live && bun test scripts/verify-sms-delivery.site.test.ts
 *
 * Background: sendSms() used to be fire-and-forget. It awaited the Telnyx POST,
 * threw the response away and logged "Sent" whatever came back. Every outbound SMS
 * failed for a week (36 sent, 36 failed, 0 delivered — Telnyx error 40010, "the
 * sending number is not 10DLC-registered") and nothing recorded it.
 *
 * This boots the REAL production server (`serve.ts`) with only the outside world
 * replaced:
 *
 *   • @neondatabase/serverless → tagged-template SQL against bun:sqlite (real SQL,
 *     real UNIQUE / ON CONFLICT), so no production row is touched;
 *   • globalThis.fetch → answers the three vendor endpoints this feature uses
 *     (Telnyx balance + messages, Resend email) and can reject the SMS POST on
 *     demand. Everything else gets a benign 200, so no real vendor is reached;
 *   • Date.now is shifted to walk past the hourly alert cooldown and the 24h
 *     balance-watchdog cooldown.
 *
 * SUPPORT_ALERT_TO/FROM are throwaway values and SMS_FAILURE_ALERT_EMAIL is unset
 * on purpose: the alert must find the owner's address in `organizations`.
 */
import { test, expect, mock, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { join, resolve } from "node:path";

const PORT = 3213;
const BASE = `http://127.0.0.1:${PORT}`;
// Test the tree this file lives in (a clone, a CI checkout, whatever) - not a fixed path.
const REPO = process.env.RECEPTIONAI_REPO ? join(resolve(process.env.RECEPTIONAI_REPO), "site") : join(import.meta.dir, "..", "site");

// ── Fake Postgres (SQLite) ───────────────────────────────────────────────────
const db = new Database(":memory:");
db.run(`CREATE TABLE organizations (
  id TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT, created_at TEXT,
  sms_enabled INTEGER DEFAULT 0
)`);
// The platform line's business opted into texting, so the balance watchdog's SECONDARY
// channel (a text) is exercised here too. Email still leads; the text only follows when
// organizations.sms_enabled is on.
db.run(`CREATE TABLE phone_numbers (
  id TEXT PRIMARY KEY, organization_id TEXT, phone_number TEXT, is_active INTEGER DEFAULT 1
)`);
db.run(`INSERT INTO phone_numbers VALUES ('pn-platform', 'org-1', '+15550000002', 1)`);
db.run(`INSERT INTO organizations (id, name, phone, email, created_at, sms_enabled)
        VALUES ('org-1', 'Carm Marketing', '+15550000009', 'owner@example.test', '2026-01-01T00:00:00Z', 1)`);

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
// site/ has its own node_modules, so its copy of the driver is a DIFFERENT module
// instance — without this second mock the site server really dials the database.
mock.module(join(REPO, "node_modules/@neondatabase/serverless/index.mjs"), () => ({ neon: () => sqlTag }));

// ── Fake vendors ─────────────────────────────────────────────────────────────
const telnyx = {
  balance: "80.00" as string | null,
  currency: "USD",
  postStatus: 200,          // status for POST /v2/messages
  postBody: "",             // body returned with a non-2xx
  sms: [] as { to: string; from: string; text: string }[],
  seq: 0,
};
const resend = { emails: [] as { to: string; subject: string; body: string }[], fail: false };

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
    const body = JSON.parse(init?.body || "{}");
    telnyx.sms.push({ to: body.to, from: body.from, text: body.text });
    if (telnyx.postStatus !== 200) {
      return new Response(telnyx.postBody || JSON.stringify({
        errors: [{ code: "40010", title: "Forbidden", detail: "The sending number is not 10DLC-registered." }],
      }), { status: telnyx.postStatus, headers: { "Content-Type": "application/json" } });
    }
    telnyx.seq++;
    return new Response(JSON.stringify({ data: { id: `msg_fake_${telnyx.seq}` } }), { status: 200 });
  }

  if (url.includes("api.resend.com/emails")) {
    const body = JSON.parse(init?.body || "{}");
    resend.emails.push({ to: body.to, subject: body.subject, body: body.text });
    if (resend.fail) return new Response(JSON.stringify({ message: "domain not verified" }), { status: 403 });
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
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// ── Boot the real server ─────────────────────────────────────────────────────
beforeAll(async () => {
  process.env.PORT = String(PORT);
  process.env.JWT_SECRET = "test-only-jwt-secret-that-is-long-enough-32";
  process.env.DATABASE_URL = "postgres://fake@localhost/fake";
  process.env.TELNYX_API_KEY = "KEY_test";
  process.env.SUPPORT_ALERT_TO = "+15550000001";
  process.env.SUPPORT_ALERT_FROM = "+15550000002";
  process.env.CRON_SECRET = "test-cron";
  process.env.RESEND_API_KEY = "re_test_key"; // sendEmail() is stubbed at the fetch layer
  delete process.env.SMS_FAILURE_ALERT_EMAIL; // prove the organizations lookup works
  process.chdir(REPO);
  await import("../site/serve.ts");
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

// Bun runs the test files of one invocation in the same process: hand the real
// clock and the real fetch back, or every later file inherits the shifted clock.
afterAll(() => {
  Date.now = realNow;
  globalThis.fetch = realFetch;
});

const health = async () => {
  const res = await realFetch(`${BASE}/api/health`);
  return { status: res.status, body: (await res.json()) as any };
};

const postWebhook = async (eventType: string, payload: any) => {
  const res = await realFetch(`${BASE}/api/telnyx/sms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: { event_type: eventType, id: "evt_1", payload } }),
  });
  return { status: res.status, body: (await res.json()) as any };
};

const rows = () => db.query("SELECT * FROM sms_deliveries ORDER BY created_at_ms ASC, rowid ASC").all() as any[];

const waitFor = async (fn: () => boolean, ms = 2000) => {
  const started = realNow();
  while (realNow() - started < ms) {
    if (fn()) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return fn();
};

// ── 1. A 2xx POST is recorded as `queued` with the Telnyx message id ─────────
test("a 2xx send writes a queued row carrying the Telnyx message id", async () => {
  // The boot health poll already consumed the watchdog's one-call-per-hour slot.
  advance(2 * HOUR);
  telnyx.balance = "42.10"; // low enough for the watchdog to text the owner
  const { status } = await health();
  expect(status).toBe(200);

  expect(telnyx.sms.length).toBe(1);
  const row = rows()[0];
  expect(row).toBeTruthy();
  expect(row.telnyx_message_id).toBe("msg_fake_1");
  expect(row.status).toBe("queued");
  expect(row.kind).toBe("owner_alert");
  expect(row.to_number).toBe("+15550000001");
  expect(Number(row.parts)).toBeGreaterThanOrEqual(1);
  expect(row.error_code).toBeNull();
  expect(resend.emails.length).toBe(1); // the watchdog's own alert email (it is the first send)
});

// ── 2. A failed delivery report flips the row and mails the owner once ──────
test("message.finalized failed flips the row to failed and emails the owner once", async () => {
  const { status, body } = await postWebhook("message.finalized", {
    id: "msg_fake_1",
    direction: "outbound",
    to: [{ phone_number: "+15550000001", status: "delivery_failed" }],
    errors: [{ code: "40010", title: "Not 10DLC registered", detail: "The sending number is not 10DLC-registered but is required to be by the carrier." }],
  });
  expect(status).toBe(200);
  expect(body.delivery).toBe("failed");

  const row = db.query("SELECT * FROM sms_deliveries WHERE telnyx_message_id='msg_fake_1'").get() as any;
  expect(row.status).toBe("failed");
  expect(row.error_code).toBe("40010");

  expect(resend.emails.length).toBe(2);
  const email = resend.emails[1];
  expect(email.to).toBe("owner@example.test");       // found via organizations, not env
  expect(email.subject).toContain("1 text message");
  expect(email.body).toContain("40010");
  // The plain-English line the owner needs, in full.
  expect(email.body).toContain("The sending number is not 10DLC-registered, carriers are blocking it; register the brand/campaign in Telnyx.");
  expect(email.body).toContain("Nothing else is affected");

  const state = db.query("SELECT * FROM system_alert_state WHERE alert_key='sms_delivery.failed'").get() as any;
  expect(state).toBeTruthy();
  expect(Number(state.last_fired_at_ms)).toBeGreaterThan(0);
});

// ── 3. A second failure inside the hour stays quiet ─────────────────────────
test("a second failure inside the hour does not re-send the email", async () => {
  db.run(`INSERT INTO sms_deliveries
    (id, telnyx_message_id, to_number, kind, parts, status, error_code, created_at_ms, updated_at_ms)
    VALUES ('row-2', 'msg_fake_2', '+15550000003', 'confirmation', 2, 'queued', NULL, ?, ?)`,
    [Date.now(), Date.now()]);

  advance(10 * MINUTE);
  const { status, body } = await postWebhook("message.finalized", {
    id: "msg_fake_2",
    direction: "outbound",
    to: [{ phone_number: "+15550000003", status: "delivery_failed" }],
    errors: [{ code: "40010", detail: "Not 10DLC registered" }],
  });
  expect(status).toBe(200);
  expect(body.delivery).toBe("failed");

  const row = db.query("SELECT * FROM sms_deliveries WHERE telnyx_message_id='msg_fake_2'").get() as any;
  expect(row.status).toBe("failed");
  expect(row.error_code).toBe("40010");
  expect(resend.emails.length).toBe(2); // still exactly one failure email
});

// ── 4. A rejected POST is logged, recorded, and never throws ────────────────
test("a 4xx POST records the failure and never throws into the caller", async () => {
  advance(25 * HOUR); // past the hourly email window and the watchdog's 6h re-alert cooldown
  // The watchdog only re-alerts on a REAL fall (>= $5 lower than the last alert): re-sending an
  // unchanged figure every cooldown is the flood the owner complained about on 2026-11-07.
  telnyx.balance = "36.00"; // $6.10 below the $42.10 it already reported

  // Two more failures already inside the alert window → the email must aggregate.
  const t = Date.now() - 5 * MINUTE;
  db.run(`INSERT INTO sms_deliveries (id, telnyx_message_id, to_number, kind, parts, status, error_code, created_at_ms, updated_at_ms)
          VALUES ('row-3', 'msg_fake_3', '+15550000004', 'summary', 2, 'failed', '40010', ?, ?)`, [t, t]);
  db.run(`INSERT INTO sms_deliveries (id, telnyx_message_id, to_number, kind, parts, status, error_code, created_at_ms, updated_at_ms)
          VALUES ('row-4', 'msg_fake_4', '+15550000005', 'reminder', 1, 'failed', '40010', ?, ?)`, [t, t]);
  // …and one queued message we will deliver successfully in step 5.
  db.run(`INSERT INTO sms_deliveries (id, telnyx_message_id, to_number, kind, parts, status, error_code, created_at_ms, updated_at_ms)
          VALUES ('row-5', 'msg_delivered_1', '+15550000006', 'confirmation', 2, 'queued', NULL, ?, ?)`, [t, t]);

  telnyx.postStatus = 422; // Telnyx's real answer for 40010
  const { status, body } = await health(); // the watchdog tries to text the owner again
  expect(status).toBe(200);                 // the server survived a rejected SMS
  expect(body.status).toBe("ok");
  expect(telnyx.sms.length).toBe(2);        // it really tried

  const rejected = rows().filter((r) => r.telnyx_message_id === null);
  expect(rejected.length).toBe(1);
  expect(rejected[0].status).toBe("failed");
  expect(rejected[0].error_code).toBe("40010");
  expect(rejected[0].kind).toBe("owner_alert");

  expect(await waitFor(() => resend.emails.length === 4)).toBe(true);
  const email = resend.emails[3];
  expect(email.subject).toContain("3 text messages"); // aggregated, not one email per failure
  expect(email.body).toContain("40010");
  expect(email.body).toContain("3 messages");
});

// ── 5. A delivered report is recorded too ───────────────────────────────────
test("message.finalized delivered marks the row delivered", async () => {
  const { status, body } = await postWebhook("message.finalized", {
    id: "msg_delivered_1",
    direction: "outbound",
    to: [{ phone_number: "+15550000006", status: "delivered" }],
    errors: [],
  });
  expect(status).toBe(200);
  expect(body.delivery).toBe("delivered");
  const row = db.query("SELECT * FROM sms_deliveries WHERE telnyx_message_id='msg_delivered_1'").get() as any;
  expect(row.status).toBe("delivered");
  expect(row.error_code).toBeNull();
});

// ── 6. /api/health surfaces the whole picture ───────────────────────────────
test("/api/health reports smsDelivery counts and the last error code", async () => {
  telnyx.postStatus = 200;
  const { status, body } = await health();
  expect(status).toBe(200);
  const s = body.smsDelivery;
  expect(s).toBeTruthy();
  expect(s.failed24h).toBe(3);      // two inserted + the rejected POST
  expect(s.delivered24h).toBe(1);
  expect(s.sent24h).toBe(4);        // everything created inside the last 24h
  expect(s.lastErrorCode).toBe("40010");
  expect(typeof s.lastErrorAt).toBe("string");
  expect(new Date(s.lastErrorAt).getTime()).toBeGreaterThan(0);
});

// ── 7. Inbound messages still work on the same webhook ─────────────────────
test("an inbound message.received event is still handled as a chat reply", async () => {
  const { status, body } = await postWebhook("message.received", {
    id: "inbound-1",
    direction: "inbound",
    from: { phone_number: "+15550000007" },
    to: [{ phone_number: "+15550000008" }],
    text: "Do you have any openings this week?",
  });
  expect(status).toBe(200);
  expect(body.status).toBe("replied");
});
