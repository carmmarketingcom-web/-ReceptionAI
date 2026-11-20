/**
 * A reminder or follow-up must never reach a customer twice, and a restart must not lose one.
 *
 * What went wrong: processDueReminders() selected every due 'pending' row and only marked it
 * 'sent' AFTER the provider call returned. Two overlapping ticks (the 5-minute setInterval does
 * not await), a slow tick, or a crash mid-send therefore handed the same row to two senders.
 * Nothing stopped two rows of the same kind being scheduled for one appointment either, so a
 * retried booking inserted the whole set again.
 *
 * This test boots the REAL serve.ts with Postgres, Resend and Telnyx replaced and proves, end
 * to end:
 *   • two ticks running at once send a due reminder ONCE (the row is claimed before any send);
 *   • a claim abandoned by a crash is marked failed and is NOT re-sent, while the row that was
 *     genuinely pending still goes out once;
 *   • a follow-up more than 24 hours late expires instead of arriving days after the visit,
 *     and a 24h reminder in the same state still sends;
 *   • the database refuses a second row of the same kind for one appointment;
 *   • a slow tick cannot overlap itself, and both serve.ts trees carry the identical blocks.
 *
 * No production row, email, text or call is touched: the "database" is an in-memory SQLite
 * file and every outbound request is intercepted.
 *
 * Run: bun run test scripts/reminder-claim.test.ts
 */
import { test, expect, mock, beforeAll } from "bun:test";
import { Database } from "bun:sqlite";

const PORT = 3231;
const SECRET = "test-cron-secret";
const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

const rootSrc = await Bun.file(`${REPO}/serve.ts`).text();
const siteSrc = await Bun.file(`${REPO}/site/serve.ts`).text();
const migration = await Bun.file(`${REPO}/backend/db/migrations/0018_reminder_claim.sql`).text();

// ── The in-memory stand-in for Postgres ─────────────────────────────────────
const db = new Database(":memory:");
db.run(`CREATE TABLE organizations (id TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT, sms_enabled INTEGER DEFAULT 0)`);
db.run(`INSERT INTO organizations VALUES ('org-1', 'Carm Marketing', '+15550000009', 'owner@example.test', 0)`);
db.run(`CREATE TABLE phone_numbers (id TEXT PRIMARY KEY, organization_id TEXT, phone_number TEXT, is_active INTEGER DEFAULT 1)`);
db.run(`INSERT INTO phone_numbers VALUES ('pn-1', 'org-1', '+15550000020', 1)`);
db.run(`CREATE TABLE contacts (id TEXT PRIMARY KEY, organization_id TEXT, phone TEXT, email TEXT, reminder_calls_opt_out INTEGER DEFAULT 0)`);
db.run(`CREATE TABLE appointments (id TEXT PRIMARY KEY, organization_id TEXT, contact_id TEXT, title TEXT,
        reminder_sent_at TEXT, reminder_sent_count TEXT, updated_at TEXT)`);
db.run(`CREATE TABLE appointment_reminders (id TEXT PRIMARY KEY, appointment_id TEXT, organization_id TEXT,
        reminder_type TEXT, recipient_phone TEXT, recipient_email TEXT, message_body TEXT,
        scheduled_at TEXT, status TEXT, channel TEXT, sent_at TEXT, error_message TEXT,
        result TEXT, claimed_at TEXT, provider_message_id TEXT, created_at TEXT, updated_at TEXT)`);
// The rule the migration adds, present here so the same statement shape is exercised.
db.run(`CREATE UNIQUE INDEX appointment_reminders_appt_kind ON appointment_reminders (appointment_id, reminder_type)`);

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
    // SQLite has no ADD COLUMN IF NOT EXISTS; the server's schema bootstrap is idempotent
    // and so is this, by ignoring a column that is already there.
    const alter = text.match(/^\s*ALTER TABLE\s+(\w+)\s+ADD COLUMN\s+(?:IF NOT EXISTS\s+)?(\w+)\s+([A-Za-z]+)/i);
    if (alter) {
      try { db.run(`ALTER TABLE ${alter[1]} ADD COLUMN ${alter[2]} ${alter[3]}`); } catch { /* already there */ }
      return Promise.resolve([]);
    }
    const stmt = db.query(text);
    if (/^\s*select/i.test(text) || /\breturning\b/i.test(text)) return Promise.resolve(stmt.all(...params));
    stmt.run(...params);
    return Promise.resolve([]);
  } catch (err) {
    return Promise.reject(err);
  }
}
mock.module("@neondatabase/serverless", () => ({ neon: () => sqlTag }));

