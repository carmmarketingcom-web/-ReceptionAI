/**
 * AI-minutes for the dashboard, counted from real voice conversations.
 *
 * Nothing ever wrote `usage_records.record_type = 'ai_minutes'`, so every business saw
 * "0 of 500" on the dashboard even after taking real calls. Real call timing has always
 * been recorded on `conversations` (`started_at` / `ended_at`), so the month's AI-minutes
 * are derived from it instead: one call's AI time is its elapsed time rounded UP to a
 * whole minute — the same way the carrier bills a call.
 *
 * Counting only. Nothing here caps, blocks, throttles or bills a call.
 */

export interface CallTiming {
  startedAt: string | Date | null | undefined;
  endedAt: string | Date | null | undefined;
}

function toTime(value: string | Date | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(ms) ? ms : null;
}

/** Minutes for one call: elapsed time rounded up, minimum 1 for a call that connected. */
export function callAiMinutes(call: CallTiming): number {
  const start = toTime(call.startedAt);
  const end = toTime(call.endedAt);
  // A call still in progress has no elapsed time yet; it counts once it ends.
  if (start === null || end === null) return 0;
  if (end <= start) return 1; // answered and hung up in the same second
  return Math.max(1, Math.ceil((end - start) / 60000));
}

/** Total AI-minutes for a set of already-filtered (voice, AI-handled, non-demo) calls. */
export function sumAiMinutes(calls: CallTiming[]): number {
  let total = 0;
  for (const call of calls) total += callAiMinutes(call);
  return total;
}
