/**
 * Calendar connection requests — /api/calendar-request
 *
 * POST — a signed-in customer asks for a Google Calendar / Outlook connection. We cannot install
 *        one: two-way sync does not exist yet and the business holds no Google OAuth client or
 *        Microsoft Entra app. So this records the request (one row per org and provider — a second
 *        request updates it) and emails the team at SUPPORT_INBOX. Nothing is installed, nothing
 *        is charged, and the page promises nothing beyond an email when self-install opens.
 * GET  — this org's own requests, newest first. Never another org's.
 *
 * IMPORTANT: production traffic is served by the inline handlers in serve.ts / site/serve.ts
 * (see AUDIT_VOICE.md §0). This file is the vite-dev twin and must stay in sync with them.
 */
import { neon } from "@neondatabase/serverless";
import { authenticate } from "~/lib/middleware";
import { sendEmail } from "~/lib/email";

const SUPPORT_INBOX = (process.env.SUPPORT_INBOX || "receptionai-0d8b54db@ctomail.io").trim();
const PROVIDERS = ["google", "outlook", "both"];

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

let schemaReady = false;
async function ensureSchema(sql: any): Promise<boolean> {
  if (schemaReady) return true;
  try {
    await sql`CREATE TABLE IF NOT EXISTS calendar_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL,
      requested_by_user_id uuid NULL,
      requested_by_email text NULL,
      provider text NOT NULL DEFAULT 'both',
      note text NULL,
      status text NOT NULL DEFAULT 'requested',
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    )`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS calendar_requests_org_provider_idx
      ON calendar_requests (organization_id, provider)`;
    schemaReady = true;
    return true;
  } catch (err) {
    console.warn("[Calendar request] schema ensure failed:", String(err).slice(0, 140));
    return false;
  }
}

function shapeRequest(row: any) {
  if (!row) return null;
  return {
    id: String(row.id),
    provider: String(row.provider || "both"),
    note: row.note ? String(row.note) : null,
    status: String(row.status || "requested"),
    requestedByEmail: row.requested_by_email ? String(row.requested_by_email) : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

export async function POST({ request }: { request: Request }) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    const organizationId = auth.organizationId as string;
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return json({ error: "DB not configured" }, 500);
    const body = (await request.json().catch(() => ({}))) as Record<string, any>;
    const provider = PROVIDERS.includes(String(body.provider || "")) ? String(body.provider) : "both";
    const note = String(body.note ?? "").trim().slice(0, 1000) || null;
    const sql = neon(dbUrl);
    if (!(await ensureSchema(sql))) return json({ error: "Could not save your request" }, 500);

    const orgRows = await sql`
      SELECT o.name, o.email, p.display_name AS plan_name
      FROM organizations o
      LEFT JOIN subscriptions s ON s.organization_id = o.id
      LEFT JOIN subscription_plans p ON p.id = s.plan_id
      WHERE o.id = ${organizationId}
      ORDER BY s.created_at DESC
      LIMIT 1`;
    const org = (orgRows[0] || {}) as any;
    const requesterRows = await sql`SELECT email FROM users WHERE id = ${(auth.userId as string) || null} LIMIT 1`;
    const requesterEmail = ((requesterRows[0] as any)?.email as string) || null;

    // Upsert: a second request from the same org and provider updates the note, never duplicates.
    const saved = await sql`
      INSERT INTO calendar_requests
        (organization_id, requested_by_user_id, requested_by_email, provider, note, status)
      VALUES
        (${organizationId}, ${(auth.userId as string) || null}, ${requesterEmail}, ${provider}, ${note}, 'requested')
      ON CONFLICT (organization_id, provider) DO UPDATE
        SET note = EXCLUDED.note,
            requested_by_user_id = EXCLUDED.requested_by_user_id,
            requested_by_email = EXCLUDED.requested_by_email,
            status = 'requested',
            updated_at = NOW()
      RETURNING *`;
    const row = shapeRequest((saved as any[])[0]);

    // The row is the record. The team email is best effort: a mail failure is logged, never a
    // reason to lose a request the customer can see on the page.
    let teamNotified = false;
    try {
      const apptRows = await sql`SELECT COUNT(*)::int AS n FROM appointments WHERE organization_id = ${organizationId}`;
      const appointmentCount = Number(((apptRows[0] as any)?.n ?? 0) || 0);
      const businessName = org.name || "a business";
      teamNotified = await sendEmail(
        SUPPORT_INBOX,
        `[ReceptionAI] calendar connection requested — ${businessName}`,
        [
          "A customer asked for a Google Calendar / Outlook connection.",
          "",
          `Business: ${businessName}`,
          `Organization id: ${organizationId}`,
          `Plan: ${org.plan_name || "(no subscription)"}`,
          `Requested by: ${requesterEmail || "(no user email on the record)"}`,
          `Provider: ${provider}`,
          `Appointments already booked on this org: ${appointmentCount}`,
          "",
          "--- Note from the customer (verbatim) ---",
          note || "(none)",
          "--- end of note ---",
          "",
          requesterEmail
            ? `Reply to this email to answer ${requesterEmail} directly.`
            : "No customer email on the record — answer from the dashboard.",
        ].join("\n"),
        requesterEmail || undefined,
      );
      if (!teamNotified) {
        console.error(`[Calendar request] ${organizationId} saved but the team email did NOT send (SUPPORT_INBOX=${SUPPORT_INBOX})`);
      }
    } catch (mailErr) {
      console.error("[Calendar request] saved but the team email threw:", String(mailErr).slice(0, 160));
    }

    return json({ ok: true, request: row, teamNotified });
  } catch (err) {
    console.error("[Calendar request API]", String(err).slice(0, 200));
    return json({ error: "Could not save your request" }, 500);
  }
}

export async function GET({ request }: { request: Request }) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    const organizationId = auth.organizationId as string;
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return json({ error: "DB not configured" }, 500);
    const sql = neon(dbUrl);
    if (!(await ensureSchema(sql))) return json({ requests: [] });
    // organization_id is in the WHERE clause, so another business's request can never come back.
    const rows = await sql`
      SELECT * FROM calendar_requests
      WHERE organization_id = ${organizationId}
      ORDER BY updated_at DESC`;
    return json({ requests: (rows as any[]).map(shapeRequest) });
  } catch (err) {
    console.error("[Calendar request API] GET", String(err).slice(0, 200));
    return json({ requests: [] });
  }
}
