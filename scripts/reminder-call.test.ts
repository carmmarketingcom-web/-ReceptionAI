/**
 * The automated 24-hour reminder CALL (owner request 2026-11-17).
 *
 * Why: texting is off until the toll-free verification is approved, and a caller who books by
 * phone leaves no email — so that customer got no reminder at all. The reminder call is the
 * channel that needs no carrier approval.
 *
 * This proves, against the REAL serve.ts (fake Postgres, fake Telnyx, fake Resend — no real
 * row, call or email):
 *   • the feature block is byte-identical in both serve.ts trees;
 *   • a due '24h_call' / channel 'voice' row is dialled by the in-process timer, from the
 *     business line, to the customer — and only once;
 *   • demo bookings, opted-out contacts and past appointments are skipped with a reason;
 *   • an appointment whose business is outside 09:00–20:00 local is DEFERRED, not dialled;
 *   • nothing is spoken at dial time: the script goes out on call.answered (fixed 2026-11-18);
 *   • 1 → confirmed, 2 → cancelled + owner email, 9 → opt-out on the contact, 3 → dials the
 *     owner's mobile (the same transfer the main line uses).
 *
 * Run: bun run test scripts/reminder-call.test.ts
 */
import { test, expect, mock, beforeAll, setDefaultTimeout } from "bun:test";
import { Database } from "bun:sqlite";

const PORT = 3221;
const BASE = `http://127.0.0.1:${PORT}`;
const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

const rootSrc = await Bun.file(`${REPO}/serve.ts`).text();
const siteSrc = await Bun.file(`${REPO}/site/serve.ts`).text();

// ── 1. Structure: one implementation, identical in both trees ────────────────
function callBlock(src: string): string {
  const start = src.indexOf("// ── Automated reminder CALL (voice)");
  const end = src.indexOf("// ── Reminder sweep — ONE implementation", start);
  if (start < 0 || end < 0) throw new Error("reminder-call block missing");
  return src.slice(start, end);
}

test("both trees carry the same reminder-call block, with every guard in it", () => {
  expect(callBlock(rootSrc)).toBe(callBlock(siteSrc));
  for (const src of [rootSrc, siteSrc]) {
    const block = callBlock(src);
    expect(block).toContain("const reminderCallStates = new Map");
    expect(block).toContain("REMINDER_CALL_START_HOUR = 9");
    expect(block).toContain("REMINDER_CALL_END_HOUR = 20");
    expect(block).toContain("REMINDER_CALL_MIN_BALANCE_USD = 5");
    expect(block).toContain("attemptReminderCall");
    expect(block).toContain("handleReminderCallDigit");
    // The script never claims to be a person.
    expect(block).toContain("virtual assistant");
    // The call row is queued at booking time in both trees.
    expect(src).toContain("'24h_call'");
    expect(src).toContain(`String(r.channel || "") === "voice"`);
    // 10-second gather on the reminder leg, and the four keys are handled.
    expect(src).toContain("timeout_millis: 10000");
  }
});

// ── 2. Real server, fake world ───────────────────────────────────────────────
function hourIn(tz: string): number {
  return parseInt(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hour12: false }).format(new Date()), 10) % 24;
}
const ZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Madrid", "Asia/Tokyo", "UTC"];
const DAY_ZONE = ZONES.find((z) => { const h = hourIn(z); return h >= 9 && h < 20; })!;
const NIGHT_ZONE = ZONES.find((z) => { const h = hourIn(z); return h < 9 || h >= 20; })!;

const BUSINESS_LINE = "+15550000020";
const OWNER_MOBILE = "+15550000009";

const db = new Database(":memory:");
db.run(`CREATE TABLE organizations (id TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT, sms_enabled INTEGER DEFAULT 0, timezone TEXT)`);
db.query(`INSERT INTO organizations VALUES (?,?,?,?,?,?)`).run("org-day", "Carm Marketing", OWNER_MOBILE, "owner@example.test", 0, DAY_ZONE);
db.query(`INSERT INTO organizations VALUES (?,?,?,?,?,?)`).run("org-night", "Night Co", "+15550000010", "night@example.test", 0, NIGHT_ZONE);
db.run(`CREATE TABLE phone_numbers (id TEXT PRIMARY KEY, organization_id TEXT, phone_number TEXT, is_active INTEGER DEFAULT 1)`);
db.query(`INSERT INTO phone_numbers VALUES (?,?,?,?)`).run("pn-1", "org-day", BUSINESS_LINE, 1);
db.query(`INSERT INTO phone_numbers VALUES (?,?,?,?)`).run("pn-2", "org-night", "+15550000021", 1);
db.run(`CREATE TABLE contacts (id TEXT PRIMARY KEY, organization_id TEXT, first_name TEXT, phone TEXT, email TEXT,
        preferred_language TEXT, reminder_calls_opt_out INTEGER DEFAULT 0, updated_at TEXT)`);
