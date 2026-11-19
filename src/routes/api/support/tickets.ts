/**
 * Support tickets API — /api/support/tickets
 *
 * POST — a signed-in customer reports a problem. The row stores a context snapshot of this
 *        org's own recent calls, reminder-call results and transfer outcomes, the team is
 *        emailed at SUPPORT_INBOX (default receptionai-0d8b54db@ctomail.io) and the customer
 *        gets a confirmation. No response time is promised anywhere — we have not measured one.
 * GET  — this org's own tickets, newest first. Never another org's.
 *
 * IMPORTANT: production traffic is served by the inline handlers in serve.ts /
 * site/serve.ts (see AUDIT_VOICE.md §0). This file is the vite-dev twin and must stay in sync
 * with them.
 */
import { neon } from "@neondatabase/serverless";
import { authenticate } from "~/lib/middleware";
import { sendEmail } from "~/lib/email";

const SUPPORT_INBOX = (process.env.SUPPORT_INBOX || "receptionai-0d8b54db@ctomail.io").trim();
const SUPPORT_CATEGORIES = ["calls", "booking", "billing", "login", "other"];
const SUPPORT_SEVERITIES = ["blocking", "normal", "question"];

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
    await sql`CREATE TABLE IF NOT EXISTS support_tickets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL,
      opened_by_user_id uuid NULL,
      opened_by_email text NULL,
      category text NOT NULL DEFAULT 'other',
      severity text NOT NULL DEFAULT 'normal',
      subject text NOT NULL,
      message text NOT NULL,
      context jsonb NOT NULL DEFAULT '{}'::jsonb,
      status text NOT NULL DEFAULT 'open',
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS support_tickets_org_created_idx
      ON support_tickets (organization_id, created_at DESC)`;
    schemaReady = true;
    return true;
  } catch (err) {
    console.warn("[Support] schema ensure failed:", String(err).slice(0, 140));
    return false;
  }
}

async function buildContext(
  sql: any,
  opts: { organizationId: string; userId: string; page: string; userAgent: string },
): Promise<Record<string, any>> {
  const context: Record<string, any> = {
    server_time_utc: new Date().toISOString(),
    commit: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || null,
    page: opts.page || null,
    user_agent: (opts.userAgent || "").slice(0, 300) || null,
    organization: null,
    opened_by: null,
    recent_conversations: [],
    recent_reminder_calls: [],
    recent_transfers: [],
  };
  try {
    const rows = await sql`
      SELECT o.id, o.name, o.timezone, o.phone, o.transfer_number, o.sms_enabled,
             p.display_name AS plan_name
      FROM organizations o
      LEFT JOIN subscriptions s ON s.organization_id = o.id
      LEFT JOIN subscription_plans p ON p.id = s.plan_id
      WHERE o.id = ${opts.organizationId}
      ORDER BY s.created_at DESC
      LIMIT 1`;
    const o = rows[0] as any;
    if (o) {
      context.organization = {
        id: o.id,
        name: o.name,
        plan: o.plan_name || null,
        timezone: o.timezone || null,
        phone: o.phone || null,
        transfer_number: o.transfer_number || null,
        sms_enabled: o.sms_enabled === true,
      };
    }
  } catch (err) {
    console.warn("[Support] org snapshot failed:", String(err).slice(0, 120));
  }
  if (opts.userId) {
    try {
      const rows = await sql`
        SELECT id, email, role FROM users
        WHERE id = ${opts.userId} AND organization_id = ${opts.organizationId}
        LIMIT 1`;
      const u = rows[0] as any;
      if (u) context.opened_by = { id: u.id, email: u.email || null, role: u.role || null };
    } catch (err) {
      console.warn("[Support] user snapshot failed:", String(err).slice(0, 120));
    }
  }
  try {
    const rows = await sql`
      SELECT id, direction, started_at, ended_at, status, is_demo, escalated_to_human, metadata
      FROM conversations
      WHERE organization_id = ${opts.organizationId}
      ORDER BY started_at DESC
      LIMIT 5`;
    context.recent_conversations = (rows as any[]).map((r: any) => ({
      id: r.id,
      direction: r.direction || null,
      started_at: r.started_at ? new Date(r.started_at).toISOString() : null,
      ended_at: r.ended_at ? new Date(r.ended_at).toISOString() : null,
      status: r.status || null,
      is_demo: r.is_demo === true,
      transferred: r.status === "transferred" || r.metadata?.transferred === true,
      requested_callback: r.metadata?.requestedCallback === true,
      escalated_to_human: r.escalated_to_human === true,
    }));
  } catch (err) {
    console.warn("[Support] conversation snapshot failed:", String(err).slice(0, 120));
  }
  try {
    const rows = await sql`
      SELECT id, scheduled_at, sent_at, status, result, error_message
      FROM appointment_reminders
      WHERE organization_id = ${opts.organizationId} AND channel = 'voice'
      ORDER BY scheduled_at DESC
      LIMIT 5`;
    context.recent_reminder_calls = (rows as any[]).map((r: any) => ({
      id: r.id,
      scheduled_at: r.scheduled_at ? new Date(r.scheduled_at).toISOString() : null,
      sent_at: r.sent_at ? new Date(r.sent_at).toISOString() : null,
      status: r.status || null,
      result: r.result || null,
      error_message: r.error_message ? String(r.error_message).slice(0, 200) : null,
    }));
  } catch (err) {
    console.warn("[Support] reminder snapshot failed:", String(err).slice(0, 120));
  }
  try {
    const rows = await sql`
      SELECT created_at, outcome, caller_number, target_number, source
      FROM transfer_events
      WHERE organization_id = ${opts.organizationId}
      ORDER BY created_at DESC
      LIMIT 5`;
    context.recent_transfers = (rows as any[]).map((r: any) => ({
      created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
      outcome: r.outcome || null,
      caller_number: r.caller_number || null,
      target_number: r.target_number || null,
      source: r.source || null,
    }));
  } catch {
    // transfer_events arrives with migration 0013 — an absent table means "nothing recorded".
    context.recent_transfers = [];
  }
  return context;
}

