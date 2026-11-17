/**
 * A finished call must always record WHEN it finished, and a call that never got its hangup
 * must not stay open forever.
 *
 * What went wrong: three conversations sat at status 'ended' with ended_at IS NULL, so they
 * contributed nothing to AI-minutes (counted as ended_at - started_at). The cause was a
 * finish path that wrote the status without a finish time. And a call whose hangup never
 * reached the server (restart mid-call, dropped webhook) stays 'active' forever, invisible
 * to the same count.
 *
 * This test proves, in BOTH serve.ts trees:
 *   • every path that writes a terminal conversation status writes ended_at in the SAME
 *     statement — the two can never be split again;
 *   • the stale-call sweeper runs on the existing 5-minute in-process timer and logs one
 *     line per pass;
 *   • booting the REAL server with the timer shortened to a few hundred ms closes a call
 *     left open past six hours, taking the finish time from the conversation's latest
 *     message (started_at when it has none), while a fresh call, a web chat and the
 *     historical 'ended' rows with a NULL ended_at are all left alone (fake Postgres — no
 *     real row, no real vendor).
 *
 * Run: bun run test scripts/stale-call-sweeper.test.ts
 */
import { test, expect, mock, beforeAll } from "bun:test";
import { Database } from "bun:sqlite";

const PORT = 3221;
const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

const rootSrc = await Bun.file(`${REPO}/serve.ts`).text();
const siteSrc = await Bun.file(`${REPO}/site/serve.ts`).text();

// ── 1. A terminal status and its finish stamp are one write ──────────────────
test("every finish path writes status and ended_at together", () => {
  for (const [name, src] of [["root", rootSrc], ["site", siteSrc]] as const) {
    // The only code that can set a conversation to a finished status.
    const writes = src.split("UPDATE conversations").length - 1;
    expect(writes).toBeGreaterThan(0);
    const start = src.indexOf("async function saveCallerHistory(cs: CallState)");
    expect(start).toBeGreaterThan(-1);
    const fn = src.slice(start, src.indexOf("async function", start + 10));
    const update = fn.slice(fn.indexOf("UPDATE conversations SET"), fn.indexOf("RETURNING id"));
    expect(update).toContain("status = ${status}::conversation_status");
    expect(update).toContain("ended_at = ${endedAt.toISOString()}");
    // A stale conversation id falls through to the INSERT instead of losing the call.
    expect(fn).toContain("if (!finished[0]) conversationId = null;");
    expect(name).toBe(name);
  }
});

// ── 2. The sweeper is wired into the existing timer ───────────────────────
test("the 5-minute timer runs the stale-call sweeper and logs one line per pass", () => {
  for (const src of [rootSrc, siteSrc]) {
    expect(src).toContain("async function sweepStaleCalls()");
    const timerStart = src.indexOf("// ── In-process reminder timer");
    const timer = src.slice(timerStart, src.indexOf("const freePort =", timerStart));
    expect(timer).toContain("await sweepStaleCalls()");
    expect(timer).toContain("[Sweeper] stale calls");
    expect(timer).toContain("5 * 60 * 1000");
    const fn = src.slice(src.indexOf("// ── Stale-call sweeper"));
    const body = fn.slice(0, fn.indexOf("const freePort"));
    // Six hours, and only calls that are still open — finished rows are never touched.
    expect(body).toContain("6 * 60 * 60 * 1000");
    expect(body).toContain("c.status = 'active'::conversation_status");
    expect(body).toContain("c.ended_at IS NULL");
    // The finish time is a real moment on the call, never an invented duration.
    expect(body).toContain("SELECT MAX(m.created_at) FROM messages m");
    expect(body).toContain("c.started_at,");
    expect(body).toContain("c.created_at");
  }
});

// ── 3. The sweeper really closes a stale call, and leaves everything else alone ──
const db = new Database(":memory:");
// Minimal tables the reminder sweep and the sweeper touch.
db.run(`CREATE TABLE organizations (id TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT, sms_enabled INTEGER DEFAULT 0)`);
db.run(`INSERT INTO organizations VALUES ('org-1', 'Carm Marketing', '+15550000009', 'owner@example.test', 0)`);
db.run(`CREATE TABLE phone_numbers (id TEXT PRIMARY KEY, organization_id TEXT, phone_number TEXT, is_active INTEGER DEFAULT 1)`);
db.run(`CREATE TABLE contacts (id TEXT PRIMARY KEY, organization_id TEXT, phone TEXT, email TEXT)`);
db.run(`CREATE TABLE appointments (id TEXT PRIMARY KEY, organization_id TEXT, contact_id TEXT, title TEXT, reminder_sent_at TEXT, reminder_sent_count TEXT, updated_at TEXT)`);
db.run(`CREATE TABLE appointment_reminders (id TEXT PRIMARY KEY, appointment_id TEXT, organization_id TEXT, reminder_type TEXT, recipient_phone TEXT, recipient_email TEXT, message_body TEXT, scheduled_at TEXT, status TEXT, channel TEXT, sent_at TEXT, error_message TEXT, updated_at TEXT)`);
db.run(`CREATE TABLE conversations (id TEXT PRIMARY KEY, organization_id TEXT, type TEXT, status TEXT, started_at TEXT, ended_at TEXT, created_at TEXT, updated_at TEXT)`);
db.run(`CREATE TABLE messages (id TEXT PRIMARY KEY, conversation_id TEXT, created_at TEXT)`);

