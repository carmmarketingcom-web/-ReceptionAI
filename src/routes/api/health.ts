/**
 * GET /api/health
 *
 * Org-scoped diagnostic data for the authenticated organization, used by the
 * /dashboard/health self-serve page.
 *
 * NOTE: in production `serve.ts` answers `/api/*` from its own inline handlers, so the
 * public `/api/health` there is the PLATFORM health check (database, Telnyx balance,
 * SMS/email delivery). The dashboard reads `GET /api/health/org` instead — see
 * `src/routes/api/health/org.ts` and `src/lib/org-health.ts`.
 *
 * This file is kept so the path still resolves outside the production server; the payload
 * comes from the same shared builder, so it cannot drift from what the dashboard shows.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({});


import { neon } from "@neondatabase/serverless";
import { authenticate } from "../../lib/middleware";
import { buildOrgHealth, normalizeOrgHealth } from "../../lib/org-health";

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
}

export async function GET({ request }: { request: Request }) {
  const authResult = await authenticate(request);
  if (authResult instanceof Response) return authResult;

  const { organizationId } = authResult;
  const db = sql();

  try {
    const payload = await buildOrgHealth(db as any, organizationId);
    return new Response(JSON.stringify(normalizeOrgHealth(payload)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[Health API] Error:", errMsg);
    return new Response(
      JSON.stringify({ error: "Health check failed", detail: errMsg }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
