/**
 * Email is the primary notification channel; SMS is an explicit per-business opt-in.
 *
 * Run:  cd /tmp/receptionai-live && bun run test scripts/verify-email-primary.test.ts
 *       (always `bun run test` = `bun test --isolate` — two files boot serve.ts)
 *
 * Background: sendEmailNotification() did `await import("../lib/email")`, which resolves to
 * /lib/email — a path that does not exist. Every post-call summary email and every voicemail
 * email threw there and was swallowed by the catch, so the owner of a customer business was
 * never told that a call had happened. Meanwhile carriers block every text we send (Telnyx
 * 40010, sending number not 10DLC-registered): 0 of 39 messages ever delivered.
 *
 * This boots the REAL production server (`serve.ts`) with only the outside world replaced:
 *
 *   • @neondatabase/serverless → tagged-template SQL against bun:sqlite (real SQL, real
 *     UNIQUE / ON CONFLICT), with the Postgres-isms this flow uses translated, so no
 *     production row is touched;
 *   • globalThis.fetch → answers Telnyx (balance + messages) and Resend (emails) and can
 *     reject the SMS POST with the real 40010 body. No real vendor is reached;
 *   • the call itself is driven through the real /api/telnyx/voice webhook, so the whole
 *     hangup → summary → notification path runs exactly as it does in production.
 */
