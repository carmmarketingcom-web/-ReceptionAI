/**
 * The dashboard's "Call outcomes" page must be fed by an ORG endpoint that returns real rows,
 * in both trees, and the voice server must record transfer outcomes at every transfer point.
 *
 * Why this exists: reminder-call outcomes lived in `appointment_reminders.result` and transfer
 * outcomes only in the server log, so an owner could not see whether their customer was reminded
 * or whether a caller actually reached them. This test pins the three things that make the screen
 * honest:
 *   - the endpoint exists in BOTH serve.ts trees, byte-identically, and is org-authenticated;
 *   - the payload comes from the one shared builder (`src/lib/call-outcomes.ts`), which returns
 *     empty lists and zeroed summaries for an empty org and never invents a row;
 *   - all four transfer outcomes are written, with `source='reminder_call'` for option 3 on a
 *     reminder call, and every write is wrapped so a failed insert cannot break a live call.
 *
 * Run: bun run test scripts/call-outcomes.test.ts
 */
import { test, expect } from "bun:test";
import {
  buildCallOutcomes,
  normalizeCallOutcomes,
  REMINDER_CALL_RESULTS,
  TRANSFER_OUTCOMES,
} from "../src/lib/call-outcomes";

const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const root = await Bun.file(`${REPO}/serve.ts`).text();
const site = await Bun.file(`${REPO}/site/serve.ts`).text();
const rootLib = await Bun.file(`${REPO}/src/lib/call-outcomes.ts`).text();
const siteLib = await Bun.file(`${REPO}/site/src/lib/call-outcomes.ts`).text();
const rootPage = await Bun.file(`${REPO}/src/routes/dashboard/call-outcomes.tsx`).text();
const sitePage = await Bun.file(`${REPO}/site/src/routes/dashboard/call-outcomes.tsx`).text();
const rootHooks = await Bun.file(`${REPO}/src/lib/hooks/use-data.ts`).text();
const siteHooks = await Bun.file(`${REPO}/site/src/lib/hooks/use-data.ts`).text();
const migration = await Bun.file(`${REPO}/backend/db/migrations/0013_transfer_events.sql`).text();

function grabBetween(src: string, start: string, end: string): string {
  const a = src.indexOf(start);
  if (a < 0) throw new Error(`marker not found: ${start}`);
  const b = src.indexOf(end, a);
  if (b < 0) throw new Error(`end marker not found: ${end}`);
  return src.slice(a, b);
}

const HANDLER = 'if (pathname === "/api/dashboard/call-outcomes" && req.method === "GET") {';
const AFTER_HANDLER = "// ── Analytics (real counts only";

// ── 1. The endpoint, in both trees, byte-identically ──────────────────────
test("/api/dashboard/call-outcomes exists in both serve.ts trees and the handlers are identical", () => {
  const a = grabBetween(root, HANDLER, AFTER_HANDLER);
  const b = grabBetween(site, HANDLER, AFTER_HANDLER);
  expect(a).toBe(b);
  // Org-scoped, authenticated before a DB connection is opened…
  expect(a).toContain("await requireOrgAuth(req)");
  expect(a.indexOf("requireOrgAuth")).toBeLessThan(a.indexOf("DATABASE_URL"));
  // …and built from the ONE shared implementation, never a second copy of the queries.
  expect(a).toContain("buildCallOutcomes(");
  expect(a).not.toContain("FROM appointment_reminders");
  expect(a).not.toContain("FROM transfer_events");
});

test("the shared builder is byte-identical in both trees", () => {
  expect(siteLib).toBe(rootLib);
  // Both reads are tenant-scoped and both lists are newest-first.
  expect(rootLib).toContain("WHERE ar.organization_id = ${organizationId}");
  expect(rootLib).toContain("WHERE organization_id = ${organizationId}");
  expect(rootLib).toContain("ORDER BY ar.scheduled_at DESC");
  expect(rootLib).toContain("ORDER BY created_at DESC");
  // Only the reminder CALL rows: channel='voice' + reminder_type='24h_call'.
  expect(rootLib).toContain("ar.channel = 'voice'");
  expect(rootLib).toContain("ar.reminder_type = '24h_call'");
});

