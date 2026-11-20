/**
 * POST /api/billing/cancel — body `{ reason?, comment?, disposition?, forward_to? }`
 *
 * The one-question cancel dialog (owner 2026-11-20): `disposition` is `nowhere` (the default —
 * callers hear a short out-of-service message for two weeks, then the number is released) or
 * `forward` (calls ring `forward_to` for 30 days, then the out-of-service message and release).
 * `reason` is optional now — the dialog offers four chips and no text box.
 *
 * Cancelling always runs to the END of the paid period (`cancel_at_period_end=true`): no early
 * cutoff, no proration, nothing charged after it. What happens from that date — the AI stops
 * answering, the booking page goes offline, reminders and callbacks stop, then forwarding /
 * out-of-service / release — is decided by `src/lib/cancellation.ts` on the in-process timer.
 *
 * The customer gets a copy of what will happen and the one line that offers to keep the number
 * somewhere else; the team inbox gets the plan, tenure, reason, disposition and last 30 days.
 *
 * NOTE: production traffic is served by the inline handler in `serve.ts` / `site/serve.ts`; both
 * read the ONE shared implementation in `src/lib/billing-controls.ts`. With no STRIPE_SECRET_KEY
 * nothing is written and nothing is cancelled — the call answers a clear 503 instead.
 */
import { createFileRoute } from "@tanstack/react-router";
import { neon } from "@neondatabase/serverless";
import { authenticate } from "../../../lib/middleware";
import { cancelSubscription } from "../../../lib/billing-controls";
import { cancellationEmail, lastPaidDay } from "../../../lib/cancellation";
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
    const body = (await request.json().catch(() => ({}))) as {
      reason?: string;
      comment?: string;
      disposition?: string;
      forward_to?: string;
    };
    let requestedByEmail: string | null = null;
    let businessName = "your business";
    try {
      const userRows = (await sql`SELECT email FROM users WHERE id = ${authResult.userId} LIMIT 1`) as Array<{
        email: string | null;
      }>;
      requestedByEmail = userRows[0]?.email || null;
      const orgRows = (await sql`SELECT name FROM organizations WHERE id = ${authResult.organizationId} LIMIT 1`) as Array<{
        name: string | null;
      }>;
      if (orgRows[0]?.name) businessName = orgRows[0].name;
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
      disposition: body.disposition ? String(body.disposition) : "nowhere",
      forwardTo: body.forward_to ? String(body.forward_to) : null,
    });
    if (!result.ok) return json({ error: result.error }, result.status);

    const numbers = result.numbers || [];
    const numbersText = numbers.length ? numbers.join(", ") : "your number";

    // The customer's copy: exactly what the dialog told them, plus the line that offers to keep
    // the number somewhere else. Porting is not built, so the reply goes to the team.
    if (requestedByEmail) {
      const mail = cancellationEmail({
        businessName,
        numbers,
        paidUntil: result.cancelsAt || null,
        disposition: result.disposition || "nowhere",
        forwardTo: result.forwardTo || null,
        forwardUntil: result.forwardUntil || null,
        releaseOn: result.releaseOn || null,
      });
      const ok = await sendEmail(requestedByEmail, mail.subject, mail.body);
      if (!ok) console.error(`[Billing cancel] org ${authResult.organizationId}: customer email did NOT send`);
    }

    const lines = [
      `Plan: ${result.plan || "unknown"}${result.amount ? ` ($${(result.amount / 100).toFixed(2)}/mo)` : ""}`,
      `Member since: ${result.memberSince ? new Date(result.memberSince).toISOString().slice(0, 10) : "unknown"} (${result.tenureDays ?? "?"} days)`,
      `Reason: ${String(body.reason || "Not given")}`,
      `Comment: ${body.comment ? String(body.comment) : "(none)"}`,
      `Plan stays active until: ${result.cancelsAt ? new Date(result.cancelsAt).toISOString().slice(0, 10) : "unknown"}`,
      `Numbers: ${numbersText}`,
      result.disposition === "forward" && result.forwardTo
        ? `Calls after that: forward to ${result.forwardTo} until ${lastPaidDay(result.forwardUntil)}, then out-of-service for two weeks`
        : `Calls after that: out-of-service message for two weeks`,
      `Release on: ${lastPaidDay(result.releaseOn) || "unknown"}`,
      `Last 30 days: ${result.usage?.calls ?? 0} calls answered, ${result.usage?.bookings ?? 0} appointments booked`,
      `Requested by: ${requestedByEmail || "unknown"}`,
      `Organization: ${authResult.organizationId}`,
    ];
    const subject = `Cancellation: ${result.plan || "plan"} — ${String(body.reason || "Not given")}`;
    const sent = await sendEmail(SUPPORT_INBOX, subject, lines.join("\n"));
    if (!sent) console.error(`[Billing cancel] org ${authResult.organizationId} cancelled but the team email did NOT send`);

    return json({
      cancelled: true,
      cancelsAt: result.cancelsAt,
      plan: result.plan,
      amount: result.amount,
      disposition: result.disposition,
      forwardTo: result.forwardTo,
      forwardUntil: result.forwardUntil,
      releaseOn: result.releaseOn,
      numbers,
    });
  } catch (err) {
    console.error("[Billing cancel] Error:", String(err).slice(0, 200));
    return json({ error: "Could not cancel the subscription" }, 500);
  }
}
