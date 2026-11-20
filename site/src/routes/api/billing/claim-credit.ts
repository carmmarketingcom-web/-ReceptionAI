/**
 * POST /api/billing/claim-credit
 *
 * The customer presses "Claim your half-month credit" on Billing. Owner amendment 2026-11-20:
 * the credit is claimed by the customer and is NEVER applied automatically — no timer, no cron,
 * no sweep. If nobody presses the button, nothing is credited.
 *
 * Answers one of three states, with the amount:
 *   applied         — the Stripe customer-balance credit was written just now, once
 *   already_claimed — a credit row already exists; nothing more is ever applied
 *   not_eligible    — no live subscription, under 90 days, cancelled, or no price known
 *
 * NOTE: production traffic is served by the inline handler in `serve.ts` / `site/serve.ts` (they
 * shadow `src/routes/api/*.ts` — see AUDIT_VOICE.md §0). Both read the ONE shared implementation
 * in `src/lib/billing-controls.ts`, so the behaviour cannot drift between deployments.
 *
 * Org-scoped and authenticated: the org comes from the session, never from the body.
 */
import { createFileRoute } from "@tanstack/react-router";
import { neon } from "@neondatabase/serverless";
import { authenticate } from "../../../lib/middleware";
import { claimThreeMonthCredit } from "../../../lib/billing-controls";
import { sendEmail } from "../../../lib/email";

export const Route = createFileRoute("/api/billing/claim-credit")({});

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
    const claim = await claimThreeMonthCredit({
      sql: sql as any,
      stripeKey: process.env.STRIPE_SECRET_KEY || "",
      organizationId: authResult.organizationId,
      notify: async (subject: string, body: string) => {
        const sent = await sendEmail(SUPPORT_INBOX, subject, `${body}\nOrganization: ${authResult.organizationId}`);
        if (!sent) console.error(`[Billing] credit notice NOT emailed: ${subject}`);
      },
    });

    if (claim.status === "applied") {
      console.log(
        `[Billing] half-month credit claimed by org ${authResult.organizationId}: ${claim.amount || "amount unknown"}`
      );
    }

    return json(
      {
        status: claim.status,
        amountCents: claim.amountCents,
        amount: claim.amount,
        reason: claim.reason,
        error: claim.error,
      },
      claim.httpStatus
    );
  } catch (err) {
    console.error("[Billing claim-credit] Error:", String(err).slice(0, 200));
    return json({ error: "Could not apply the credit just now. Nothing was changed." }, 500);
  }
}
