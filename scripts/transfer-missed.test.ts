/**
 * The two press-3 transfer cases the launch gate still listed as unproven (owner directive 10-29):
 *
 *   A. The OWNER MISSES the transfer. The caller must be told we will call them back and the owner
 *      must be alerted — for both ways a caller reaches option 3: on the business line itself, and
 *      from inside a 24-hour reminder call.
 *   B. Option 3 pressed from INSIDE a 24h reminder call. The owner's mobile is dialled from the
 *      business line and the two legs are bridged, exactly like the main line.
 *
 * Replayed against the REAL serve.ts (fake Postgres, fake Telnyx, fake Resend — no real row, call
 * or email), the way the voice-sim harness does it: post the Telnyx call-control events a real
 * call produces and read the exact speak / gather / hangup / dial commands the server issues.
 *
 * Run: bun run test scripts/transfer-missed.test.ts
 */
import { test, expect, mock, beforeAll, setDefaultTimeout } from "bun:test";
import { Database } from "bun:sqlite";

const PORT = 3223;
const BASE = `http://127.0.0.1:${PORT}`;
const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

const BUSINESS_LINE = "+15550000020";
const OWNER_MOBILE = "+15550000009";
const CALLER = "+15550005555";

// A timezone in which it is currently inside the 09:00–20:00 reminder window, so the sweep dials.
const ZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Madrid", "Asia/Tokyo", "UTC"];
const DAY_ZONE = ZONES.find((z) => {
  const h = parseInt(new Intl.DateTimeFormat("en-US", { timeZone: z, hour: "2-digit", hour12: false }).format(new Date()), 10) % 24;
  return h >= 9 && h < 20;
})!;

// ── Fake Postgres (SQLite behind the neon tag) ──────────────────────────────
const db = new Database(":memory:");
db.run(`CREATE TABLE organizations (id TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT,
        sms_enabled INTEGER DEFAULT 0, timezone TEXT, transfer_number TEXT)`);
db.query(`INSERT INTO organizations VALUES (?,?,?,?,?,?,?)`)
  .run("org1", "Carm Marketing", OWNER_MOBILE, "owner@example.test", 0, DAY_ZONE, OWNER_MOBILE);
db.run(`CREATE TABLE phone_numbers (id TEXT PRIMARY KEY, organization_id TEXT, phone_number TEXT, is_active INTEGER DEFAULT 1)`);
db.query(`INSERT INTO phone_numbers VALUES (?,?,?,?)`).run("pn-1", "org1", BUSINESS_LINE, 1);
db.run(`CREATE TABLE contacts (id TEXT PRIMARY KEY, organization_id TEXT, first_name TEXT, phone TEXT, email TEXT,
        preferred_language TEXT, reminder_calls_opt_out INTEGER DEFAULT 0, updated_at TEXT)`);
db.run(`CREATE TABLE appointments (id TEXT PRIMARY KEY, organization_id TEXT, contact_id TEXT, title TEXT,
        start_time TEXT, end_time TEXT, status TEXT, service_type TEXT, is_demo INTEGER DEFAULT 0,
        reminder_sent_at TEXT, reminder_sent_count TEXT, updated_at TEXT)`);
db.run(`CREATE TABLE appointment_reminders (id TEXT PRIMARY KEY, appointment_id TEXT, organization_id TEXT,
        reminder_type TEXT, recipient_phone TEXT, recipient_email TEXT, message_body TEXT, scheduled_at TEXT,
        status TEXT, channel TEXT, result TEXT, sent_at TEXT, error_message TEXT,
        claimed_at TEXT, provider_message_id TEXT, created_at TEXT, updated_at TEXT)`);
db.run(`CREATE TABLE transfer_events (id TEXT PRIMARY KEY, organization_id TEXT, conversation_id TEXT,
        caller_number TEXT, target_number TEXT, outcome TEXT, language TEXT, source TEXT, created_at TEXT)`);
db.run(`CREATE TABLE sms_deliveries (id TEXT PRIMARY KEY, telnyx_message_id TEXT, to_number TEXT, kind TEXT,
        parts INTEGER, status TEXT, error_code TEXT, created_at_ms INTEGER, updated_at_ms INTEGER)`);

function translate(text: string): string {
  return text
    .replace(/::[a-z_]+(\[\])?/gi, "")
    .replace(/\bFOR UPDATE SKIP LOCKED\b/gi, "")
    .replace(/\bNOW\(\)/gi, "CURRENT_TIMESTAMP")
    .replace(/gen_random_uuid\(\)/gi, "'00000000-0000-4000-8000-000000000000'");
}

