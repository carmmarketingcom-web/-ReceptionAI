/**
 * GET /api/dashboard/call-outcomes?limit=50
 *
 * Org-scoped reminder-call and transfer outcomes for the dashboard's "Call outcomes" page.
 *
 * NOTE: production traffic is served by the inline handler in `serve.ts` / `site/serve.ts`
 * (they shadow `src/routes/api/*.ts` — see AUDIT_VOICE.md §0). Both read the ONE shared
 * implementation in `src/lib/call-outcomes.ts`, so the payload cannot drift between
 * deployments.
 *
 * Reminder calls: `appointment_reminders` rows with channel='voice' and
 * reminder_type='24h_call' (the automated 24-hour reminder call), newest scheduled first.
 * Transfers: `transfer_events` rows written by the voice server when it dials the owner.
 * Real rows only — an empty organization gets empty arrays and zeroed summaries.
 */
import { createFileRoute } from "@tanstack/react-router";
import { neon } from "@neondatabase/serverless";
import { authenticate } from "../../../lib/middleware";
import { buildCallOutcomes } from "../../../lib/call-outcomes";

export const Route = createFileRoute("/api/dashboard/call-outcomes")({});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET({ request }: { request: Request }) {
  const authResult = await authenticate(request);
  if (authResult instanceof Response) return authResult;

  const { organizationId } = authResult;
  const url = new URL(request.url);
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return json({ error: "DB not configured" }, 500);

  try {
    const sql = neon(dbUrl);
    const payload = await buildCallOutcomes(sql as any, organizationId, url.searchParams.get("limit"));
    return json(payload);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[Call outcomes API] Error:", errMsg.slice(0, 200));
    return json({ error: "Failed to fetch call outcomes" }, 500);
  }
}
