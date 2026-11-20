/**
 * GET /api/billing/manage
 *
 * What the Billing page's "Manage subscription" block shows: the plan, its monthly price, the
 * member-since date, whether the 30-day gate is open, whether a cancellation is pending and
 * whether the once-only three-month credit has been applied.
 *
 * NOTE: production traffic is served by the inline handler in `serve.ts` / `site/serve.ts` (they
 * shadow `src/routes/api/*.ts` — see AUDIT_VOICE.md §0). Both read the ONE shared implementation
 * in `src/lib/billing-controls.ts`, so the payload cannot drift between deployments.
 *
 * Org-scoped and authenticated. A missing subscription (the founder org, a Carm one-time buyer)
 * answers `eligible:false` with a reason instead of an error.
 */
import { createFileRoute } from "@tanstack/react-router";
import { neon } from "@neondatabase/serverless";
import { authenticate } from "../../../lib/middleware";
import { getBillingManage } from "../../../lib/billing-controls";

export const Route = createFileRoute("/api/billing/manage")({});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET({ request }: { request: Request }) {
  const authResult = await authenticate(request);
  if (authResult instanceof Response) return authResult;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return json({ error: "DB not configured" }, 500);

  try {
    const sql = neon(dbUrl);
    const manage = await getBillingManage({
      sql: sql as any,
      stripeKey: process.env.STRIPE_SECRET_KEY || "",
      organizationId: authResult.organizationId,
    });
    return json(manage);
  } catch (err) {
    console.error("[Billing manage] Error:", String(err).slice(0, 200));
    return json({ error: "Could not read billing settings" }, 500);
  }
}