// ── 2. Empty organization: empty lists, zeroed summaries, no invented rows ─
function fakeSql(rows: { reminders?: any[]; transfers?: any[] | Error }) {
  return async (strings: TemplateStringsArray) => {
    const text = strings.join("?");
    if (/FROM appointment_reminders/.test(text)) return rows.reminders ?? [];
    if (/FROM transfer_events/.test(text)) {
      if (rows.transfers instanceof Error) throw rows.transfers;
      return rows.transfers ?? [];
    }
    throw new Error(`unexpected query: ${text.slice(0, 80)}`);
  };
}

test("an org with no calls gets empty lists and zeroed summaries — nothing fabricated", async () => {
  const payload = await buildCallOutcomes(fakeSql({}) as any, "org-empty", 50);
  expect(payload.reminderCalls).toEqual([]);
  expect(payload.transfers).toEqual([]);
  expect(payload.transferReadError).toBe(null);
  for (const key of REMINDER_CALL_RESULTS) expect(payload.reminderSummary[key]).toBe(0);
  for (const key of TRANSFER_OUTCOMES) expect(payload.transferSummary[key]).toBe(0);
});

// ── 3. One reminder row + one transfer row come back shaped, and counted ──
test("a reminder call and a transfer are mapped to the documented shape and counted", async () => {
  const payload = await buildCallOutcomes(
    fakeSql({
      reminders: [
        {
          id: "rem-1",
          scheduled_at: "2026-11-18T14:00:00.000Z",
          sent_at: "2026-11-18T14:00:12.000Z",
          status: "sent",
          result: "confirmed",
          error_message: null,
          recipient_phone: "+17275550123",
          first_name: "Ana",
          last_name: "Ruiz",
          title: "AC tune-up",
          service_type: "HVAC",
          start_time: "2026-11-19T14:00:00.000Z",
        },
      ],
      transfers: [
        {
          id: "tr-1",
          created_at: "2026-11-18T14:05:00.000Z",
          caller_number: "+17275550999",
          target_number: "+17276377375",
          outcome: "bridged",
          language: "en",
          source: "reminder_call",
        },
      ],
    }) as any,
    "org-1",
    50,
  );

  expect(payload.reminderCalls).toEqual([
    {
      id: "rem-1",
      scheduledAt: "2026-11-18T14:00:00.000Z",
      sentAt: "2026-11-18T14:00:12.000Z",
      status: "sent",
      result: "confirmed",
      error: null,
      recipientPhone: "+17275550123",
      contactName: "Ana Ruiz",
      appointmentTitle: "AC tune-up",
      serviceType: "HVAC",
      appointmentStart: "2026-11-19T14:00:00.000Z",
    },
  ]);
  expect(payload.reminderSummary.confirmed).toBe(1);
  expect(payload.reminderSummary.dialed).toBe(0);

  expect(payload.transfers).toEqual([
    {
      id: "tr-1",
      createdAt: "2026-11-18T14:05:00.000Z",
      callerNumber: "+17275550999",
      targetNumber: "+17276377375",
      outcome: "bridged",
      language: "en",
      source: "reminder_call",
    },
  ]);
  expect(payload.transferSummary.bridged).toBe(1);
  expect(payload.transferSummary.missed).toBe(0);
});

test("a queued reminder (no result yet) counts in no summary bucket", async () => {
  const payload = await buildCallOutcomes(
    fakeSql({
      reminders: [
        {
          id: "rem-2",
          scheduled_at: "2026-11-20T14:00:00.000Z",
          sent_at: null,
          status: "pending",
          result: null,
          error_message: null,
          recipient_phone: "+17275550124",
          first_name: null,
          last_name: null,
          title: null,
          service_type: null,
          start_time: null,
        },
      ],
    }) as any,
    "org-1",
    50,
  );
  expect(payload.reminderCalls[0].result).toBe(null);
  expect(payload.reminderCalls[0].contactName).toBe(null);
  for (const key of REMINDER_CALL_RESULTS) expect(payload.reminderSummary[key]).toBe(0);
});

test("the limit is clamped to 1…200 and defaults to 50", async () => {
  expect((await buildCallOutcomes(fakeSql({}) as any, "org-1")).limit).toBe(50);
  expect((await buildCallOutcomes(fakeSql({}) as any, "org-1", "500")).limit).toBe(200);
  expect((await buildCallOutcomes(fakeSql({}) as any, "org-1", "0")).limit).toBe(1);
  expect((await buildCallOutcomes(fakeSql({}) as any, "org-1", "nope")).limit).toBe(50);
});

