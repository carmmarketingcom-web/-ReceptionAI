/**
 * Analytics API
 *
 * GET /api/analytics?days=7|30|90 — org-scoped aggregates over the rows this
 * business actually has: `conversations` (type='call'), `missed_calls`, and
 * `appointments`.
 *
 * There is NO sample/demo data here and no estimate anywhere. Every number is a
 * COUNT over real rows for the signed-in organization and the selected range.
 * When a metric cannot be computed from the schema (satisfaction scores,
 * per-staff performance, revenue attribution, exports) this endpoint simply
 * does not return it — the page renders an honest "In progress" note instead.
 *
 * What is real:
 *   calls.total / answered / missed   — conversations.type='call', status<>'missed'
 *   statuses                          — how each call ended (ended/transferred/voicemail/missed)
 *   outcomes                          — conversations.metadata->>'outcome' written by the voice
 *                                       pipeline when the call ends (Appointment booked,
 *                                       Requested owner callback, Appointment interest, General inquiry)
 *   callsByDay / callsByHour          — bucketed by the ORG timezone, full series with zeros
 *   channels                          — conversations.type across every channel
 *   languages                         — conversations.metadata->>'language'
 *   missedCalls                       — missed_calls rows, callback_requested / callback_status
 *   appointments                      — appointments created in the range, by status, and
 *                                       how many came from a call (conversation_id not null)
 *
 * IMPORTANT: production traffic is served by the inline handlers in serve.ts /
 * site/serve.ts (see AUDIT_VOICE.md §0). This file and those handlers must stay
 * in sync — same SQL, same response shape.
 */
import { neon } from "@neondatabase/serverless";
import { authenticate } from "../../lib/middleware";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Only these windows are offered by the dashboard; anything else falls back to 7. */
const ALLOWED_DAYS = [7, 30, 90];

/** A bad timezone string would make Postgres throw, so fall back to UTC. */
export function safeTimezone(tz: string | null | undefined): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

/** neon returns json/jsonb already parsed, but tolerate a string just in case. */
function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * The empty shape is what a brand-new organization gets: zeros, empty
 * breakdowns, hasData=false. The page renders its truthful empty state from it.
 */
export function emptyAnalytics(days: number, timezone: string, from: string, to: string) {
  return {
    range: { days, from, to, timezone },
    calls: { total: 0, answered: 0, missed: 0, answerRate: null as number | null },
    statuses: [] as { status: string; count: number }[],
    outcomes: [] as { outcome: string; count: number }[],
    callsByDay: [] as { date: string; calls: number; answered: number; missed: number }[],
    callsByHour: [] as { hour: number; count: number }[],
    channels: [] as { channel: string; count: number }[],
    languages: [] as { language: string; count: number }[],
    missedCalls: { total: 0, callbackRequested: 0, calledBack: 0 },
    appointments: {
      total: 0,
      byStatus: [] as { status: string; count: number }[],
      fromCalls: 0,
      upcoming: 0,
    },
    hasData: false,
  };
}

// ─── SQL ─────────────────────────────────────────────────────────────────────
// $1 = org timezone (text), $2 = organization id, $3 = from (timestamptz), $4 = to (timestamptz), $5 = days (int)

export const CALL_AGGREGATES_SQL = `
WITH day_series AS (
  -- Exactly N buckets ending today, in the organization's timezone.
  SELECT generate_series(
    (($4::timestamptz - interval '1 second') AT TIME ZONE $1::text)::date - ($5::int - 1),
    (($4::timestamptz - interval '1 second') AT TIME ZONE $1::text)::date,
    interval '1 day'
  )::date AS day
),
call_rows AS (
  SELECT
    status::text AS status,
    COALESCE(metadata->>'outcome', '') AS outcome,
    COALESCE(metadata->>'language', '') AS language,
    (started_at AT TIME ZONE $1::text)::date AS day,
    EXTRACT(hour FROM (started_at AT TIME ZONE $1::text))::int AS hour
  FROM conversations
  WHERE organization_id = $2
    AND type = 'call'
    AND is_demo = false
    AND started_at >= $3::timestamptz
    AND started_at < $4::timestamptz
)
SELECT
  (SELECT count(*)::int FROM call_rows) AS total,
  (SELECT count(*)::int FROM call_rows WHERE status <> 'missed') AS answered,
  (SELECT count(*)::int FROM call_rows WHERE status = 'missed') AS missed,
  (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
     SELECT status, count(*)::int AS count
     FROM call_rows GROUP BY status ORDER BY count(*) DESC, status
   ) x) AS statuses,
  (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
     SELECT outcome, count(*)::int AS count
     FROM call_rows WHERE outcome <> '' GROUP BY outcome ORDER BY count(*) DESC, outcome
   ) x) AS outcomes,
  (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
     SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
            count(c.status)::int AS calls,
            count(c.status) FILTER (WHERE c.status <> 'missed')::int AS answered,
            count(c.status) FILTER (WHERE c.status = 'missed')::int AS missed
     FROM day_series d
     LEFT JOIN call_rows c ON c.day = d.day
     GROUP BY d.day ORDER BY d.day
   ) x) AS by_day,
  (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
     SELECT h.hour, count(c.status)::int AS count
     FROM generate_series(0, 23) AS h(hour)
     LEFT JOIN call_rows c ON c.hour = h.hour
     GROUP BY h.hour ORDER BY h.hour
   ) x) AS by_hour,
  (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
     SELECT language, count(*)::int AS count
     FROM call_rows WHERE language <> '' GROUP BY language ORDER BY count(*) DESC, language
   ) x) AS languages,
  (SELECT count(*)::int FROM call_rows WHERE outcome = '') AS legacy_without_outcome
`;

