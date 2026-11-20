/**
 * POST /api/billing/cancel — body `{ reason, comment? }`
 *
 * Cancels at the END of the paid period (`cancel_at_period_end=true`, so the customer keeps what
 * they paid for), requires one of the six reasons the owner asked for, stores the reason and the
 * optional comment in `subscription_cancellations`, and emails the team inbox with the plan, the
 * tenure, the reason and the org's last 30 days of usage.
 *
 * NOTE: production traffic is served by the inline handler in `serve.ts` / `site/serve.ts`; both
 * read the ONE shared implementation in `src/lib/billing-controls.ts`. With no STRIPE_SECRET_KEY
 * nothing is written and nothing is cancelled — the call answers a clear 503 instead.
 */
import { createFileRoute } from "@tanstack/react-router";
import { neon } from "@neondatabase/serverless";
import { authenticate } from "../../../lib/middleware";
import { cancelSubscription } from "../../../lib/billing-controls";
import { sendEmail } from "../../../lib/email";

export const Route = createFileRoute("/api/billing/cancel")({});

const SUPPORT_INBOX = (process.env.SUPPORT_INBOX || "receptionai-0d8b54db@ctomail.io").trim();

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST({ request }: { request: Request }) {
  const authResult = await authenticate(request);
  if (authResult instanceof Response) return authResult;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return json({ error: "DB not configured" }, 500);

  try {
    const sql = neon(dbUrl);
    const body = (await request.json().catch(() => ({}))) as { reason?: string; comment?: string };
    let requestedByEmail: string | null = null;
    try {
      const userRows = (await sql`SELECT email FROM users WHERE id = ${authResult.userId} LIMIT 1`) as Array<{
        email: string | null;
      }>;
      requestedByEmail = userRows[0]?.email || null;
    } catch {
      /* the reason is still stored without an email */
    }

    const result = await cancelSubscription({
      sql: sql as any,
      stripeKey: process.env.STRIPE_SECRET_KEY || "",
      organizationId: authResult.organizationId,
      reason: String(body.reason || ""),
      comment: body.comment ? String(body.comment) : null,
      requestedByEmail,
    });
    if (!result.ok) return json({ error: result.error }, result.status);

    const lines = [
      `Plan: ${result.plan || "unknown"}${result.amount ? ` ($${(result.amount / 100).toFixed(2)}/mo)` : ""}`,
      `Member since: ${result.memberSince ? new Date(result.memberSince).toISOString().slice(0, 10) : "unknown"} (${result.tenureDays ?? "?"} days)`,
      `Reason: ${String(body.reason || "")}`,
      `Comment: ${body.comment ? String(body.comment) : "(none)"}`,
      `Plan stays active until: ${result.cancelsAt ? new Date(result.cancelsAt).toISOString().slice(0, 10) : "unknown"}`,
      `Last 30 days: ${result.usage?.calls ?? 0} calls answered, ${result.usage?.bookings ?? 0} appointments booked`,
      `Requested by: ${requestedByEmail || "unknown"}`,
      `Organization: ${authResult.organizationId}`,
    ];
    const subject = `Cancellation: ${result.plan || "plan"} — ${String(body.reason || "")}`;
    const sent = await sendEmail(SUPPORT_INBOX, subject, lines.join("\n"));
    if (!sent) console.error(`[Billing cancel] org ${authResult.organizationId} cancelled but the team email did NOT send`);

    return json({ cancelled: true, cancelsAt: result.cancelsAt, plan: result.plan, amount: result.amount });
  } catch (err) {
    console.error("[Billing cancel] Error:", String(err).slice(0, 200));
    return json({ error: "Could not cancel the subscription" }, 500);
  }
}