// ── Every outbound request is intercepted: no real email, text or call ──────
const emails: { to: string; subject: string }[] = [];
const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : (input?.url ?? String(input));
  if (url.includes("api.resend.com/emails")) {
    const body = JSON.parse(init?.body || "{}");
    emails.push({ to: body.to, subject: body.subject });
    return new Response(JSON.stringify({ id: `email_fake_${emails.length}` }), { status: 200 });
  }
  if (url.includes("api.telnyx.com")) return new Response(JSON.stringify({ data: { balance: "80.00" } }), { status: 200 });
  if (url.includes("127.0.0.1") || url.includes("localhost")) return realFetch(input, init);
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}) as any;

const logs: string[] = [];
const realLog = console.log.bind(console);

function seedReminder(p: {
  id: string; appt: string; type: string; scheduledAt: string; status?: string;
  email?: string | null; claimedAt?: string | null;
}): void {
  db.run(
    `INSERT INTO appointment_reminders
       (id, appointment_id, organization_id, reminder_type, scheduled_at, status, channel,
        recipient_phone, recipient_email, message_body, claimed_at, created_at, updated_at)
     VALUES (?, ?, 'org-1', ?, ?, ?, 'email', NULL, ?, 'See you soon.', ?, ?, NULL)`,
    [p.id, p.appt, p.type, p.scheduledAt, p.status || "pending", p.email ?? null, p.claimedAt ?? null, "2026-01-01T00:00:00.000Z"],
  );
}

function row(id: string): any {
  return db.query("SELECT * FROM appointment_reminders WHERE id = ?").get(id);
}

function emailsTo(address: string): number {
  return emails.filter((e) => e.to === address).length;
}

const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
const HOUR = 60 * 60 * 1000;

async function tick(): Promise<any> {
  const res = await fetch(`http://127.0.0.1:${PORT}/api/reminders/process?secret=${SECRET}`);
  return res.json();
}