// ── 4. An unreadable transfer table says so, instead of "no transfers" ────
test("a missing transfer_events table is reported, not shown as 'no transfers'", async () => {
  const payload = await buildCallOutcomes(
    fakeSql({ transfers: new Error('relation "transfer_events" does not exist') }) as any,
    "org-1",
    50,
  );
  expect(payload.transfers).toEqual([]);
  expect(payload.transferReadError).toContain("transfer_events");
  // The reminder side still came back, so the page can show half the truth rather than nothing.
  expect(payload.reminderCalls).toEqual([]);
});

// ── 5. The renderer cannot throw ─────────────────────────────────────────
test("normalizeCallOutcomes never throws and always yields the full shape", () => {
  for (const input of [null, undefined, 0, "nope", [], {}, { reminderCalls: "x", transfers: 5 }]) {
    const view = normalizeCallOutcomes(input);
    expect(Array.isArray(view.reminderCalls)).toBe(true);
    expect(Array.isArray(view.transfers)).toBe(true);
    expect(typeof view.reminderSummary.confirmed).toBe("number");
    expect(typeof view.transferSummary.bridged).toBe("number");
    expect(typeof view.limit).toBe("number");
    expect(view.transferReadError).toBe(null);
  }
});

// ── 6. The voice server writes all four transfer outcomes, both trees ─────
test("all four transfer outcomes are recorded, with reminder_call sourced from option 3", () => {
  for (const [label, src] of [["serve.ts", root], ["site/serve.ts", site]] as const) {
    // One definition + four call sites.
    const calls = (src.match(/recordTransferEvent\(/g) || []).length;
    expect({ label, calls }).toEqual({ label, calls: 5 });
    for (const outcome of ["no_target", "failed", "bridged", "missed"]) {
      expect({ label, outcome, present: src.includes(`outcome: "${outcome}"`) }).toEqual({
        label,
        outcome,
        present: true,
      });
    }
    // Option 3 on a reminder call marks the source.
    expect(src).toContain('await transferToOwner(cid, pseudo, "reminder_call");');
    // The write is wrapped: a failed insert logs one line and never throws into the call.
    expect(src).toContain('console.error("[Transfer] outcome write failed:"');
    // The `missed` row is written before the owner is alerted.
    const missed = grabBetween(src, 'outcome: "missed"', "await deliverOwnerNotification({");
    expect(missed.length).toBeGreaterThan(0);
    // `bridged` only when the bridge command succeeded.
    expect(src).toContain('outcome: bridged ? "bridged" : "failed"');
  }
});

// ── 7. The migration is idempotent and matches the API ───────────────────
test("migration 0013 is idempotent and documents every outcome the code writes", () => {
  expect(migration).toContain("CREATE TABLE IF NOT EXISTS transfer_events");
  expect(migration).toContain("CREATE INDEX IF NOT EXISTS transfer_events_org_created_idx");
  expect(migration).toContain("organization_id uuid NOT NULL");
  expect(migration).toContain("source text NOT NULL DEFAULT 'inbound'");
  for (const outcome of ["bridged", "missed", "failed", "no_target"]) {
    expect(migration).toContain(outcome);
  }
});

// ── 8. The page: real endpoint, both trees, honest empty states ──────────
test("both Call outcomes pages fetch the org endpoint and show honest empty states", () => {
  expect(sitePage).toBe(rootPage);
  // The page reads the endpoint through the hook, which carries the path in both trees.
  expect(rootPage).toContain("useCallOutcomes(");
  for (const [label, hooks] of [["src", rootHooks], ["site/src", siteHooks]] as const) {
    expect({ label, url: hooks.includes("/api/dashboard/call-outcomes?limit=") }).toEqual({
      label,
      url: true,
    });
  }
  expect(rootPage).toContain("Call outcomes");
  expect(rootPage).toContain("No reminder calls yet");
  expect(rootPage).toContain("No transfers yet");
  // No demo/sample arrays, no placeholder numbers.
  expect(/sample|placeholder|mock|demo data/i.test(rootPage)).toBe(false);
  expect(rootPage).toContain("normalizeCallOutcomes");
  // The counts are labelled as "the rows shown", never as all-time totals.
  expect(rootPage).toContain("not all time");
});

test("the nav lists Call outcomes in both trees", async () => {
  for (const path of [`${REPO}/src/routes/dashboard.tsx`, `${REPO}/site/src/routes/dashboard.tsx`]) {
    const nav = await Bun.file(path).text();
    expect(nav).toContain('href: "/dashboard/call-outcomes"');
  }
});
