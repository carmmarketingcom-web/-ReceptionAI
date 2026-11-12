/**
 * A web booking must email the BUSINESS OWNER, not just the customer.
 *
 * Before this, /api/booking emailed only the customer: a booking could land on /book and
 * nobody at the business found out without logging in. Every owner event goes out by email
 * (owner decision 2026-11-03), so the booking now reports to the owner too.
 *
 * This boots the REAL production server (`serve.ts`) with only the outside world replaced:
 *   • @neondatabase/serverless → tagged-template SQL against bun:sqlite (real SQL), so no
 *     production row is touched;
 *   • globalThis.fetch → answers Resend (emails) and lets 127.0.0.1 through to the test's own
 *     server, so no real vendor is reached.
 *
 * Run: bun run test scripts/verify-booking-owner-email.test.ts
 */
import { test, expect, mock, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";

const PORT = 3217;
const BASE = `http://127.0.0.1:${PORT}`;
const REPO = process.env.RECEPTIONAI_REPO || new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const ORG_ID = "11111111-1111-4111-8111-111111111111";
const OWNER_EMAIL = "owner@example.test";
const BUSINESS_LINE = "+15550000031";

// ── Fake Postgres (SQLite) ───────────────────────────────────────────────────
const db = new Database(":memory:");
db.run(`CREATE TABLE organizations (
  id TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT, timezone TEXT,
  slug TEXT, sms_enabled INTEGER DEFAULT 0, created_at TEXT
)`);
db.run(`INSERT INTO organizations (id, name, phone, email, timezone, slug, sms_enabled, created_at)
        VALUES ('${ORG_ID}', 'Carm Marketing', '+15550000009', '${OWNER_EMAIL}',
                'America/New_York', 'carm', 0, '2026-01-01T00:00:00Z')`);
db.run(`CREATE TABLE users (
  id TEXT PRIMARY KEY, organization_id TEXT, email TEXT, created_at TEXT
)`);
db.run(`CREATE TABLE phone_numbers (
  id TEXT PRIMARY KEY, organization_id TEXT, phone_number TEXT, is_active INTEGER DEFAULT 1
)`);
db.run(`INSERT INTO phone_numbers VALUES ('pn-1', '${ORG_ID}', '${BUSINESS_LINE}', 1)`);
db.run(`CREATE TABLE contacts (
  id TEXT PRIMARY KEY, organization_id TEXT, first_name TEXT, last_name TEXT, phone TEXT,
  email TEXT, created_at TEXT, updated_at TEXT
)`);
db.run(`CREATE TABLE appointments (
  id TEXT PRIMARY KEY, organization_id TEXT, contact_id TEXT, title TEXT,
  start_time TEXT, end_time TEXT, timezone TEXT, service_type TEXT, status TEXT, notes TEXT,
  next_reminder_at TEXT, created_at TEXT, updated_at TEXT
)`);
db.run(`CREATE TABLE appointment_reminders (
  id TEXT PRIMARY KEY, appointment_id TEXT, organization_id TEXT, reminder_type TEXT,
  scheduled_at TEXT, status TEXT, channel TEXT, recipient_phone TEXT, recipient_email TEXT,
  message_body TEXT
)`);

let uuidSeq = 0;
let lastUuid = "";
/** Postgres → SQLite for the statements this flow runs (syntax only). */
function translate(text: string): string {
  return text
    .replace(/::[a-z_]+(\[\])?/gi, "")
    .replace(/\bNOW\(\)/gi, "CURRENT_TIMESTAMP")
    .replace(/gen_random_uuid\(\)/gi, () => {
      lastUuid = `00000000-0000-4000-8000-${String(++uuidSeq).padStart(12, "0")}`;
      return `'${lastUuid}'`;
    });
}

function sqlTag(strings: TemplateStringsArray, ...params: any[]) {
  const text = translate(strings.reduce((acc, s, i) => acc + s + (i < params.length ? "?" : ""), ""));
  try {
    const stmt = db.query(text);
    if (/^\s*select/i.test(text)) return Promise.resolve(stmt.all(...params));
    stmt.run(...params);
    // `INSERT … RETURNING id` hands back the id the insert generated, as Postgres does —
    // without it the handler sees no appointment id and the owner alert never runs.
    if (/\breturning\b/i.test(text)) return Promise.resolve([{ id: lastUuid }]);
    return Promise.resolve([]);
  } catch (err) {
    return Promise.reject(err);
  }
}
mock.module("@neondatabase/serverless", () => ({ neon: () => sqlTag }));

// ── Fake vendors ─────────────────────────────────────────────────────────────
const resend = { emails: [] as { to: string; subject: string; body: string }[], fail: false };

const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : (input?.url ?? String(input));

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
  process.env.RESEND_API_KEY = "re_test_key"; // sendEmail() is stubbed at the fetch layer
  process.env.PUBLIC_BOOKING_ORG_ID = ORG_ID;
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

afterAll(() => {
  try { db.close(); } catch { /* already closed */ }
});

// ── Helpers ──────────────────────────────────────────────────────────────────
async function book(body: Record<string, unknown>) {
  const res = await realFetch(`${BASE}/api/booking`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

// ── 1. A booking emails the owner with every detail ─────────────────────────
test("a web booking emails the business owner the customer's details", async () => {
  resend.emails.length = 0;

  const { status } = await book({
    name: "Dana Reyes", phone: "+15550000401", email: "dana@example.test",
    date: "2026-11-17", time: "11:00", service: "AC Repair",
    notes: "Garage door is unlocked",
  });
  expect(status).toBe(201);

  const owner = resend.emails.filter((e) => e.to === OWNER_EMAIL);
  expect(owner.length).toBe(1);                          // exactly one alert, no duplicates
  expect(owner[0].subject).toBe("New booking: AC Repair — 2026-11-17 11:00");

  const body = owner[0].body;
  expect(body).toContain("Dana Reyes");                  // who
  expect(body).toContain("+15550000401");                // their phone
  expect(body).toContain("dana@example.test");           // their email
  expect(body).toContain("Service: AC Repair");
  // The slot in the business's own timezone, named so the owner never guesses an offset.
  expect(body).toContain("Tuesday, November 17 at 11:00 AM");
  expect(body).toContain("America/New_York");
  expect(body).toContain("Garage door is unlocked");     // notes
  expect(body).toContain("https://www.receptionai.store/dashboard");

  // The send really reached the provider and was recorded as a booking alert.
  const row = db.query("SELECT * FROM email_deliveries ORDER BY created_at_ms DESC LIMIT 1").get() as any;
  expect(row).toBeTruthy();
  expect(row.status).toBe("sent");
  expect(row.to_email).toBe(OWNER_EMAIL);
  expect(row.org_id).toBe(ORG_ID);
  expect(row.kind).toBe("booking");

  // The booking itself was saved.
  const appt = db.query("SELECT * FROM appointments").get() as any;
  expect(appt).toBeTruthy();
  expect(appt.start_time).toBe("2026-11-17T16:00:00.000Z"); // 11:00 ET stored as UTC
});

// ── 2. No customer email address: the owner still hears about it ────────────
test("a booking with no customer email still emails the owner", async () => {
  resend.emails.length = 0;

  const { status } = await book({
    name: "Sam Ortiz", phone: "+15550000402",
    date: "2026-11-18", time: "09:00", service: "Furnace Tune-Up",
  });
  expect(status).toBe(201);

  const owner = resend.emails.filter((e) => e.to === OWNER_EMAIL);
  expect(owner.length).toBe(1);
  expect(owner[0].subject).toBe("New booking: Furnace Tune-Up — 2026-11-18 09:00");
  expect(owner[0].body).toContain("Sam Ortiz");
  expect(owner[0].body).toContain("Email: not provided");
  expect(owner[0].body).toContain("Notes: none");
});

// ── 3. A failed owner email never fails the booking ────────────────────────
test("a rejected owner email does not fail or lose the booking", async () => {
  resend.emails.length = 0;
  resend.fail = true;

  const before = (db.query("SELECT COUNT(*) AS n FROM appointments").get() as any).n;
  const { status } = await book({
    name: "Pat Lee", phone: "+15550000403", email: "pat@example.test",
    date: "2026-11-19", time: "14:00", service: "Water Heater",
  });

  expect(status).toBe(201);                              // the customer still gets a booking
  expect((db.query("SELECT COUNT(*) AS n FROM appointments").get() as any).n).toBe(before + 1);

  // The attempt happened and is visible as a failure, not silence.
  const failed = db.query("SELECT * FROM email_deliveries WHERE status = 'failed' ORDER BY created_at_ms DESC LIMIT 1").get() as any;
  expect(failed).toBeTruthy();
  expect(failed.kind).toBe("booking");

  resend.fail = false;
});
