/**
 * The one recorded path for every outbound email.
 *
 * `sendEmail()` only talks to the provider. This module is what makes a send provable: it writes
 * one row into `email_deliveries` (to_email, subject, kind, org_id, status, error, epoch-ms), so
 * System health can answer "was this paying customer ever emailed?" — the question the
 * 2026-11-20 incident could not answer, because the welcome email bypassed this table.
 *
 * `serve.ts` used to own this code inline. It now delegates here (see `deliverEmail` /
 * `recordEmailDelivery` in both serve.ts trees), so there is exactly one implementation of the
 * insert and the webhook route is not a copy of it.
 *
 * Never throws: a notification must never break a call flow or a provisioning run.
 */
import { neon } from "@neondatabase/serverless";
import { sendEmail } from "./email";

export interface EmailDeliveryRow {
  toEmail: string;
  subject: string;
  kind: string;
  orgId: string | null;
  status: "sent" | "failed";
  error: string | null;
}

/** Anything tagged-template shaped: the real neon client, or the fake used by the tests. */
export type SqlFn = (strings: TemplateStringsArray, ...params: unknown[]) => Promise<any>;

export interface EmailDeliveryDeps {
  sql?: SqlFn;
}

let emailDeliveriesTableReady: Promise<boolean> | null = null;

export function emailDeliveryDb(): any {
  const dbUrl = process.env.DATABASE_URL || "";
  return dbUrl ? neon(dbUrl) : null;
}

/**
 * Same shape as sms_deliveries (migration 0008) — epoch-ms and TEXT/BIGINT columns — so the same
 * DDL runs on Postgres and on the fakes used by the tests. Issued from the server too, so health
 * can report email before migration 0010 is applied by hand.
 */
export async function ensureEmailDeliveriesTable(sql: any): Promise<boolean> {
  if (!emailDeliveriesTableReady) {
    emailDeliveriesTableReady = (async () => {
      try {
        await sql`CREATE TABLE IF NOT EXISTS email_deliveries (
          id TEXT PRIMARY KEY,
          to_email TEXT,
          subject TEXT,
          kind TEXT,
          org_id TEXT,
          status TEXT,
          error TEXT,
          created_at_ms BIGINT,
          updated_at_ms BIGINT
        )`;
        await sql`CREATE INDEX IF NOT EXISTS email_deliveries_created_idx ON email_deliveries (created_at_ms)`;
        return true;
      } catch (err) {
        console.warn("[Email] delivery table unavailable:", String(err).slice(0, 120));
        emailDeliveriesTableReady = null; // retry on the next send
        return false;
      }
    })();
  }
  return emailDeliveriesTableReady;
}

// False when there was no DB or the insert failed — the caller logs that, because a missing row
// means the channel that is now the only one has no trail behind it.
export async function recordEmailDelivery(
  row: EmailDeliveryRow,
  deps: EmailDeliveryDeps = {}
): Promise<boolean> {
  const sql = deps.sql || emailDeliveryDb();
  if (!sql) return false;
  if (!(await ensureEmailDeliveriesTable(sql))) return false;
  const now = Date.now();
  try {
    await sql`INSERT INTO email_deliveries
      (id, to_email, subject, kind, org_id, status, error, created_at_ms, updated_at_ms)
      VALUES (${crypto.randomUUID()}, ${row.toEmail}, ${row.subject.slice(0, 200)}, ${row.kind},
              ${row.orgId}, ${row.status}, ${row.error}, ${now}, ${now})`;
    return true;
  } catch (err) {
    console.warn("[Email] could not record delivery:", String(err).slice(0, 120));
    return false;
  }
}

/**
 * Has this org already been sent an email of this kind? The idempotency guard for anything that
 * must happen once per account (the welcome email), so a replayed session cannot mail twice.
 */
export async function hasEmailDeliveryOfKind(
  orgId: string,
  kind: string,
  deps: EmailDeliveryDeps = {}
): Promise<boolean> {
  const sql = deps.sql || emailDeliveryDb();
  if (!sql || !orgId) return false;
  try {
    if (!(await ensureEmailDeliveriesTable(sql))) return false;
    const rows = (await sql`
      SELECT id FROM email_deliveries WHERE org_id = ${orgId} AND kind = ${kind} LIMIT 1
    `) as Array<{ id: string }>;
    return rows.length > 0;
  } catch (err) {
    // A broken read must not turn into a second email: treat "cannot tell" as "already sent" is
    // the wrong way round for a customer who was never contacted, so answer false and let the
    // caller send — the row is written right after the send either way.
    console.warn(`[Email] could not check ${kind} delivery for org ${orgId}:`, String(err).slice(0, 120));
    return false;
  }
}

/**
 * The single place an email actually leaves the process. Returns true only when the provider
 * accepted it — sendEmail() itself returns false (never throws) for a rejection or a missing
 * RESEND_API_KEY, so a caller can never report a send that did not happen.
 */
export async function deliverEmail(
  toEmail: string,
  subject: string,
  body: string,
  kind: string,
  orgId: string | null,
  replyTo?: string,
  deps: EmailDeliveryDeps = {}
): Promise<boolean> {
  let ok = false;
  let error: string | null = null;
  try {
    ok = await sendEmail(toEmail, subject, body, replyTo || undefined);
    if (!ok) error = "provider rejected the message or RESEND_API_KEY is unset";
  } catch (err) {
    error = String(err).slice(0, 200);
  }
  const persisted = await recordEmailDelivery(
    { toEmail, subject, kind, orgId, status: ok ? "sent" : "failed", error },
    deps
  );
  if (ok) {
    console.log(`[Email] Sent "${subject.slice(0, 50)}" to ${toEmail} (${kind})`);
  } else {
    console.error(`[Email] NOT SENT "${subject.slice(0, 50)}" to ${toEmail} (${kind}): ${error}`);
  }
  if (!persisted) console.warn(`[Email] delivery NOT recorded for ${kind} to ${toEmail} (no database?)`);
  return ok;
}
