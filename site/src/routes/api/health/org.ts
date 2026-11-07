/**
 * GET /api/health/org
 *
 * Org-scoped health payload for the dashboard's System health page.
 *
 * `GET /api/health` is the PLATFORM health check (database, Telnyx balance, SMS/email
 * delivery) and has no notion of an organization — reading it from the dashboard is what
 * broke the page. This route serves the org payload, built by the single shared
 * implementation in `src/lib/org-health.ts`, which `serve.ts` also uses for the same path.
 *
 * Requires a dashboard bearer token; every query is scoped to the caller's organization.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health/org")({});


import { neon } from "@neondatabase/serverless";
import { authenticate } from "../../../lib/middleware";
import { buildOrgHealth, normalizeOrgHealth } from "../../../lib/org-health";

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
}

export async function GET({ request }: { request: Request }) {
  const authResult = await authenticate(request);
  if (authResult instanceof Response) return authResult;

  const { organizationId } = authResult;

  try {
    const payload = await buildOrgHealth(sql() as any, organizationId);
    return new Response(JSON.stringify(normalizeOrgHealth(payload)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[Org Health API] Error:", errMsg);
    return new Response(
      JSON.stringify({ error: "Health check failed", detail: errMsg }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