import { test, expect, mock, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";

const PORT = 3213;
const BASE = `http://127.0.0.1:${PORT}`;
const REPO = "/tmp/receptionai-live";
const BUSINESS_LINE = "+15550000020";
const CALLER = "+15550000077";
const OWNER_EMAIL = "owner@example.test";

// ── Fake Postgres (SQLite) ───────────────────────────────────────────────────
const db = new Database(":memory:");
db.run(`CREATE TABLE organizations (
  id TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT, sms_enabled INTEGER DEFAULT 0, created_at TEXT
)`);
db.run(`INSERT INTO organizations (id, name, phone, email, sms_enabled, created_at)
        VALUES ('org-1', 'Carm Marketing', '+15550000009', '${OWNER_EMAIL}', 0, '2026-01-01T00:00:00Z')`);
db.run(`CREATE TABLE phone_numbers (
  id TEXT PRIMARY KEY, organization_id TEXT, phone_number TEXT, is_active INTEGER DEFAULT 1
)`);
db.run(`INSERT INTO phone_numbers VALUES ('pn-1', 'org-1', '${BUSINESS_LINE}', 1)`);
db.run(`CREATE TABLE contacts (
  id TEXT PRIMARY KEY, organization_id TEXT, phone TEXT, last_contacted_at TEXT, updated_at TEXT
)`);
db.run(`CREATE TABLE conversations (
  id TEXT PRIMARY KEY, organization_id TEXT, contact_id TEXT, phone_number_id TEXT,
  type TEXT, status TEXT, direction TEXT, twilio_call_sid TEXT, started_at TEXT, ended_at TEXT,
  escalated_to_human INTEGER, escalated_at TEXT, is_demo INTEGER, metadata TEXT, created_at TEXT, updated_at TEXT
)`);
db.run(`CREATE TABLE missed_calls (
  id TEXT PRIMARY KEY, organization_id TEXT, phone_number_id TEXT, contact_id TEXT,
  caller_number TEXT, caller_name TEXT, twilio_call_sid TEXT, ring_duration_seconds INTEGER,
  callback_requested INTEGER, created_at TEXT, is_demo INTEGER
)`);
db.run(`CREATE TABLE messages (
  id TEXT PRIMARY KEY, conversation_id TEXT, organization_id TEXT, role TEXT,
  content TEXT, content_type TEXT, created_at TEXT
)`);

// Postgres → SQLite for the statements this flow runs. Everything here is a syntax
// translation only: the SQL structure, parameters and result shape are unchanged.
function translate(text: string): string {
  return text
    .replace(/::[a-z_]+(\[\])?/gi, "")
    .replace(/\bNOW\(\)/gi, "CURRENT_TIMESTAMP")
    .replace(/gen_random_uuid\(\)/gi, "'00000000-0000-4000-8000-000000000000'");
}

function sqlTag(strings: TemplateStringsArray, ...params: any[]) {
  const text = translate(strings.reduce((acc, s, i) => acc + s + (i < params.length ? "?" : ""), ""));
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

// ── Fake vendors ─────────────────────────────────────────────────────────────
const telnyx = {
  balance: "80.00" as string | null,
  postStatus: 200,
  sms: [] as { to: string; from: string; text: string }[],
  seq: 0,
};
const resend = { emails: [] as { to: string; subject: string; body: string }[], fail: false };

const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : (input?.url ?? String(input));

  if (url.includes("api.telnyx.com/v2/balance")) {
    return new Response(
      JSON.stringify({ data: { balance: telnyx.balance, available_credit: telnyx.balance, currency: "USD" } }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  if (url.includes("api.telnyx.com/v2/messages")) {
    const body = JSON.parse(init?.body || "{}");
    telnyx.sms.push({ to: body.to, from: body.from, text: body.text });
    if (telnyx.postStatus !== 200) {
      // Telnyx's real answer while the sending number is not 10DLC-registered.
      return new Response(JSON.stringify({
        errors: [{
          code: "40010",
          title: "Forbidden",
          detail: "The sending number is not 10DLC-registered but is required to be by the carrier.",
        }],
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

  if (url.includes("api.telnyx.com")) return new Response(JSON.stringify({ data: {} }), { status: 200 });
  if (url.includes("generativelanguage.googleapis.com")) {
    return new Response(JSON.stringify({ candidates: [] }), { status: 200 });
  }
  if (url.includes("127.0.0.1") || url.includes("localhost")) return realFetch(input, init);
  return new Response(JSON.stringify({ ok: true }), { status: 200 }); // no real vendor is reached
}) as any;

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
  delete process.env.SUPPORT_ALERT_EMAIL;
  delete process.env.SMS_FAILURE_ALERT_EMAIL;
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

afterAll(() => {
  try { db.close(); } catch { /* already closed */ }
});

// ── Helpers ──────────────────────────────────────────────────────────────────
async function postEvent(event_type: string, payload: Record<string, unknown>) {
  const res = await realFetch(`${BASE}/api/telnyx/voice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: { event_type, payload } }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function health() {
  const res = await realFetch(`${BASE}/api/health`);
  return { status: res.status, body: await res.json() };
}

/** Drive a whole call through the real webhook: ring, answer, hang up. */
async function runCall(id: string) {
  const cid = `v2:test-${id}-${Date.now()}`;
  const base = { call_control_id: cid, call_session_id: `sess-${cid}`, to: BUSINESS_LINE, from: CALLER };
  await postEvent("call.initiated", base);
  await new Promise((r) => setTimeout(r, 300)); // the answer + opening prompt run on a timer
  await postEvent("call.hangup", base);
}

const emailFor = (needle: string) => resend.emails.filter((e) => e.subject.includes(needle));

// ── 1. Texting OFF (the default): zero texts, one email ─────────────────────
test("a finished call with texting off sends no text at all and exactly one email", async () => {
  telnyx.sms.length = 0;
  resend.emails.length = 0;

  await runCall("off");

  // Nothing was spent on a message the carrier would throw away.
  expect(telnyx.sms.length).toBe(0);

  // The owner still learns about the call — through the channel that works.
  expect(resend.emails.length).toBe(1);
  const email = resend.emails[0];
  expect(email.to).toBe(OWNER_EMAIL);
  expect(email.subject).toContain(CALLER);          // who called
  expect(email.body).toContain(CALLER);
  expect(email.body).toContain("Outcome:");         // what happened
  expect(email.body).toContain("https://www.receptionai.store/dashboard"); // where to look

  // …and the send really reached the provider: the import path is fixed, not swallowed.
  const row = db.query("SELECT * FROM email_deliveries ORDER BY created_at_ms DESC LIMIT 1").get() as any;
  expect(row).toBeTruthy();
  expect(row.status).toBe("sent");
  expect(row.to_email).toBe(OWNER_EMAIL);
  expect(row.org_id).toBe("org-1");
});

// ── 2. Texting ON + a 40010 rejection: one attempt, one fallback email ──────
test("with texting on and a 40010 rejection, one text is attempted and the owner is still emailed", async () => {
  db.run("UPDATE organizations SET sms_enabled = 1 WHERE id = 'org-1'");
  telnyx.sms.length = 0;
  resend.emails.length = 0;
  telnyx.postStatus = 422;

  await runCall("on-fail");

  // The opt-in was honoured: exactly one attempt.
  expect(telnyx.sms.length).toBe(1);
  expect(telnyx.sms[0].to).toBe("+15550000009"); // organizations.phone, via getOwnerPhone()
  // …and it left from ReceptionAI's ONE shared toll-free line, not from the business's own
  // number (owner decision 2026-11-03). A reply reaches us, so the body must name the caller.
  expect(telnyx.sms[0].from).toBe("+18339261247");
  expect(telnyx.sms[0].text).toContain(CALLER);

  // The rejection did not silence the event: the summary email is there for this call.
  const summaries = emailFor(CALLER);
  expect(summaries.length).toBe(1);
  expect(summaries[0].body).toContain("https://www.receptionai.store/dashboard");

  // The failure itself is recorded (sms_deliveries still works) …
  const row = db.query("SELECT * FROM sms_deliveries ORDER BY created_at_ms DESC LIMIT 1").get() as any;
  expect(row.status).toBe("failed");
  expect(row.error_code).toBe("40010");
  expect(row.kind).toBe("summary");

  // … and the email record says the fallback was delivered.
  const okEmail = db.query("SELECT * FROM email_deliveries WHERE status = 'sent' ORDER BY created_at_ms DESC LIMIT 1").get() as any;
  expect(okEmail).toBeTruthy();

  telnyx.postStatus = 200;
  db.run("UPDATE organizations SET sms_enabled = 0 WHERE id = 'org-1'");
});

// ── 3. An email the provider rejects is visible, not silent ─────────────────
test("a rejected email is recorded as failed and shows up in /api/health", async () => {
  resend.emails.length = 0;
  resend.fail = true;

  await runCall("email-fail");

  const failed = db.query("SELECT * FROM email_deliveries WHERE status = 'failed' ORDER BY created_at_ms DESC LIMIT 1").get() as any;
  expect(failed).toBeTruthy();
  expect(String(failed.error)).toContain("provider rejected");

  const { status, body } = await health();
  expect(status).toBe(200);
  expect(body.email.failed24h).toBeGreaterThanOrEqual(1);
  expect(typeof body.email.lastFailureAt).toBe("string");

  resend.fail = false;
});

// ── 4. /api/health reports email next to smsDelivery ────────────────────────
test("/api/health reports the email block", async () => {
  const { status, body } = await health();
  expect(status).toBe(200);

  const e = body.email;
  expect(e).toBeTruthy();
  expect(e.provider).toBe("resend");
  expect(typeof e.sent24h).toBe("number");
  expect(typeof e.failed24h).toBe("number");
  expect(e.sent24h).toBeGreaterThanOrEqual(1);          // the sends above
  expect(typeof e.lastSuccessAt).toBe("string");        // a real timestamp
  expect(new Date(e.lastSuccessAt).getTime()).toBeGreaterThan(0);

  // The SMS block is untouched by all of this.
  expect(body.smsDelivery).toBeTruthy();
  expect(typeof body.smsDelivery.sent24h).toBe("number");
});

// ── 5. The shared sender is env-configurable, with the 833 as the constant fallback ──
test("TELNYX_SMS_SENDER overrides the shared toll-free sender", async () => {
  process.env.TELNYX_SMS_SENDER = "+15550009999";
  db.run("UPDATE organizations SET sms_enabled = 1 WHERE id = 'org-1'");
  telnyx.sms.length = 0;

  await runCall("sender-env");

  expect(telnyx.sms.length).toBe(1);
  expect(telnyx.sms[0].from).toBe("+15550009999");

  delete process.env.TELNYX_SMS_SENDER;
  db.run("UPDATE organizations SET sms_enabled = 0 WHERE id = 'org-1'");
});