function sqlTag(strings: TemplateStringsArray, ...params: any[]) {
  const text = translate(strings.reduce((acc, s, i) => acc + s + (i < params.length ? "?" : ""), ""));
  try {
    const stmt = db.query(text);
    if (/^\s*select/i.test(text) || /\breturning\b/i.test(text)) return Promise.resolve(stmt.all(...params));
    stmt.run(...params);
    return Promise.resolve([]);
  } catch (err) {
    return Promise.reject(err);
  }
}
mock.module("@neondatabase/serverless", () => ({ neon: () => sqlTag }));
setDefaultTimeout(40_000);

// ── Recorded Telnyx / email traffic ─────────────────────────────────────────
type Action = { action: string; cid: string; body: any };
const actions: Action[] = [];
const dials: { to: string; from: string }[] = [];
const emails: { to: string; subject: string; body: string }[] = [];
const realFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : (input?.url ?? String(input));
  const method = String(init?.method || "GET").toUpperCase();
  const json = (obj: any) => new Response(JSON.stringify(obj), { status: 200, headers: { "Content-Type": "application/json" } });
  if (url.includes("127.0.0.1") || url.includes("localhost")) return realFetch(input, init);
  if (url.includes("api.resend.com/emails")) {
    const body = JSON.parse(init?.body || "{}");
    emails.push({ to: String(body.to), subject: String(body.subject), body: String(body.text || body.html || "") });
    return json({ id: `email_${emails.length}` });
  }
  const m = url.match(/\/v2\/calls\/([^/]+)\/actions\/([^/?]+)/);
  if (m) {
    actions.push({ action: m[2], cid: m[1], body: init?.body ? JSON.parse(init.body) : {} });
    return json({ data: {} });
  }
  if (/\/v2\/calls$/.test(url)) {
    const body = init?.body ? JSON.parse(init.body) : {};
    dials.push({ to: body.to, from: body.from });
    return json({ data: { call_control_id: `sim-dial-${dials.length}` } });
  }
  if (/balance/i.test(url)) return json({ data: { balance: "25.00", available_credit: "25.00", currency: "USD" } });
  return json({ data: {} });
}) as any;

beforeAll(async () => {
  process.env.PORT = String(PORT);
  process.env.JWT_SECRET = "test-only-jwt-secret-that-is-long-enough-32";
  process.env.DATABASE_URL = "postgres://fake@localhost/fake";
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.TELNYX_API_KEY = "KEY_test";
  process.env.TELNYX_CONNECTION_ID = "conn_test";
  process.env.HOST = `127.0.0.1:${PORT}`;
  process.env.NODE_ENV = "development"; // bun test sets "test", which keeps the reminder timer off
  process.env.REMINDER_TICK_MS = "200";
  process.chdir(REPO);
  await import("../serve.ts");
  for (let i = 0; i < 80; i++) {
    try { const r = await realFetch(`${BASE}/api/health`); if (r.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("serve.ts did not boot");
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const since = (n: number) => actions.slice(n);
const speaksSince = (mark: number, cid: string) =>
  since(mark).filter((a) => a.action === "speak" && a.cid === cid).map((a) => String(a.body.payload || ""));
const cmdsSince = (mark: number, cid: string, action: string) =>
  since(mark).filter((a) => a.action === action && a.cid === cid);

async function waitFor(check: () => boolean, timeoutMs = 8000, stepMs = 40): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return true;
    await wait(stepMs);
  }
  return check();
}

async function waitForValue<T>(check: () => T | null | undefined, timeoutMs = 8000, stepMs = 40): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const v = check();
    if (v) return v;
    await wait(stepMs);
  }
  return check() || null;
}

async function postEvent(event_type: string, payload: any) {
  return realFetch(`${BASE}/api/telnyx/voice`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: { event_type, payload } }),
  });
}

// The prompt is issued segment by segment with a real beat between them; wait until it has gone
// quiet, then replay one call.speak.ended per segment so the gather arms exactly as on a real call.
async function settleSpeaks(cid: string, mark: number, quietMs = 420, timeoutMs = 8000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let last = -1;
  let lastChange = Date.now();
  while (Date.now() < deadline) {
    const n = since(mark).filter((a) => a.action === "speak" && a.cid === cid).length;
    if (n !== last) { last = n; lastChange = Date.now(); }
    else if (n > 0 && Date.now() - lastChange >= quietMs) return;
    await wait(40);
  }
}

async function finishSpeaking(cid: string, mark: number) {
  let m = mark;
  for (let round = 0; round < 6; round++) {
    if (round === 0) await settleSpeaks(cid, m);
    else await wait(450);
    const speaks = actions.slice(m).filter((a) => a.action === "speak" && a.cid === cid);
    if (speaks.length === 0) return actions.slice(m);
    m = actions.length;
    for (let i = 0; i < speaks.length; i++) {
      await postEvent("call.speak.ended", { call_control_id: cid });
      await wait(340);
    }
  }
  return actions.slice(m);
}

