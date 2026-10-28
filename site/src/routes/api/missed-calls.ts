/**
 * Missed Calls API
 *
 * GET   /api/missed-calls  — List missed calls for the authenticated organization
 * PATCH /api/missed-calls  — Update the callback status of one missed call
 *                            body: { id: uuid, callbackStatus: pending|contacted|resolved|declined }
 *
 * Backed by the `missed_calls` table, which the voice pipeline writes whenever an inbound
 * call ends without the caller engaging (the matching conversations row gets status='missed').
 *
 * IMPORTANT: production traffic is served by the inline handlers in serve.ts /
 * site/serve.ts (see AUDIT_VOICE.md §0). This file and those handlers must stay in sync.
 *
 * Voicemail audio/transcription is not captured yet — if the columns are empty the API
 * returns null and the dashboard renders "Not available" rather than inventing a message.
 */
import { z } from "zod";
import { authenticate } from "../../lib/middleware";
import { getDb, isMockMode } from "../../db/index";
import { missedCalls } from "../../db/schema/index";
import { and, eq, desc } from "drizzle-orm";

const callbackStatusSchema = z.enum([
  "pending",
  "contacted",
  "resolved",
  "declined",
]);

const updateCallbackSchema = z.object({
  id: z.string().uuid(),
  callbackStatus: callbackStatusSchema,
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type MissedCallRow = {
  id: string;
  callerNumber: string | null;
  callerName: string | null;
  ringDurationSeconds: number | null;
  callbackRequested: boolean | null;
  callbackStatus: string | null;
  voicemailUrl: string | null;
  voicemailTranscription: string | null;
  createdAt: Date | string | null;
};

export function shapeMissedCall(row: MissedCallRow) {
  const createdAt =
    row.createdAt instanceof Date
      ? row.createdAt.toISOString()
      : row.createdAt
        ? new Date(row.createdAt).toISOString()
        : null;
  return {
    id: row.id,
    callerNumber: row.callerNumber || null,
    callerName: row.callerName || null,
    ringDurationSeconds:
      row.ringDurationSeconds === null || row.ringDurationSeconds === undefined
        ? null
        : Number(row.ringDurationSeconds),
    callbackRequested: row.callbackRequested === true,
    callbackStatus: row.callbackStatus || "pending",
    voicemailUrl: row.voicemailUrl || null,
    voicemailTranscription: row.voicemailTranscription || null,
    createdAt,
  };
}

export async function GET({ request }: { request: Request }) {
  try {
    const authResult = await authenticate(request);
    if (authResult instanceof Response) return authResult;

    const url = new URL(request.url);
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || "100", 10) || 100, 1),
      500
    );

    // No mock/demo rows: an empty list is the honest answer when nothing is recorded.
    if (isMockMode()) {
      return json({ missedCalls: [], total: 0, limit });
    }

    const db = getDb();
    const rows = await db
      .select()
      .from(missedCalls)
      .where(eq(missedCalls.organizationId, authResult.organizationId))
      .orderBy(desc(missedCalls.createdAt))
      .limit(limit);

    const shaped = rows.map(shapeMissedCall);
    return json({ missedCalls: shaped, total: shaped.length, limit });
  } catch (error) {
    console.error("[Missed Calls API] GET error:", error);
    return json({ error: "Failed to fetch missed calls" }, 500);
  }
}

export async function PATCH({ request }: { request: Request }) {
  try {
    const authResult = await authenticate(request);
    if (authResult instanceof Response) return authResult;

    const body = await request.json().catch(() => null);
    const parsed = updateCallbackSchema.safeParse(body);
    if (!parsed.success) {
      return json(
        { error: "id (uuid) and callbackStatus are required" },
        400
      );
    }

    if (isMockMode()) {
      return json({ error: "Database not configured" }, 503);
    }

    const db = getDb();
    const updated = await db
      .update(missedCalls)
      .set({ callbackStatus: parsed.data.callbackStatus })
      .where(
        and(
          eq(missedCalls.id, parsed.data.id),
          eq(missedCalls.organizationId, authResult.organizationId)
        )
      )
      .returning({ id: missedCalls.id, callbackStatus: missedCalls.callbackStatus });

    if (updated.length === 0) {
      return json({ error: "Missed call not found" }, 404);
    }

    return json({
      id: updated[0].id,
      callbackStatus: updated[0].callbackStatus,
    });
  } catch (error) {
    console.error("[Missed Calls API] PATCH error:", error);
    return json({ error: "Failed to update missed call" }, 500);
  }
}
