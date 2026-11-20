/**
 * POST /api/billing/resume — undo a pending cancellation.
 *
 * Sets `cancel_at_period_end=false` on the Stripe subscription, mirrors that on `subscriptions`,
 * and stamps `resumed_at` on the open `subscription_cancellations` row. Idempotent: a second call
 * simply re-states the same Stripe value.
 *
 * NOTE: production traffic is served by the inline handler in `serve.ts` / `site/serve.ts`; both
 * read the ONE shared implementation in `src/lib/billing-controls.ts`. With no STRIPE_SECRET_KEY
 * nothing is changed — the call answers a clear 503 instead.
 */
import { createFileRoute } from "@tanstack/react-router";
import { neon } from "@neondatabase/serverless";
import { authenticate } from "../../../lib/middleware";
import { resumeSubscription } from "../../../lib/billing-controls";

export const Route = createFileRoute("/api/billing/resume")({});

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
    const result = await resumeSubscription({
      sql: sql as any,
      stripeKey: process.env.STRIPE_SECRET_KEY || "",
      organizationId: authResult.organizationId,
    });
    if (!result.ok) return json({ error: result.error }, result.status);
    return json({ resumed: true, cancelsAt: null });
  } catch (err) {
    console.error("[Billing resume] Error:", String(err).slice(0, 200));
    return json({ error: "Could not resume the subscription" }, 500);
  }
}