function renderContext(ctx: Record<string, any>): string {
  const lines: string[] = [];
  const org = ctx.organization || {};
  lines.push("Organization: " + (org.name || "(unknown)") + (org.id ? " (" + org.id + ")" : ""));
  lines.push("Plan: " + (org.plan || "(none on record)"));
  lines.push("Timezone: " + (org.timezone || "(unknown)"));
  lines.push("Business phone: " + (org.phone || "(not set)"));
  lines.push("Transfer number: " + (org.transfer_number || "(falls back to the business phone)"));
  lines.push("Texting enabled: " + (org.sms_enabled ? "yes" : "no"));
  const u = ctx.opened_by || {};
  lines.push("Opened by: " + (u.email || "(unknown user)") + (u.id ? " (" + u.id + ")" : ""));
  lines.push("Page: " + (ctx.page || "(not sent)"));
  lines.push("Browser: " + (ctx.user_agent || "(not sent)"));
  lines.push("Server time: " + ctx.server_time_utc + (ctx.commit ? " · commit " + ctx.commit : ""));

  lines.push("");
  lines.push("Last 5 conversations:");
  if (!ctx.recent_conversations?.length) lines.push("  (none recorded)");
  for (const c of ctx.recent_conversations || []) {
    const bits = [
      c.started_at || "(no start)",
      c.direction || "?",
      c.status || "?",
      c.is_demo ? "DEMO call" : null,
      c.transferred ? "transferred to owner" : null,
      c.requested_callback ? "callback requested" : null,
      c.ended_at ? "ended " + c.ended_at : "never ended",
    ].filter(Boolean);
    lines.push("  - " + bits.join(" · ") + " · " + c.id);
  }

  lines.push("");
  lines.push("Last 5 reminder calls (voice):");
  if (!ctx.recent_reminder_calls?.length) lines.push("  (none queued)");
  for (const r of ctx.recent_reminder_calls || []) {
    const bits = [
      "scheduled " + (r.scheduled_at || "?"),
      "status " + (r.status || "?"),
      "result " + (r.result || "none"),
      r.sent_at ? "sent " + r.sent_at : "not sent",
      r.error_message ? "error: " + r.error_message : null,
    ].filter(Boolean);
    lines.push("  - " + bits.join(" · ") + " · " + r.id);
  }

  lines.push("");
  lines.push("Last 5 transfers:");
  if (!ctx.recent_transfers?.length) lines.push("  (none recorded)");
  for (const t of ctx.recent_transfers || []) {
    lines.push(
      "  - " + (t.created_at || "?") + " · " + (t.outcome || "?") +
      " · caller " + (t.caller_number || "?") + " → " + (t.target_number || "?") +
      " · " + (t.source || "?"),
    );
  }
  return lines.join("\n");
}

