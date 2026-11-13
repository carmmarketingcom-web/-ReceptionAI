/**
 * The dashboard's AI-minutes bar must show REAL minutes for the calendar month.
 *
 * What went wrong: the bar read `usageMap["ai_minutes"]` from `usage_records`, and nothing
 * in the codebase ever wrote that record type — so every business saw "0 of 500" after
 * taking real calls. Real timing has always been on `conversations` (started_at / ended_at),
 * so the usage endpoint now derives the month's AI-minutes from those rows instead: elapsed
 * time per voice call, rounded up to a whole minute, skipping demo-line and missed calls.
 * usage_records is only the fallback for an org with no ended calls this month.
 *
 * This test seeds conversations and checks the arithmetic, and checks that BOTH serve.ts
 * trees and BOTH /api/billing route trees actually use it (the trees drift; a fix in one
 * tree alone has shipped as a no-op before).
 *
 * Counting only — nothing in the endpoint caps, blocks or bills a call.
 *
 * Run: bun run test scripts/ai-minutes-usage.test.ts
 */
import { test, expect } from "bun:test";
import { callAiMinutes, sumAiMinutes } from "../src/lib/ai-minutes";

const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const rootServe = await Bun.file(`${REPO}/serve.ts`).text();
const rootRoute = await Bun.file(`${REPO}/src/routes/api/billing.ts`).text();
const siteRoute = await Bun.file(`${REPO}/site/src/routes/api/billing.ts`).text();
const rootLib = await Bun.file(`${REPO}/src/lib/ai-minutes.ts`).text();
const siteLib = await Bun.file(`${REPO}/site/src/lib/ai-minutes.ts`).text();

// ── 1. Seeded conversations → minutes ────────────────────────────────────────
// Rows as the endpoint selects them: voice calls that were AI-handled, not demo, not
// missed, and already ended this month.
const seeded = [
  { startedAt: "2026-11-03T14:00:00.000Z", endedAt: "2026-11-03T14:02:30.000Z" }, // 2m30s → 3
  { startedAt: "2026-11-03T15:00:00.000Z", endedAt: "2026-11-03T15:00:20.000Z" }, // 20s    → 1
  { startedAt: "2026-11-04T09:00:00.000Z", endedAt: "2026-11-04T09:05:00.000Z" }, // 5m     → 5
  { startedAt: "2026-11-04T10:00:00.000Z", endedAt: "2026-11-04T10:00:00.000Z" }, // 0s     → 1
  { startedAt: "2026-11-05T11:00:00.000Z", endedAt: null },                        // ringing → 0
];

test("a call's AI time is its elapsed time rounded UP to a whole minute", () => {
  expect(callAiMinutes({ startedAt: "2026-11-03T14:00:00.000Z", endedAt: "2026-11-03T14:02:30.000Z" })).toBe(3);
  expect(callAiMinutes({ startedAt: "2026-11-03T15:00:00.000Z", endedAt: "2026-11-03T15:00:20.000Z" })).toBe(1);
  expect(callAiMinutes({ startedAt: "2026-11-04T09:00:00.000Z", endedAt: "2026-11-04T09:05:00.000Z" })).toBe(5);
  // A call that connected and hung up in the same second still cost a minute of AI time.
  expect(callAiMinutes({ startedAt: "2026-11-04T10:00:00.000Z", endedAt: "2026-11-04T10:00:00.000Z" })).toBe(1);
  // Not ended yet: counts once it ends, never as 0 minutes of a month that is still running.
  expect(callAiMinutes({ startedAt: "2026-11-05T11:00:00.000Z", endedAt: null })).toBe(0);
});

test("seeded month of conversations totals whole minutes, not zero", () => {
  expect(sumAiMinutes(seeded)).toBe(10);
  // Date objects (what the Drizzle route returns) count the same as ISO strings.
  expect(sumAiMinutes(seeded.map((c) => ({ startedAt: new Date(c.startedAt), endedAt: c.endedAt ? new Date(c.endedAt) : null })))).toBe(10);
  // No conversations at all → 0, so the endpoint falls back to usage_records.
  expect(sumAiMinutes([])).toBe(0);
});

// ── 2. The usage endpoint in serve.ts uses it, with the right filters ────────
test("serve.ts derives aiMinutesUsed from conversations and keeps usage_records as the fallback", () => {
  expect(rootServe).toContain('import { sumAiMinutes } from "./src/lib/ai-minutes";');

  const start = rootServe.indexOf('if (pathname === "/api/billing" && req.method === "GET") {');
  expect(start).toBeGreaterThan(0);
  const block = rootServe.slice(start, rootServe.indexOf('if (pathname === "/api/billing/change-plan"', start));

  // Counted from conversations…
  expect(block).toContain("FROM conversations");
  expect(block).toContain("sumAiMinutes(");
  // …with the filters the owner asked for: voice, AI-handled, not demo, this month.
  expect(block).toContain("type = 'call'");
  expect(block).toContain("COALESCE(ai_handled, true)");
  expect(block).toContain("is_demo = false");
  expect(block).toContain("ended_at IS NOT NULL");
  expect(block).toContain("started_at >= ${monthStart}::timestamptz");
  // Ring time on a call nobody answered is not AI time.
  expect(block).toContain("status <> 'missed'");
  // Fallback still there, and the counting can never take the billing page down.
  expect(block).toContain('let aiMinutesUsed = usageMap["ai_minutes"] || 0;');
  expect(block).toContain("catch (err)");
  // Same payload fields as before.
  for (const field of ["aiMinutesUsed", "aiMinutesLimit", "aiMinutesPercent"]) {
    expect(block).toContain(field);
  }
});

// ── 3. The other tree is not left behind ────────────────────────────────────
test("the AI-minutes counter is byte-identical in both trees and both /api/billing routes use it", () => {
  expect(siteLib).toBe(rootLib);
  expect(siteRoute).toBe(rootRoute);
  for (const [label, src] of [["src/routes/api/billing.ts", rootRoute], ["site/src/routes/api/billing.ts", siteRoute]] as const) {
    expect({ label, usesCounter: src.includes("sumAiMinutes(") }).toEqual({ label, usesCounter: true });
    expect({ label, fallback: src.includes('r.recordType === "ai_minutes"') }).toEqual({ label, fallback: true });
    expect({ label, filters: src.includes("eq(conversations.type, \"call\")") && src.includes("eq(conversations.isDemo, false)") }).toEqual({ label, filters: true });
  }
});