db.run(`CREATE TABLE appointments (id TEXT PRIMARY KEY, organization_id TEXT, contact_id TEXT, title TEXT,
        start_time TEXT, end_time TEXT, status TEXT, service_type TEXT, is_demo INTEGER DEFAULT 0,
        reminder_sent_at TEXT, reminder_sent_count TEXT, updated_at TEXT)`);
db.run(`CREATE TABLE appointment_reminders (id TEXT PRIMARY KEY, appointment_id TEXT, organization_id TEXT,
        reminder_type TEXT, recipient_phone TEXT, recipient_email TEXT, message_body TEXT, scheduled_at TEXT,
        status TEXT, channel TEXT, result TEXT, sent_at TEXT, error_message TEXT,
        claimed_at TEXT, provider_message_id TEXT, created_at TEXT, updated_at TEXT)`);

function translate(text: string): string {
  return text
    .replace(/::[a-z_]+(\[\])?/gi, "")
    // The sweep claims its rows with FOR UPDATE SKIP LOCKED, which SQLite has no syntax for;
    // the row locking is Postgres' job and this stand-in runs one statement at a time.
    .replace(/\bFOR UPDATE SKIP LOCKED\b/gi, "")
    .replace(/\bNOW\(\)/gi, "CURRENT_TIMESTAMP")
    .replace(/gen_random_uuid\(\)/gi, "'00000000-0000-4000-8000-000000000000'");
}

function sqlTag(strings: TemplateStringsArray, ...params: any[]) {
  const text = translate(strings.reduce((acc, s, i) => acc + s + (i < params.length ? "?" : ""), ""));
  try {
    const stmt = db.query(text);
    // The sweep CLAIMS its work with UPDATE ... RETURNING, so a statement that returns rows
    // is read with .all() and not thrown away by .run().
    if (/^\s*select/i.test(text) || /\breturning\b/i.test(text)) return Promise.resolve(stmt.all(...params));
    stmt.run(...params);
    return Promise.resolve([]);
  } catch (err) {
    return Promise.reject(err);
  }
}
mock.module("@neondatabase/serverless", () => ({ neon: () => sqlTag }));
setDefaultTimeout(30_000);

let seq = 0;
/** One appointment + contact + a due 24h_call reminder row. */
function seed(opts: {
  org?: string; hoursFromNow?: number; demo?: boolean; optOut?: boolean;
  status?: string; reminderChannel?: string; reminderType?: string;
}) {
  seq += 1;
  const org = opts.org || "org-day";
  const phone = `+1555000${2000 + seq}`;
  const apptId = `appt-${seq}`;
  const contactId = `contact-${seq}`;
  const reminderId = `rem-${seq}`;
  db.query(`INSERT INTO contacts (id, organization_id, first_name, phone, email, preferred_language, reminder_calls_opt_out)
            VALUES (?,?,?,?,?,?,?)`).run(contactId, org, "Dana", phone, null, "en", opts.optOut ? 1 : 0);
  db.query(`INSERT INTO appointments (id, organization_id, contact_id, title, start_time, status, service_type, is_demo)
            VALUES (?,?,?,?,?,?,?,?)`).run(
    apptId, org, contactId, "AC tune-up",
    new Date(Date.now() + (opts.hoursFromNow ?? 25) * 3600 * 1000).toISOString(),
    opts.status || "confirmed", "AC tune-up", opts.demo ? 1 : 0,
  );
  db.query(`INSERT INTO appointment_reminders (id, appointment_id, organization_id, reminder_type, scheduled_at,
            status, channel, recipient_phone) VALUES (?,?,?,?,?,?,?,?)`).run(
    reminderId, apptId, org, opts.reminderType || "24h_call",
    new Date(Date.now() - 60_000).toISOString(), "pending", opts.reminderChannel || "voice", phone,
  );
  return { apptId, contactId, reminderId, phone, org };
}