const transferRows = () => db.query(`SELECT organization_id, caller_number, target_number, outcome, source FROM transfer_events ORDER BY rowid`).all() as any[];

// ── A. Business line: press 3, the owner does not pick up ───────────────────
test("business line, press 3, owner misses: the caller is told we will call back and the owner is alerted", async () => {
  const cid = "in-missed-1";
  await postEvent("call.initiated", { call_control_id: cid, to: BUSINESS_LINE, from: CALLER });
  await wait(1200); // the bilingual opening prompt goes out on a 600 ms timer
  await postEvent("call.dtmf.received", { call_control_id: cid, digit: "1" }); // English
  await settleSpeaks(cid, 0);
  await finishSpeaking(cid, 0);

  // Press 3 → the owner's mobile is dialled from the business line.
  const pressMark = actions.length;
  const dialsBefore = dials.length;
  await postEvent("call.dtmf.received", { call_control_id: cid, digit: "3" });
  expect(await waitFor(() => dials.length === dialsBefore + 1)).toBe(true);
  expect(dials[dials.length - 1]).toEqual({ to: OWNER_MOBILE, from: BUSINESS_LINE });
  // "Transferring now. Please hold." finishes playing while the owner's phone rings.
  await finishSpeaking(cid, pressMark);
  expect(speaksSince(pressMark, cid).join(" ")).toContain("Transferring now");
  const ownerCid = `sim-dial-${dials.length}`;

  // The owner's phone rings and is never answered — it hangs up unanswered.
  await postEvent("call.initiated", { call_control_id: ownerCid, to: OWNER_MOBILE, from: BUSINESS_LINE });
  await wait(250);
  const mailBefore = emails.length;
  const mark = actions.length;
  await postEvent("call.hangup", { call_control_id: ownerCid, to: OWNER_MOBILE, from: BUSINESS_LINE });
  await settleSpeaks(cid, mark);

  const heard = speaksSince(mark, cid).join(" ");
  expect(heard).toContain("No one is available right now");
  expect(heard).toContain("call you back");
  // No gather is armed over the closing line, and the caller's leg is ended.
  await finishSpeaking(cid, mark);
  expect(cmdsSince(mark, cid, "gather").length).toBe(0);
  expect(await waitFor(() => cmdsSince(mark, cid, "hangup").length === 1)).toBe(true);

  // The owner is alerted by email (texting is off for this business).
  const mail = await waitForValue(() => emails.length > mailBefore ? emails[emails.length - 1] : null);
  expect(mail?.to).toBe("owner@example.test");
  expect(mail?.subject).toContain("Missed transfer");
  expect(mail?.body).toContain(CALLER);

  // And the attempt is recorded so Call outcomes shows it.
  expect(await waitFor(() => transferRows().some((r) => r.outcome === "missed" && r.source === "inbound"))).toBe(true);
  expect(transferRows().find((r) => r.outcome === "missed" && r.source === "inbound")).toMatchObject({
    organization_id: "org1", caller_number: CALLER, target_number: OWNER_MOBILE,
  });
});

// ── B. Reminder call: option 3, the owner picks up ──────────────────────────
let reminderSeq = 0;
/** One appointment + contact + a due 24h_call reminder row, and the dial the sweep makes for it. */
async function dueReminderCall(): Promise<{ cid: string; phone: string; reminderId: string }> {
  reminderSeq += 1;
  const phone = `+1555000${3000 + reminderSeq}`;
  const apptId = `appt-${reminderSeq}`;
  const contactId = `contact-${reminderSeq}`;
  const reminderId = `rem-${reminderSeq}`;
  db.query(`INSERT INTO contacts (id, organization_id, first_name, phone, email, preferred_language, reminder_calls_opt_out)
            VALUES (?,?,?,?,?,?,?)`).run(contactId, "org1", "Dana", phone, null, "en", 0);
  db.query(`INSERT INTO appointments (id, organization_id, contact_id, title, start_time, status, service_type, is_demo)
            VALUES (?,?,?,?,?,?,?,?)`).run(
    apptId, "org1", contactId, "AC tune-up", new Date(Date.now() + 25 * 3600 * 1000).toISOString(),
    "confirmed", "AC tune-up", 0,
  );
  db.query(`INSERT INTO appointment_reminders (id, appointment_id, organization_id, reminder_type, scheduled_at,
            status, channel, recipient_phone) VALUES (?,?,?,?,?,?,?,?)`).run(
    reminderId, apptId, "org1", "24h_call", new Date(Date.now() - 60_000).toISOString(), "pending", "voice", phone,
  );
  const dialsBefore = dials.length;
  expect(await waitFor(() => dials.length > dialsBefore)).toBe(true);
  expect(dials[dials.length - 1]).toEqual({ to: phone, from: BUSINESS_LINE });
  const cid = `sim-dial-${dials.length}`;
  // Answer the reminder call and let the script play, so option 3 is pressed the way a customer
  // would: mid-call, after hearing the reminder.
  await postEvent("call.initiated", { call_control_id: cid, to: phone, from: BUSINESS_LINE });
  await wait(200);
  const mark = actions.length;
  await postEvent("call.answered", { call_control_id: cid, to: phone, from: BUSINESS_LINE });
  await settleSpeaks(cid, mark);
  await finishSpeaking(cid, mark);
  return { cid, phone, reminderId };
}

