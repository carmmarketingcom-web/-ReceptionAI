/**
 * Reminders must fire by themselves, and the AI must not promise a text we cannot send.
 *
 * What went wrong: GET /api/reminders/process existed and worked, but nothing in production
 * ever called it — no external cron, no scheduler. Every reminder row therefore sat
 * 'pending' forever and no customer was ever reminded of an appointment. And while texting is
 * off (the 833 number's toll-free verification is still in review), the waitlist prompts told
 * callers "We'll text you when a slot opens".
 *
 * This test proves both, in BOTH serve.ts trees:
 *   • the endpoint and the in-process timer run ONE implementation (no second copy of the SQL);
 *   • the timer is armed on a 5-minute interval, logs every run, and is off under test;
 *   • booting the REAL server with the timer shortened to a few hundred ms sends a due reminder
 *     WITHOUT anyone calling the endpoint (fake Postgres, fake Resend — no real row, no real
 *     email, no real vendor);
 *   • no waitlist prompt in EN or ES promises a text.
 *
 * Run: bun run test scripts/reminders-timer.test.ts
 */
import { test, expect, mock, beforeAll } from "bun:test";
import { Database } from "bun:sqlite";

const PORT = 3219;
const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

const rootSrc = await Bun.file(`${REPO}/serve.ts`).text();
const siteSrc = await Bun.file(`${REPO}/site/serve.ts`).text();

// ── 1. One implementation, two callers ──────────────────────────────────────
function sweepFunction(src: string): string {
  const start = src.indexOf("async function processDueReminders()");
  if (start < 0) throw new Error("processDueReminders() missing");
  const end = src.indexOf("// ── In-process reminder timer", start);
  if (end < 0) throw new Error("timer block missing after the sweep");
  return src.slice(start, end);
}

test("both trees share one reminder sweep and the endpoint calls it", () => {
  const a = sweepFunction(rootSrc);
  const b = sweepFunction(siteSrc);
  expect(a).toBe(b);
  // The SQL lives in exactly one place: the function, never the HTTP handler.
  expect(a).toContain("FROM appointment_reminders");
  for (const src of [rootSrc, siteSrc]) {
    const handlerStart = src.indexOf('if (pathname === "/api/reminders/process" && req.method === "GET") {');
    expect(handlerStart).toBeGreaterThan(-1);
    const handler = src.slice(handlerStart, src.indexOf("// ── Auth: Login", handlerStart));
    expect(handler).toContain("await processDueReminders()");
    expect(handler).not.toContain("FROM appointment_reminders");
  }
});

// ── 2. The timer exists, runs every 5 minutes, logs, and is off under test ───
test("the server arms an in-process timer and is disabled under test", () => {
  for (const src of [rootSrc, siteSrc]) {
    const start = src.indexOf("// ── In-process reminder timer");
    const block = src.slice(start, src.indexOf("const freePort =", start));
    expect(block).toContain("const REMINDER_TICK_MS = Number(process.env.REMINDER_TICK_MS) || 5 * 60 * 1000;");
    expect(block).toContain('process.env.NODE_ENV === "test"');
    expect(block).toContain("setInterval(");
    expect(block).toContain("[Reminders] tick");
    expect(block).toContain("processDueReminders()");
  }
});

// ── 3. No waitlist prompt promises a text ───────────────────────────────────
test("waitlist prompts never promise a text, in either language", () => {
  for (const [name, src] of [["root", rootSrc], ["site", siteSrc]] as const) {
    const lines = src.split("\n").filter((l) => /waitlist|lista de espera/i.test(l));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).not.toMatch(/we'll text|we will text|le enviaremos un mensaje|le avisaremos/i);
    }
    // Both languages still say the same, true thing.
    expect(src).toContain("The team will see you are waiting.");
    expect(src).toContain("The team can see you are waiting.");
    expect(src).toContain("El equipo verá que está esperando.");
    expect(src).toContain("El equipo puede ver que está esperando.");
    expect(name).toBe(name);
  }
});

// ── 4. The timer actually sends a due reminder, with nobody calling the endpoint ──
const db = new Database(":memory:");
db.run(`CREATE TABLE organizations (id TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT, sms_enabled INTEGER DEFAULT 0)`);
db.run(`INSERT INTO organizations VALUES ('org-1', 'Carm Marketing', '+15550000009', 'owner@example.test', 0)`);
db.run(`CREATE TABLE phone_numbers (id TEXT PRIMARY KEY, organization_id TEXT, phone_number TEXT, is_active INTEGER DEFAULT 1)`);
db.run(`INSERT INTO phone_numbers VALUES ('pn-1', 'org-1', '+15550000020', 1)`);
db.run(`CREATE TABLE contacts (id TEXT PRIMARY KEY, organization_id TEXT, phone TEXT, email TEXT)`);
db.run(`CREATE TABLE appointments (id TEXT PRIMARY KEY, organization_id TEXT, contact_id TEXT, title TEXT,
        reminder_sent_at TEXT, reminder_sent_count TEXT, updated_at TEXT)`);
db.run(`INSERT INTO appointments VALUES ('appt-1', 'org-1', NULL, 'AC tune-up', NULL, NULL, NULL)`);
db.run(`CREATE TABLE appointment_reminders (id TEXT PRIMARY KEY, appointment_id TEXT, organization_id TEXT,
        reminder_type TEXT, recipient_phone TEXT, recipient_email TEXT, message_body TEXT,
        scheduled_at TEXT, status TEXT, channel TEXT, sent_at TEXT, error_message TEXT, updated_at TEXT)`);
db.run(`INSERT INTO appointment_reminders VALUES ('rem-1', 'appt-1', 'org-1', '24h_before', NULL,
        'caller@example.test', 'See you tomorrow at 9am.', '2026-01-01T08:00:00.000Z', 'pending', NULL, NULL, NULL, NULL)`);

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

const emails: { to: string; subject: string }[] = [];
const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : (input?.url ?? String(input));
  if (url.includes("api.resend.com/emails")) {
    const body = JSON.parse(init?.body || "{}");
    emails.push({ to: body.to, subject: body.subject });
    return new Response(JSON.stringify({ id: "email_fake" }), { status: 200 });
  }
  if (url.includes("api.telnyx.com")) return new Response(JSON.stringify({ data: { balance: "80.00" } }), { status: 200 });
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
  process.env.NODE_ENV = "development"; // bun test sets "test", which would keep the timer off
  process.env.REMINDER_TICK_MS = "200";
  delete process.env.TELNYX_API_KEY;
  process.chdir(REPO);
  await import("../serve.ts");
});

test("the timer sends a due reminder with nobody calling the endpoint", async () => {
  let row: any = null;
  for (let i = 0; i < 60; i++) {
    row = db.query("SELECT status, channel FROM appointment_reminders WHERE id = 'rem-1'").get();
    if (row && row.status !== "pending") break;
    await new Promise((r) => setTimeout(r, 100));
  }
  expect(row).toEqual({ status: "sent", channel: "email" });
  expect(emails.some((e) => e.to === "caller@example.test")).toBe(true);

  const tick = logs.find((l) => l.startsWith("[Reminders] tick"));
  expect(tick).toBeTruthy();
  expect(tick).toContain("sent=1");
  console.log = realLog;
});