export async function GET({ request }: { request: Request }) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    const organizationId = auth.organizationId as string;
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return json({ error: "DB not configured" }, 500);
    const sql = neon(dbUrl);
    if (!(await ensureSchema(sql))) return json({ tickets: [] });
    const rows = await sql`
      SELECT id, category, severity, subject, message, status, opened_by_email, created_at, updated_at
      FROM support_tickets
      WHERE organization_id = ${organizationId}
      ORDER BY created_at DESC
      LIMIT 50`;
    return json({
      tickets: (rows as any[]).map((r: any) => ({
        id: r.id,
        shortId: String(r.id || "").slice(0, 8),
        category: r.category || "other",
        severity: r.severity || "normal",
        subject: r.subject || "",
        message: r.message || "",
        status: r.status || "open",
        openedByEmail: r.opened_by_email || null,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
      })),
    });
  } catch (err) {
    console.error("[Support API]", String(err).slice(0, 200));
    return json({ error: "Failed to load your reports" }, 500);
  }
}

export async function POST({ request }: { request: Request }) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    const organizationId = auth.organizationId as string;
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return json({ error: "DB not configured" }, 500);
    const body = (await request.json().catch(() => ({}))) as Record<string, any>;
    const category = SUPPORT_CATEGORIES.includes(String(body.category || "")) ? String(body.category) : "other";
    const severity = SUPPORT_SEVERITIES.includes(String(body.severity || "")) ? String(body.severity) : "normal";
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();
    const page = String(body.page || "").slice(0, 300);
    if (subject.length < 3 || subject.length > 120) {
      return json({ error: "Add a subject between 3 and 120 characters." }, 400);
    }
    if (message.length < 10 || message.length > 4000) {
      return json({ error: "Tell us what happened in 10 to 4000 characters." }, 400);
    }
    const sql = neon(dbUrl);
    if (!(await ensureSchema(sql))) return json({ error: "Could not save your report" }, 500);
    const context = await buildContext(sql, {
      organizationId,
      userId: (auth.userId as string) || "",
      page,
      userAgent: request.headers.get("user-agent") || "",
    });
    const openedByEmail = (context.opened_by && context.opened_by.email) || null;
    const inserted = await sql`
      INSERT INTO support_tickets
        (organization_id, opened_by_user_id, opened_by_email, category, severity, subject, message, context)
      VALUES
        (${organizationId}, ${(auth.userId as string) || null}, ${openedByEmail}, ${category}, ${severity},
         ${subject}, ${message}, ${JSON.stringify(context)}::jsonb)
      RETURNING id, status, created_at`;
    const ticket = (inserted[0] || {}) as any;
    const ticketId = String(ticket.id || "");
    const shortId = ticketId.slice(0, 8);
    const orgName = (context.organization && context.organization.name) || "a business";
    let teamNotified = false;
    try {
      teamNotified = await sendEmail(
        SUPPORT_INBOX,
        `[ReceptionAI support] ${severity} · ${category} · ${orgName}`,
        [
          "A customer reported a problem from their dashboard.",
          "",
          `Ticket: ${ticketId}`,
          `Category: ${category}`,
          `Severity: ${severity}`,
          `Business: ${orgName}`,
          `Opened by: ${openedByEmail || "(no user email on the record)"}`,
          "",
          "--- What they wrote (verbatim) ---",
          message,
          "--- end of report ---",
          "",
          openedByEmail
            ? `Reply to this email to answer ${openedByEmail} directly.`
            : "No customer email on the record — answer in the dashboard.",
          "",
          "--- Context snapshot ---",
          renderContext(context),
        ].join("\n"),
        openedByEmail || undefined,
      );
    } catch (err) {
      console.error(`[Support] ticket ${ticketId} stored but the team email threw:`, String(err).slice(0, 160));
    }
    let customerNotified = false;
    if (openedByEmail) {
      try {
        customerNotified = await sendEmail(
          openedByEmail,
          `We got your report (#${shortId})`,
          [
            "Hi,",
            "",
            "We received this report from you:",
            "",
            subject,
            "",
            message,
            "",
            `Your report id is #${shortId}.`,
            "",
            "A person on our team reads every report and will reply by email. Nothing else is needed from you.",
          ].join("\n"),
        );
      } catch (err) {
        console.warn(`[Support] ticket ${ticketId} stored but the customer confirmation threw:`, String(err).slice(0, 160));
      }
    }
    return json({
      ok: true,
      ticket: {
        id: ticketId,
        shortId,
        status: ticket.status || "open",
        createdAt: ticket.created_at ? new Date(ticket.created_at).toISOString() : null,
      },
      teamNotified,
      customerNotified,
    });
  } catch (err) {
    console.error("[Support API]", String(err).slice(0, 200));
    return json({ error: "Could not save your report" }, 500);
  }
}
