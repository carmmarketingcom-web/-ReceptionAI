/**
 * Closing the loop on a support ticket.
 *
 * `support_tickets` could be created and listed, but nothing could set a status, record what
 * was done, or tell the customer. This module is the shared half of that: the row shape the
 * dashboard renders (GET and PATCH must agree, so the page can re-render without a reload) and
 * the single UPDATE, which is always scoped by `organization_id` so another business's ticket
 * can never be touched — it comes back as "not found", never as a forbidden-with-detail.
 *
 * Migration 0015 adds the four columns. The server also issues the ALTERs on first use
 * (ensureSupportTicketsSchema), so a deploy works before the file is applied by hand.
 */

export const SUPPORT_STATUSES = ["open", "team_replied", "resolved", "closed"] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export function isSupportStatus(value: unknown): value is SupportStatus {
  return typeof value === "string" && (SUPPORT_STATUSES as readonly string[]).includes(value);
}

function iso(value: any): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * The context snapshot as an object. jsonb comes back parsed from Postgres, but a driver (and
 * the test harness) can hand back the raw JSON text — either way the copy email must be able to
 * say what we recorded.
 */
export function parseTicketContext(value: any): Record<string, any> {
  if (value && typeof value === "object") return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** One row, in the shape GET and PATCH both return. */
export function shapeSupportTicket(r: any) {
  const row = r || {};
  return {
    id: row.id,
    shortId: String(row.id || "").slice(0, 8),
    category: row.category || "other",
    severity: row.severity || "normal",
    subject: row.subject || "",
    message: row.message || "",
    status: row.status || "open",
    openedByEmail: row.opened_by_email || null,
    resolution: row.resolution || null,
    resolvedAt: iso(row.resolved_at),
    teamReply: row.team_reply || null,
    repliedAt: iso(row.replied_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export type TicketUpdate = {
  id: string;
  organizationId: string;
  /** The status the caller asked for, already validated. Null means "leave it". */
  status: SupportStatus | null;
  /** What was actually done. Null means "leave it". */
  resolution: string | null;
  /** Our reply to the customer. Null means "leave it". */
  reply: string | null;
};

/**
 * Writes the change and returns the updated row (or null when the ticket is not this org's).
 *
 * `resolved_at` is stamped only the first time: re-sending a resolution must not move the date
 * the customer was told. `replied_at` always moves with the latest reply.
 */
export async function applySupportTicketUpdate(sql: any, u: TicketUpdate): Promise<any | null> {
  // A reply on its own moves the ticket to "team replied" unless the caller said otherwise.
  const status: SupportStatus | null = u.status || (u.reply ? "team_replied" : null);
  // Booleans, not `$1 IS NULL`: a bare parameter in `IS NULL` has no type for Postgres to infer.
  const hasReply = u.reply !== null;
  const rows = await sql`
    UPDATE support_tickets SET
      status = COALESCE(${status}, status),
      resolution = COALESCE(${u.resolution}, resolution),
      team_reply = COALESCE(${u.reply}, team_reply),
      replied_at = CASE WHEN ${hasReply} THEN NOW() ELSE replied_at END,
      resolved_at = CASE WHEN ${status} = 'resolved' THEN COALESCE(resolved_at, NOW()) ELSE resolved_at END,
      updated_at = NOW()
    WHERE id = ${u.id} AND organization_id = ${u.organizationId}
    RETURNING *`;
  return (rows as any[])[0] || null;
}