test("reminder call, press 3: the owner is dialled from the business line and the legs are bridged", async () => {
  const { cid, phone } = await dueReminderCall();

  const mark = actions.length;
  const dialsBefore = dials.length;
  await postEvent("call.dtmf.received", { call_control_id: cid, digit: "3" });
  expect(await waitFor(() => dials.length === dialsBefore + 1)).toBe(true);
  expect(dials[dials.length - 1]).toEqual({ to: OWNER_MOBILE, from: BUSINESS_LINE });
  await settleSpeaks(cid, mark);
  expect(speaksSince(mark, cid).join(" ")).toContain("Transferring now");
  const ownerCid = `sim-dial-${dials.length}`;

  await postEvent("call.initiated", { call_control_id: ownerCid, to: OWNER_MOBILE, from: BUSINESS_LINE });
  await wait(250);
  // The owner's leg never hears the inbound welcome script.
  expect(actions.filter((a) => a.cid === ownerCid && a.action === "speak").length).toBe(0);
  await postEvent("call.answered", { call_control_id: ownerCid, to: OWNER_MOBILE, from: BUSINESS_LINE });
  expect(await waitFor(() => cmdsSince(mark, cid, "bridge").length === 1)).toBe(true);
  const bridge = cmdsSince(mark, cid, "bridge")[0];
  expect(bridge.body.call_control_id).toBe(ownerCid);

  const row = transferRows().find((r) => r.caller_number === phone);
  expect(row).toMatchObject({ outcome: "bridged", source: "reminder_call", target_number: OWNER_MOBILE });

  // Owner hangs up after talking → the reminder leg is closed too, no inbound summary.
  const hangupsBefore = actions.filter((a) => a.action === "hangup" && a.cid === cid).length;
  await postEvent("call.hangup", { call_control_id: ownerCid, to: OWNER_MOBILE, from: BUSINESS_LINE });
  expect(await waitFor(() => actions.filter((a) => a.action === "hangup" && a.cid === cid).length === hangupsBefore + 1)).toBe(true);
});

// ── C. Reminder call: option 3, the owner does not pick up ──────────────────
test("reminder call, press 3, owner misses: the caller is told we will call back and the owner is alerted", async () => {
  const { cid, phone } = await dueReminderCall();

  const pressMark = actions.length;
  const dialsBefore = dials.length;
  await postEvent("call.dtmf.received", { call_control_id: cid, digit: "3" });
  expect(await waitFor(() => dials.length === dialsBefore + 1)).toBe(true);
  const ownerCid = `sim-dial-${dials.length}`;
  await postEvent("call.initiated", { call_control_id: ownerCid, to: OWNER_MOBILE, from: BUSINESS_LINE });
  await wait(250);
  await finishSpeaking(cid, pressMark);

  const mailBefore = emails.length;
  const mark = actions.length;
  await postEvent("call.hangup", { call_control_id: ownerCid, to: OWNER_MOBILE, from: BUSINESS_LINE });
  await settleSpeaks(cid, mark);

  // The customer who was reminded must not be left on a silent line.
  const heard = speaksSince(mark, cid).join(" ");
  expect(heard).toContain("No one is available right now");
  expect(heard).toContain("call you back");
  await finishSpeaking(cid, mark);
  expect(cmdsSince(mark, cid, "gather").length).toBe(0);
  expect(await waitFor(() => cmdsSince(mark, cid, "hangup").length === 1)).toBe(true);

  const mail = await waitForValue(() => emails.length > mailBefore ? emails[emails.length - 1] : null);
  expect(mail?.to).toBe("owner@example.test");
  expect(mail?.subject).toContain("Missed transfer");
  expect(mail?.body).toContain(phone);

  expect(await waitFor(() => transferRows().some((r) => r.caller_number === phone && r.outcome === "missed"))).toBe(true);
  expect(transferRows().find((r) => r.caller_number === phone && r.outcome === "missed")).toMatchObject({
    source: "reminder_call", target_number: OWNER_MOBILE,
  });
});
