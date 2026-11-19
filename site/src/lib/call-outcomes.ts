/**
 * Per-organization call outcomes for the dashboard's Call outcomes page.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Two things the voice server does on a live call used to leave no trace a business could see:
 * the automated 24-hour reminder call (its outcome went into `appointment_reminders.result`) and
 * a "press 3 → owner" transfer (its outcome went into the server log, which is lost on restart).
 * Neither was readable from the dashboard, so an owner could not answer "did my customer get
 * reminded?" or "did that caller actually reach me?".
 *
 * This module is the ONE implementation of the payload. Both `serve.ts` trees import it (for
 * `GET /api/dashboard/call-outcomes`) and `src/routes/api/dashboard/call-outcomes.ts` does too,
 * so the shape cannot drift between deployments. Keep `site/src/lib/call-outcomes.ts`
 * byte-identical.
 *
 * TRUTHFULNESS RULES
 * ------------------
 *  - every value comes from a real row; nothing is estimated, extrapolated or seeded;
 *  - an empty organization gets empty arrays and zeroed summaries — never a sample row;
 *  - the summaries count the rows THIS RESPONSE returns, not all time, and the page says so;
 *  - if `transfer_events` cannot be read (migration not applied yet) the transfers list comes
 *    back empty with `transferReadError` set, so the page can say "could not be read" instead of
 *    pretending there were no transfers.
 *
 * No imports: this module is loaded by the Bun server, by the Vite-built route handler and by
 * the page, so it must stay dependency-free.
 */

/** The tagged-template shape of `neon(url)`, injected so tests can supply a fake. */
export type SqlTag = (strings: TemplateStringsArray, ...params: unknown[]) => Promise<any[]>;

export const REMINDER_CALL_RESULTS = [
  "dialed",
  "confirmed",
  "cancelled",
  "transfer",
  "optout",
  "no_answer",
  "failed",
  "skipped",
] as const;

export const TRANSFER_OUTCOMES = ["bridged", "missed", "failed", "no_target"] as const;

export type ReminderCallResult = (typeof REMINDER_CALL_RESULTS)[number];
export type TransferOutcome = (typeof TRANSFER_OUTCOMES)[number];

export interface ReminderCallItem {
  id: string;
  /** When the call was due — the sweep dials inside 09:00–20:00 at the business. */
  scheduledAt: string | null;
  /** When the row was last written by the sweep; null while it is still queued. */
  sentAt: string | null;
  status: string;
  /** dialed | confirmed | cancelled | transfer | optout | no_answer | failed | skipped; null = queued. */
  result: string | null;
  error: string | null;
  recipientPhone: string | null;
  contactName: string | null;
  appointmentTitle: string | null;
  serviceType: string | null;
  appointmentStart: string | null;
}

export interface TransferItem {
  id: string;
  createdAt: string | null;
  callerNumber: string | null;
  targetNumber: string | null;
  outcome: string;
  language: string;
  source: string;
}

export interface CallOutcomes {
  reminderCalls: ReminderCallItem[];
  reminderSummary: Record<ReminderCallResult, number>;
  transfers: TransferItem[];
  transferSummary: Record<TransferOutcome, number>;
  /** Set only when the transfer_events table could not be read. null = read fine. */
  transferReadError: string | null;
  /** How many rows of each kind this response covers (the limit actually applied). */
  limit: number;
}

function zeroReminderSummary(): Record<ReminderCallResult, number> {
  return REMINDER_CALL_RESULTS.reduce(
    (acc, key) => ({ ...acc, [key]: 0 }),
    {} as Record<ReminderCallResult, number>,
  );
}

function zeroTransferSummary(): Record<TransferOutcome, number> {
  return TRANSFER_OUTCOMES.reduce(
    (acc, key) => ({ ...acc, [key]: 0 }),
    {} as Record<TransferOutcome, number>,
  );
}

function iso(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value as any);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function str(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function clampLimit(raw: unknown): number {
  const n = parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n)) return 50;
  return Math.min(Math.max(n, 1), 200);
}

/** Name from the contact row, or nothing at all — never "Unknown" as if it were a value. */
function contactNameOf(first: unknown, last: unknown): string | null {
  const name = [str(first), str(last)].filter(Boolean).join(" ").trim();
  return name === "" ? null : name;
}

/**
 * Read this organization's reminder calls and transfers.
 *
 * `limit` defaults to 50 and is clamped to 1…200. Both lists are newest-first and use the same
 * limit, and the summaries count exactly the rows returned.
 */
