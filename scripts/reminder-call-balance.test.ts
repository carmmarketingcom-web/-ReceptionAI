/**
 * The reminder call must not dial on an empty Telnyx balance.
 *
 * The sweep reads the same cached balance the health page shows. Below $5 it skips the call
 * and says so, instead of running the account to $0 mid-sweep. An UNKNOWN balance is not
 * permission either: the row waits for the next sweep.
 *
 * Run: bun run test scripts/reminder-call-balance.test.ts
 */
import { test, expect, mock, beforeAll } from "bun:test";
import { Database } from "bun:sqlite";

const PORT = 3222;
const BASE = `http://127.0.0.1:${PORT}`;
const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

function hourIn(tz: string): number {
  return parseInt(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hour12: false }).format(new Date()), 10) % 24;
}
const ZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Madrid", "Asia/Tokyo", "UTC"];
const DAY_ZONE = ZONES.find((z) => { const h = hourIn(z); return h >= 9 && h < 20; })!;

const CUSTOMER = "+15550003001";

const db = new Database(":memory:");
db.run(`CREATE TABLE organizations (id TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT, sms_enabled INTEGER DEFAULT 0, timezone TEXT)`);
db.query(`INSERT INTO organizations VALUES (?,?,?,?,?,?)`).run("org-1", "Carm Marketing", "+15550000009", "owner@example.test", 0, DAY_ZONE);
db.run(`CREATE TABLE phone_numbers (id TEXT PRIMARY KEY, organization_id TEXT, phone_number TEXT, is_active INTEGER DEFAULT 1)`);
db.query(`INSERT INTO phone_numbers VALUES (?,?,?,?)`).run("pn-1", "org-1", "+15550000020", 1);
db.run(`CREATE TABLE contacts (id TEXT PRIMARY KEY, organization_id TEXT, first_name TEXT, phone TEXT, email TEXT,
        preferred_language TEXT, reminder_calls_opt_out INTEGER DEFAULT 0, updated_at TEXT)`);
db.query(`INSERT INTO contacts VALUES (?,?,?,?,?,?,?,?)`).run("contact-1", "org-1", "Dana", CUSTOMER, null, "en", 0, null);
db.run(`CREATE TABLE appointments (id TEXT PRIMARY KEY, organization_id TEXT, contact_id TEXT, title TEXT,
        start_time TEXT, end_time TEXT, status TEXT, service_type TEXT, is_demo INTEGER DEFAULT 0,
        reminder_sent_at TEXT, reminder_sent_count TEXT, updated_at TEXT)`);
db.query(`INSERT INTO appointments (id, organization_id, contact_id, title, start_time, status, service_type, is_demo)
          VALUES (?,?,?,?,?,?,?,?)`).run(
  "appt-1", "org-1", "contact-1", "AC tune-up",
  new Date(Date.now() + 25 * 3600 * 1000).toISOString(), "confirmed", "AC tune-up", 0,
);
db.run(`CREATE TABLE appointment_reminders (id TEXT PRIMARY KEY, appointment_id TEXT, organization_id TEXT,
        reminder_type TEXT, recipient_phone TEXT, recipient_email TEXT, message_body TEXT, scheduled_at TEXT,
        status TEXT, channel TEXT, result TEXT, sent_at TEXT, error_message TEXT, updated_at TEXT)`);
db.query(`INSERT INTO appointment_reminders (id, appointment_id, organization_id, reminder_type, scheduled_at, status, channel, recipient_phone)
          VALUES (?,?,?,?,?,?,?,?)`).run(
  "rem-1", "appt-1", "org-1", "24h_call", new Date(Date.now() - 60_000).toISOString(), "pending", "voice", CUSTOMER,
);

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

const dials: { to: string }[] = [];
const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : (input?.url ?? String(input));
  if (url.includes("api.resend.com/emails")) return new Response(JSON.stringify({ id: "email_fake" }), { status: 200 });
  if (url.includes("/v2/calls") && String(init?.method || "GET").toUpperCase() === "POST") {
    dials.push({ to: JSON.parse(init?.body || "{}").to });
    return new Response(JSON.stringify({ data: { call_control_id: "rc-cid-1" } }), { status: 200 });
  }
  if (url.includes("api.telnyx.com")) {
    return new Response(JSON.stringify({ data: { balance: "3.00", available_credit: "3.00", currency: "USD" } }), { status: 200 });
  }
  if (url.includes("127.0.0.1") || url.includes("localhost")) return realFetch(input, init);
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}) as any;

const logs: string[] = [];
const realLog = console.log.bind(console);

beforeAll(async () => {
  console.log = (...args: any[]) => { logs.push(args.map(String).join(" ")); };
  process.env.PORT = String(PORT);
  process.env.JWT_SECRET = "test-only-jwt-secret-that-is-long-enough-32";
  process.env.DATABASE_URL = "postgres://fake@localhost/fake";
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.TELNYX_API_KEY = "KEY_test";
  process.env.TELNYX_CONNECTION_ID = "conn_test";
  process.env.NODE_ENV = "development";
  process.env.REMINDER_TICK_MS = "200";
  process.chdir(REPO);
  await import("../serve.ts");
});

test("below a $5 balance the reminder call is skipped, not dialled", async () => {
  let row: any = null;
  for (let i = 0; i < 200; i++) {
    row = db.query(`SELECT status, channel, result, error_message FROM appointment_reminders WHERE id = 'rem-1'`).get();
    if (row && row.status !== "pending") break;
    await new Promise((r) => setTimeout(r, 100));
  }
  expect(row.status).toBe("skipped");
  expect(row.channel).toBe("voice");
  expect(String(row.error_message)).toContain("3.00");
  expect(dials).toEqual([]);
  expect(logs.some((l) => l.includes("[ReminderCall] skipped — balance $3.00"))).toBe(true);
  console.log = realLog;
}, 30000);
