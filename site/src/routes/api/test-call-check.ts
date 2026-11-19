// ─── Test-call check API Route ────────────────────────────────────────────────
// GET /api/test-call-check
//
// Backs the "I just tested it — check my last call" button on Getting Started. It answers one
// question from real rows: is there a call on this org, and did it book anything? A customer
// who has not called yet gets `hasCall: false` — the button then says we cannot see a call,
// because claiming one we cannot see would be a lie about their own account.
//
// Keep in sync with the inline handler in serve.ts and the other serve.ts tree.

import { authenticate } from "../../../lib/middleware";
import { neon } from "@neondatabase/serverless";

export async function GET({ request }: { request: Request }) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return new Response(JSON.stringify({ error: "DB not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    const sql = neon(dbUrl);

    // Newest real call for this org only — org-scoped, demo calls excluded.
    const rows = (await sql`
      SELECT id, started_at, ended_at, status
      FROM conversations
      WHERE organization_id = ${auth.organizationId}
        AND type = 'call'
        AND is_demo = false
      ORDER BY started_at DESC
      LIMIT 1
    `) as Array<{ id: string; started_at: string | null; ended_at: string | null; status: string | null }>;

    const call = rows[0];
    if (!call) {
      return new Response(
        JSON.stringify({ hasCall: false, startedAt: null, durationSeconds: null, booked: 0, status: null }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const bookedRows = (await sql`
      SELECT count(*)::int AS booked FROM appointments WHERE conversation_id = ${call.id}
    `) as Array<{ booked: number }>;

    const started = call.started_at ? new Date(call.started_at) : null;
    const ended = call.ended_at ? new Date(call.ended_at) : null;
    const durationSeconds =
      started && ended && ended.getTime() >= started.getTime()
        ? Math.round((ended.getTime() - started.getTime()) / 1000)
        : null;

    return new Response(
      JSON.stringify({
        hasCall: true,
        startedAt: call.started_at,
        durationSeconds,
        booked: Number(bookedRows[0]?.booked || 0),
        status: call.status,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Test call check] Error:", error);
    return new Response(JSON.stringify({ error: "Failed to check calls" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