export const CHANNELS_SQL = `
SELECT type::text AS channel, count(*)::int AS count
FROM conversations
WHERE organization_id = $1
  AND is_demo = false
  AND started_at >= $2::timestamptz
  AND started_at < $3::timestamptz
GROUP BY type
ORDER BY count(*) DESC, type
`;

export const MISSED_SQL = `
SELECT count(*)::int AS total,
       count(*) FILTER (WHERE callback_requested)::int AS callback_requested,
       count(*) FILTER (WHERE callback_status IN ('contacted', 'resolved'))::int AS called_back
FROM missed_calls
WHERE organization_id = $1
  AND is_demo = false
  AND created_at >= $2::timestamptz
  AND created_at < $3::timestamptz
`;

export const APPOINTMENTS_SQL = `
SELECT status::text AS status,
       count(*)::int AS count,
       count(*) FILTER (WHERE conversation_id IS NOT NULL)::int AS from_calls
FROM appointments
WHERE organization_id = $1
  AND is_demo = false
  AND created_at >= $2::timestamptz
  AND created_at < $3::timestamptz
GROUP BY status
ORDER BY count(*) DESC, status
`;

export const UPCOMING_SQL = `
SELECT count(*)::int AS upcoming
FROM appointments
WHERE organization_id = $1
  AND is_demo = false
  AND status IN ('scheduled', 'confirmed')
  AND start_time >= now()
`;

/**
 * Shapes the raw rows from the five queries above into the API response.
 * Shared logic so the route file and both serve.ts trees stay identical.
 */
export function shapeAnalytics(
  days: number,
  timezone: string,
  from: string,
  to: string,
  callRow: any,
  channelRows: any[],
  missedRow: any,
  appointmentRows: any[],
  upcomingRow: any
) {
  const total = num(callRow?.total);
  const answered = num(callRow?.answered);
  const missed = num(callRow?.missed);

  const byStatus = appointmentRows || [];
  const appointmentsTotal = byStatus.reduce((sum, r) => sum + num(r.count), 0);
  const appointmentsFromCalls = byStatus.reduce((sum, r) => sum + num(r.from_calls), 0);

  const response = {
    range: { days, from, to, timezone },
    calls: {
      total,
      answered,
      missed,
      // null (not 0%) when there is nothing to divide by — the page shows "—".
      answerRate: total > 0 ? Math.round((answered / total) * 100) : null,
    },
    statuses: asArray<{ status: string; count: number }>(callRow?.statuses).map((r) => ({
      status: String(r.status),
      count: num(r.count),
    })),
    outcomes: asArray<{ outcome: string; count: number }>(callRow?.outcomes).map((r) => ({
      outcome: String(r.outcome),
      count: num(r.count),
    })),
    callsByDay: asArray<{ date: string; calls: number; answered: number; missed: number }>(
      callRow?.by_day
    ).map((r) => ({
      date: String(r.date),
      calls: num(r.calls),
      answered: num(r.answered),
      missed: num(r.missed),
    })),
    callsByHour: asArray<{ hour: number; count: number }>(callRow?.by_hour).map((r) => ({
      hour: num(r.hour),
      count: num(r.count),
    })),
    channels: (channelRows || []).map((r) => ({
      channel: String(r.channel),
      count: num(r.count),
    })),
    languages: asArray<{ language: string; count: number }>(callRow?.languages).map((r) => ({
      language: String(r.language),
      count: num(r.count),
    })),
    missedCalls: {
      total: num(missedRow?.total),
      callbackRequested: num(missedRow?.callback_requested),
      calledBack: num(missedRow?.called_back),
    },
    appointments: {
      total: appointmentsTotal,
      byStatus: byStatus.map((r) => ({ status: String(r.status), count: num(r.count) })),
      fromCalls: appointmentsFromCalls,
      upcoming: num(upcomingRow?.upcoming),
    },
    hasData: false,
  };

  response.hasData =
    response.calls.total > 0 ||
    response.missedCalls.total > 0 ||
    response.appointments.total > 0 ||
    response.channels.length > 0;

  return response;
}

export async function GET({ request }: { request: Request }) {
  try {
    const authResult = await authenticate(request);
    if (authResult instanceof Response) return authResult;
    const organizationId = authResult.organizationId;

    const url = new URL(request.url);
    const requested = parseInt(url.searchParams.get("days") || "7", 10);
    const days = ALLOWED_DAYS.includes(requested) ? requested : 7;

    const now = new Date();
    const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const from = fromDate.toISOString();
    const to = now.toISOString();

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      // No database: report nothing rather than inventing numbers.
      return json(emptyAnalytics(days, "UTC", from, to));
    }

    const sql = neon(databaseUrl);

    const tzRows: any[] = await sql.query(
      `SELECT timezone FROM organizations WHERE id = $1`,
      [organizationId]
    );
    const timezone = safeTimezone(tzRows?.[0]?.timezone);

    const callRows: any[] = await sql.query(CALL_AGGREGATES_SQL, [timezone, organizationId, from, to, days]);
    const channelRows: any[] = await sql.query(CHANNELS_SQL, [organizationId, from, to]);
    const missedRows: any[] = await sql.query(MISSED_SQL, [organizationId, from, to]);
    const appointmentRows: any[] = await sql.query(APPOINTMENTS_SQL, [organizationId, from, to]);
    const upcomingRows: any[] = await sql.query(UPCOMING_SQL, [organizationId]);

    return json(
      shapeAnalytics(
        days,
        timezone,
        from,
        to,
        callRows?.[0] || {},
        channelRows || [],
        missedRows?.[0] || {},
        appointmentRows || [],
        upcomingRows?.[0] || {}
      )
    );
  } catch (error) {
    console.error("[Analytics API] GET error:", error);
    return json({ error: "Failed to load analytics" }, 500);
  }
}