const NOW = Date.now();
const hoursAgo = (h: number) => new Date(NOW - h * 60 * 60 * 1000).toISOString();

// Open for 8 hours, last thing that happened on it 7 hours ago → that is its finish time.
db.run(`INSERT INTO conversations VALUES ('c-stale-msg', 'org-1', 'call', 'active', ?, NULL, ?, NULL)`, hoursAgo(8), hoursAgo(8));
db.run(`INSERT INTO messages VALUES ('m-1', 'c-stale-msg', ?)`, hoursAgo(7));
// Open for 7 hours with nothing on it → started_at is the finish time.
db.run(`INSERT INTO conversations VALUES ('c-stale-nomsg', 'org-1', 'call', 'active', ?, NULL, ?, NULL)`, hoursAgo(7), hoursAgo(7));
// Still in progress: must not be touched.
db.run(`INSERT INTO conversations VALUES ('c-fresh', 'org-1', 'call', 'active', ?, NULL, ?, NULL)`, hoursAgo(0.1), hoursAgo(0.1));
// The three historical rows the owner asked us to leave alone.
db.run(`INSERT INTO conversations VALUES ('c-legacy-ended', 'org-1', 'call', 'ended', ?, NULL, ?, NULL)`, hoursAgo(8), hoursAgo(8));
db.run(`INSERT INTO conversations VALUES ('c-legacy-missed', 'org-1', 'call', 'missed', ?, NULL, ?, NULL)`, hoursAgo(8), hoursAgo(8));
// A web chat is not a call.
db.run(`INSERT INTO conversations VALUES ('c-chat', 'org-1', 'chat', 'active', ?, NULL, ?, NULL)`, hoursAgo(8), hoursAgo(8));

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

const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : (input?.url ?? String(input));
  if (url.includes("api.telnyx.com")) return new Response(JSON.stingify({ data: { balance: "80.00" } }), { status: 200 });
  if (url.includes("127.0.0.1") || url.includes("localhost")) return realFetch(input, init);
  return new Response(JSON.stingify({ ok: true }), { status: 200 });
}) as any;

const logs: string[] = [];
const realLog = console.log.bind(console);

beforeAll(async () => {
  console.log = (...args: any[]) => { logs.push(args.map(String).join(" ")); };
  process.env.PORT = String(PORT);
  process.env.JWT_SECRET = "test-only-jwt-secret-that-is-long-enough-32";
  process.env.DATABASE_URL = "postgres://fake@localhost/fake";
  process.env.NODE_ENV = "development"; // bun test sets "test", which would keep the timer off
  process.env.REMINDER_TICK_MS = "200";
  delete process.env.TELNYX_API_KEY;
  process.chdir(REPO);
  await import("../serve.ts");
});

test("a call left open past six hours is closed with a real finish time", async () => {
  let line: string | undefined;
  for (let i = 0; i < 80; i++) {
    line = logs.find((l) => l.startsWith("[Sweeper] stale calls"));
    if (line) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  expect(line).toBeTruthy();
  expect(line).toContain("closed=2");

  const read = (id: string) => db.query(`SELECT status, ended_at FROM conversations WHERE id = ?`).get(id) as any;

  // The finish time is the last thing that happened on the call…
  const withMsg = read("c-stale-msg");
  expect(withMsg.status).toBe("ended");
  expect(String(withMsg.ended_at)).toBe(hoursAgo(7));
  // …or the start of the call when it has no messages.
  const noMsg = read("c-stale-nomsg");
  expect(noMsg.status).toBe("ended");
  expect(String(noMsg.ended_at)).toBe(hoursAgo(7));

  // Untouched: in progress, web chat, and the historical finished rows with no end.
  expect(read("c-fresh")).toEqual({ status: "active", ended_at: null });
  expect(read("c-chat")).toEqual({ status: "active", ended_at: null });
  expect(read("c-legacy-ended")).toEqual({ status: "ended", ended_at: null });
  expect(read("c-legacy-missed")).toEqual({ status: "missed", ended_at: null });
  console.log = realLog;
});