export async function buildCallOutcomes(
  sql: SqlTag,
  organizationId: string,
  limit?: unknown,
): Promise<CallOutcomes> {
  const capped = clampLimit(limit);

  const reminderRows = (await sql`
    SELECT ar.id, ar.scheduled_at, ar.sent_at, ar.status, ar.result, ar.error_message,
           ar.recipient_phone,
           c.first_name, c.last_name,
           a.title, a.service_type, a.start_time
    FROM appointment_reminders ar
    LEFT JOIN appointments a ON a.id = ar.appointment_id
    LEFT JOIN contacts c ON c.id = a.contact_id
    WHERE ar.organization_id = ${organizationId}
      AND ar.channel = 'voice'
      AND ar.reminder_type = '24h_call'
    ORDER BY ar.scheduled_at DESC
    LIMIT ${capped}
  `) as any[];

  const reminderCalls: ReminderCallItem[] = (reminderRows || []).map((r: any) => ({
    id: String(r.id),
    scheduledAt: iso(r.scheduled_at),
    sentAt: iso(r.sent_at),
    status: String(r.status || "pending"),
    result: str(r.result),
    error: str(r.error_message),
    recipientPhone: str(r.recipient_phone),
    contactName: contactNameOf(r.first_name, r.last_name),
    appointmentTitle: str(r.title),
    serviceType: str(r.service_type),
    appointmentStart: iso(r.start_time),
  }));

  const reminderSummary = zeroReminderSummary();
  for (const row of reminderCalls) {
    const key = row.result as ReminderCallResult | null;
    if (key && key in reminderSummary) reminderSummary[key] += 1;
  }

  let transferRows: any[] = [];
  let transferReadError: string | null = null;
  try {
    transferRows = (await sql`
      SELECT id, created_at, caller_number, target_number, outcome, language, source
      FROM transfer_events
      WHERE organization_id = ${organizationId}
      ORDER BY created_at DESC
      LIMIT ${capped}
    `) as any[];
  } catch (err) {
    // Missing table (migration 0013 not applied) or a read error: say so, never guess.
    transferReadError = String(err instanceof Error ? err.message : err).slice(0, 200);
    transferRows = [];
  }

  const transfers: TransferItem[] = (transferRows || []).map((r: any) => ({
    id: String(r.id),
    createdAt: iso(r.created_at),
    callerNumber: str(r.caller_number),
    targetNumber: str(r.target_number),
    outcome: String(r.outcome || ""),
    language: String(r.language || "en"),
    source: String(r.source || "inbound"),
  }));

  const transferSummary = zeroTransferSummary();
  for (const row of transfers) {
    const key = row.outcome as TransferOutcome;
    if (key in transferSummary) transferSummary[key] += 1;
  }

  return { reminderCalls, reminderSummary, transfers, transferSummary, transferReadError, limit: capped };
}

/**
 * Never throw in the renderer: an unexpected payload becomes empty lists and zeroed summaries.
 * The page then shows its honest empty states instead of crashing on `undefined.length`.
 */
export function normalizeCallOutcomes(raw: unknown): CallOutcomes {
  const src: any = raw && typeof raw === "object" ? raw : {};
  const list = (v: unknown): any[] => (Array.isArray(v) ? v : []);

  const reminderCalls: ReminderCallItem[] = list(src.reminderCalls).map((r: any) => ({
    id: String(r?.id ?? ""),
    scheduledAt: iso(r?.scheduledAt),
    sentAt: iso(r?.sentAt),
    status: String(r?.status ?? "pending"),
    result: str(r?.result),
    error: str(r?.error),
    recipientPhone: str(r?.recipientPhone),
    contactName: str(r?.contactName),
    appointmentTitle: str(r?.appointmentTitle),
    serviceType: str(r?.serviceType),
    appointmentStart: iso(r?.appointmentStart),
  }));

  const reminderSummary = zeroReminderSummary();
  for (const key of REMINDER_CALL_RESULTS) {
    const n = Number(src?.reminderSummary?.[key]);
    reminderSummary[key] = Number.isFinite(n) && n > 0 ? n : 0;
  }

  const transfers: TransferItem[] = list(src.transfers).map((r: any) => ({
    id: String(r?.id ?? ""),
    createdAt: iso(r?.createdAt),
    callerNumber: str(r?.callerNumber),
    targetNumber: str(r?.targetNumber),
    outcome: String(r?.outcome ?? ""),
    language: String(r?.language ?? "en"),
    source: String(r?.source ?? "inbound"),
  }));

  const transferSummary = zeroTransferSummary();
  for (const key of TRANSFER_OUTCOMES) {
    const n = Number(src?.transferSummary?.[key]);
    transferSummary[key] = Number.isFinite(n) && n > 0 ? n : 0;
  }

  const rawLimit = Number(src?.limit);
  return {
    reminderCalls,
    reminderSummary,
    transfers,
    transferSummary,
    transferReadError: str(src?.transferReadError),
    limit: Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 50,
  };
}