beforeAll(async () => {
  console.log = (...args: any[]) => { logs.push(args.map(String).join(" ")); };
  process.env.PORT = String(PORT);
  process.env.JWT_SECRET = "test-only-jwt-secret-that-is-long-enough-32";
  process.env.DATABASE_URL = "postgres://fake@localhost/fake";
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.CRON_SECRET = SECRET;
  process.env.NODE_ENV = "development"; // not "test": the module must boot normally
  process.env.REMINDER_TIMER = "off";   // this test drives the sweep itself
  delete process.env.TELNYX_API_KEY;
  process.chdir(REPO);
  await import("../serve.ts");

  // Wait for the server to answer before the first sweep.
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/health`);
      if (res.ok || res.status === 500) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("server did not start");
});

// ── 1. Two ticks at once: one send ──────────────────────────────────────────
test("a due reminder is claimed, so two concurrent ticks send it once", async () => {
  db.run(`INSERT INTO appointments VALUES ('appt-a', 'org-1', NULL, 'AC tune-up', NULL, NULL, NULL)`);
  seedReminder({
    id: "rem-a", appt: "appt-a", type: "24h_before",
    scheduledAt: iso(60 * 1000), email: "a@example.test",
  });

  const [first, second] = await Promise.all([tick(), tick()]);

  expect(emailsTo("a@example.test")).toBe(1);
  expect(row("rem-a").status).toBe("sent");
  // Both ticks answered, and between them the row was counted once.
  expect((first.sent || 0) + (second.sent || 0)).toBe(1);
  expect((first.processed || 0) + (second.processed || 0)).toBe(1);
});

// ── 2. A crash mid-send: visible, never re-sent ─────────────────────────────
test("a claim abandoned by a crash is failed, not sent again, and the pending row still goes out", async () => {
  db.run(`INSERT INTO appointments VALUES ('appt-b1', 'org-1', NULL, 'Furnace repair', NULL, NULL, NULL)`);
  db.run(`INSERT INTO appointments VALUES ('appt-b2', 'org-1', NULL, 'Duct cleaning', NULL, NULL, NULL)`);
  // Claimed half an hour ago by a tick that then died: the customer may already have it.
  seedReminder({
    id: "rem-b1", appt: "appt-b1", type: "24h_before",
    scheduledAt: iso(2 * HOUR), email: "b1@example.test",
    status: "sending", claimedAt: iso(30 * 60 * 1000),
  });
  seedReminder({
    id: "rem-b2", appt: "appt-b2", type: "24h_before",
    scheduledAt: iso(60 * 1000), email: "b2@example.test",
  });

  const result = await tick();

  const crashed = row("rem-b1");
  expect(crashed.status).toBe("failed");
  expect(crashed.error_message).toBe("claimed but never sent");
  expect(emailsTo("b1@example.test")).toBe(0); // the whole point: never re-sent
  expect(result.recovered).toBe(1);

  expect(row("rem-b2").status).toBe("sent");
  expect(emailsTo("b2@example.test")).toBe(1);
});

// ── 3. A follow-up that is a day late is expired, not sent ──────────────────
test("a stale follow-up expires instead of arriving days late, while a late 24h reminder still sends", async () => {
  db.run(`INSERT INTO appointments VALUES ('appt-c1', 'org-1', NULL, 'Spring check', NULL, NULL, NULL)`);
  db.run(`INSERT INTO appointments VALUES ('appt-c2', 'org-1', NULL, 'Panel upgrade', NULL, NULL, NULL)`);
  seedReminder({
    id: "rem-c1", appt: "appt-c1", type: "follow_up",
    scheduledAt: iso(30 * HOUR), email: "c1@example.test",
  });
  seedReminder({
    id: "rem-c2", appt: "appt-c2", type: "24h_before",
    scheduledAt: iso(30 * HOUR), email: "c2@example.test",
  });

  const result = await tick();

  const stale = row("rem-c1");
  expect(stale.status).toBe("expired");
  expect(emailsTo("c1@example.test")).toBe(0);
  expect(result.expired).toBe(1);

  // Only follow-ups get the cutoff: a late reminder is still useful.
  expect(row("rem-c2").status).toBe("sent");
  expect(emailsTo("c2@example.test")).toBe(1);
});

// ── 4. One appointment, one row of each kind — enforced by the database ─────
test("an appointment cannot hold two rows of the same kind", async () => {
  const insert = (id: string) => sqlTag`
    INSERT INTO appointment_reminders
      (id, appointment_id, organization_id, reminder_type, scheduled_at, status, channel,
       recipient_phone, recipient_email, message_body)
    VALUES
      (${id}, 'appt-d', 'org-1', '24h_before', '2027-01-01T00:00:00.000Z', 'pending', 'email',
       NULL, 'd@example.test', 'See you soon.')
    ON CONFLICT (appointment_id, reminder_type) DO NOTHING
  `;
  // A retried booking schedules the same set again: the second insert changes nothing.
  await insert("rem-d1");
  await insert("rem-d2");
  const count = db.query("SELECT COUNT(*) AS n FROM appointment_reminders WHERE appointment_id = 'appt-d'").get() as any;
  expect(count.n).toBe(1);

  // And the rule is the database's, not the insert's: a plain duplicate is rejected.
  expect(() => db.run(
    `INSERT INTO appointment_reminders (id, appointment_id, organization_id, reminder_type, scheduled_at, status)
     VALUES ('rem-d3', 'appt-d', 'org-1', '24h_before', '2027-01-01T00:00:00.000Z', 'pending')`,
  )).toThrow();
});

// ── 5. The code itself: claim first, one tick at a time, both trees ─────────
function sweepBlock(src: string): string {
  const start = src.indexOf("async function processDueReminders()");
  const end = src.indexOf("// ── In-process reminder timer", start);
  if (start < 0 || end < 0) throw new Error("reminder sweep block missing");
  return src.slice(start, end);
}

test("both serve.ts trees claim before sending and never overlap themselves", () => {
  const root = sweepBlock(rootSrc);
  const site = sweepBlock(siteSrc);
  expect(root).toBe(site);

  // Claim before send, in one statement.
  expect(root).toContain("SET status='sending', claimed_at=NOW()");
  expect(root).toContain("FOR UPDATE SKIP LOCKED");
  expect(root).toContain("RETURNING id AS reminder_id");
  // A dead claim is failed, never put back in the queue.
  expect(root).toContain("'claimed but never sent'");
  // Exactly one place hands a row back to 'pending': a reminder call that was deliberately
  // deferred (outside calling hours, or a balance we cannot see).
  expect((root.match(/SET status='pending'/g) || []).length).toBe(1);
  // A follow-up has the cutoff; nothing else does.
  expect(root).toContain("reminder_type='follow_up' AND scheduled_at < ${followUpCutoff}");
  // The provider id is recorded when the sender returns one.
  expect(root).toContain("provider_message_id=${providerMessageId}");

  for (const src of [rootSrc, siteSrc]) {
    const start = src.indexOf("// ── In-process reminder timer");
    const timer = src.slice(start, src.indexOf("const freePort =", start));
    expect(timer).toContain("let reminderTickRunning = false;");
    expect(timer).toContain("tick skipped");
    expect(timer).toContain("reminderTickRunning = false;");
    // A scheduled booking never inserts a second row of the same kind.
    expect(src).toContain("ON CONFLICT (appointment_id, reminder_type) DO NOTHING");
    // A booking whose reminders could not be scheduled is not silent.
    expect(src).toContain('"reminder_schedule_failed"');
  }

  // The migration carries the same rule for a database that is set up from scratch.
  expect(migration).toContain("claimed_at");
  expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS appointment_reminders_appt_kind");
  expect(migration).toContain("(appointment_id, reminder_type)");

  console.log = realLog;
});