// Seeded before boot: the first sweep sees them.
const dialled = seed({});
const optedOut = seed({ optOut: true });
const demo = seed({ demo: true });
const past = seed({ hoursFromNow: -2 });
const night = seed({ org: "org-night" });

const telnyx = { balance: "80.00", dials: [] as { to: string; from: string }[], commands: [] as { cid: string; action: string; payload: any }[] };
const emails: { to: string; subject: string }[] = [];
const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : (input?.url ?? String(input));
  const method = String(init?.method || "GET").toUpperCase();
  if (url.includes("api.resend.com/emails")) {
    const body = JSON.parse(init?.body || "{}");
    emails.push({ to: body.to, subject: body.subject });
    return new Response(JSON.stringify({ id: "email_fake" }), { status: 200 });
  }
  if (url.includes("/v2/calls/") && url.includes("/actions/")) {
    const m = url.match(/\/v2\/calls\/([^/]+)\/actions\/(\w+)/);
    if (m) telnyx.commands.push({ cid: m[1], action: m[2], payload: JSON.parse(init?.body || "{}") });
    return new Response(JSON.stringify({ data: { result: "ok" } }), { status: 200 });
  }
  if (url.includes("/v2/calls") && method === "POST") {
    const body = JSON.parse(init?.body || "{}");
    telnyx.dials.push({ to: body.to, from: body.from });
    return new Response(JSON.stringify({ data: { call_control_id: `rc-cid-${telnyx.dials.length}` } }), { status: 200 });
  }
  if (url.includes("api.telnyx.com")) {
    return new Response(JSON.stringify({ data: { balance: telnyx.balance, available_credit: telnyx.balance, currency: "USD" } }), { status: 200 });
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
  process.env.NODE_ENV = "development"; // bun test sets "test", which keeps the timer off
  process.env.REMINDER_TICK_MS = "200";
  process.chdir(REPO);
  await import("../serve.ts");
});

async function waitFor<T>(fn: () => T | undefined | null, ms = 10_000): Promise<T> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const v = fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("timed out");
}

const reminderRow = (id: string) => db.query(`SELECT status, channel, result, error_message FROM appointment_reminders WHERE id = ?`).get(id) as any;
const apptRow = (id: string) => db.query(`SELECT status FROM appointments WHERE id = ?`).get(id) as any;

async function postEvent(ev: string, payload: any) {
  return realFetch(`${BASE}/api/telnyx/voice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: { event_type: ev, payload } }),
  });
}

// ── 3. The sweep dials, and refuses to dial ──────────────────────────────────
test("a due reminder is dialled once; demo, opted-out and past ones are skipped; night is deferred", async () => {
  const row = await waitFor(() => { const r = reminderRow(dialled.reminderId); return r?.result === "dialed" ? r : null; });
  expect(row).toEqual({ status: "sent", channel: "voice", result: "dialed", error_message: null });
  expect(telnyx.dials[0]).toEqual({ to: dialled.phone, from: BUSINESS_LINE });
  // One dial only, however many sweeps pass.
  await new Promise((r) => setTimeout(r, 600));
  expect(telnyx.dials.filter((d) => d.to === dialled.phone).length).toBe(1);
  expect(logs.some((l) => l.includes(`[ReminderCall] appt=${dialled.apptId}`) && l.includes("status=dialed"))).toBe(true);

  for (const [s, why] of [
    [optedOut, "opted out"],
    [demo, "demo booking"],
    [past, "time has passed"],
  ] as const) {
    const r = await waitFor(() => { const x = reminderRow(s.reminderId); return x?.status === "skipped" ? x : null; });
    expect(r.result).toBe("skipped");
    expect(String(r.error_message)).toContain(why);
    expect(telnyx.dials.some((d) => d.to === s.phone)).toBe(false);
  }

  // Outside 09:00–20:00 local: still pending, never dialled.
  await new Promise((r) => setTimeout(r, 500));
  expect(reminderRow(night.reminderId)).toEqual({ status: "pending", channel: "voice", result: null, error_message: null });
  expect(telnyx.dials.some((d) => d.to === night.phone)).toBe(false);
  expect(logs.some((l) => l.includes(`appt=${night.apptId}`) && l.includes("deferred"))).toBe(true);
});

// ── 4. The four keys ─────────────────────────────────────────────────────────
test("the reminder call speaks the script, and 1 confirms", async () => {
  const cid = "rc-cid-1";
  await postEvent("call.initiated", { call_control_id: cid, to: dialled.phone, from: BUSINESS_LINE });
  // Nothing is spoken at dial time: the phone has not been answered yet, so speaking on
  // call.initiated played the reminder into silence (fixed 2026-11-18). The script now goes
  // out on call.answered.
  expect(telnyx.commands.some((c) => c.cid === cid && c.action === "speak")).toBe(false);

  await postEvent("call.answered", { call_control_id: cid, to: dialled.phone, from: BUSINESS_LINE });
  await waitFor(() => telnyx.commands.find((c) => c.cid === cid && c.action === "speak" && String(c.payload?.payload || "").includes("virtual assistant")));
  // The options are their own utterance (one idea per speak, for natural pacing).
  await waitFor(() => telnyx.commands.find((c) => c.cid === cid && c.action === "speak" && String(c.payload?.payload || "").includes("To confirm, press 1")));

  await postEvent("call.dtmf.received", { call_control_id: cid, digit: "1" });
  expect(reminderRow(dialled.reminderId).result).toBe("confirmed");
});

test("2 cancels the appointment and emails the owner", async () => {
  const s = seed({});
  const cid = await waitFor(() => { const n = telnyx.dials.length; return n > 1 && reminderRow(s.reminderId).result === "dialed" ? `rc-cid-${n}` : null; });
  await postEvent("call.initiated", { call_control_id: cid, to: s.phone, from: BUSINESS_LINE });
  // Nothing at dial time — the leg is only ringing. The script goes out on call.answered.
  expect(telnyx.commands.some((c) => c.cid === cid && c.action === "speak")).toBe(false);
  await postEvent("call.answered", { call_control_id: cid, to: s.phone, from: BUSINESS_LINE });
  await waitFor(() => telnyx.commands.find((c) => c.cid === cid && c.action === "speak" && String(c.payload?.payload || "").includes("press 2")));
  await postEvent("call.dtmf.received", { call_control_id: cid, digit: "2" });
  expect(reminderRow(s.reminderId).result).toBe("cancelled");
  expect(apptRow(s.apptId).status).toBe("cancelled");
  const mail = await waitFor(() => emails.find((e) => e.subject.startsWith("Appointment cancelled by reminder call:")));
  expect(mail.subject).toContain("Dana");
  expect(mail.subject).toContain("AC tune-up");
});

test("9 opts the contact out of reminder calls", async () => {
  const s = seed({});
  const cid = await waitFor(() => { const n = telnyx.dials.length; return n > 2 && reminderRow(s.reminderId).result === "dialed" ? `rc-cid-${n}` : null; });
  await postEvent("call.initiated", { call_control_id: cid, to: s.phone, from: BUSINESS_LINE });
  await postEvent("call.answered", { call_control_id: cid, to: s.phone, from: BUSINESS_LINE });
  await waitFor(() => telnyx.commands.find((c) => c.cid === cid && c.action === "speak" && String(c.payload?.payload || "").includes("press 9")));
  await postEvent("call.dtmf.received", { call_control_id: cid, digit: "9" });
  expect(reminderRow(s.reminderId).result).toBe("optout");
  const contact = db.query(`SELECT reminder_calls_opt_out FROM contacts WHERE id = ?`).get(s.contactId) as any;
  expect(contact.reminder_calls_opt_out).toBe(1);
});

test("3 transfers to the owner's mobile, the way the main line does", async () => {
  const s = seed({});
  const cid = await waitFor(() => { const n = telnyx.dials.length; return n > 3 && reminderRow(s.reminderId).result === "dialed" ? `rc-cid-${n}` : null; });
  await postEvent("call.initiated", { call_control_id: cid, to: s.phone, from: BUSINESS_LINE });
  await postEvent("call.answered", { call_control_id: cid, to: s.phone, from: BUSINESS_LINE });
  await waitFor(() => telnyx.commands.find((c) => c.cid === cid && c.action === "speak" && String(c.payload?.payload || "").includes("press 3")));
  await postEvent("call.dtmf.received", { call_control_id: cid, digit: "3" });
  await waitFor(() => telnyx.dials.find((d) => d.to === OWNER_MOBILE));
  expect(telnyx.dials.find((d) => d.to === OWNER_MOBILE)!.from).toBe(BUSINESS_LINE);
  expect(reminderRow(s.reminderId).result).toBe("transfer");
  console.log = realLog;
});
