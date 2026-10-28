/**
 * Recordings API
 *
 * GET /api/recordings — List call recordings for the authenticated organization.
 *
 * Backed by the `recordings` table. IMPORTANT CONTEXT: nothing writes this table
 * yet — voicemail audio capture is a known Phase-2 gap (the recordings INSERT
 * still fails its FK because the conversation lookup keys on a never-populated
 * `twilio_call_sid`). So in practice this endpoint returns an empty list today,
 * and the dashboard renders the honest empty state instead of inventing audio,
 * names or AI summaries.
 *
 * If a row ever does exist, the caller name/number is joined from the row's
 * conversation → contact; when those are missing the field is null and the page
 * says "Unknown Caller" / "Number not recorded" rather than making one up.
 *
 * IMPORTANT: production traffic is served by the inline handlers in serve.ts /
 * site/serve.ts (see AUDIT_VOICE.md §0). This file and those handlers must stay in sync.
 */
import { authenticate } from "../../lib/middleware";
import { getDb, isMockMode } from "../../db/index";
import { contacts, conversations, recordings } from "../../db/schema/index";
import { eq, desc } from "drizzle-orm";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function iso(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function fullName(first: string | null, last: string | null): string | null {
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || null;
}

export interface RecordingRow {
  id: string;
  conversationId: string | null;
  recordingUrl: string | null;
  durationSeconds: number | null;
  transcriptionText: string | null;
  transcriptionStatus: string | null;
  createdAt: Date | string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactPhone: string | null;
}

export function shapeRecording(row: RecordingRow) {
  return {
    id: row.id,
    conversationId: row.conversationId || null,
    callerName: fullName(row.contactFirstName, row.contactLastName),
    callerNumber: row.contactPhone || null,
    recordingUrl: row.recordingUrl || null,
    durationSeconds:
      row.durationSeconds === null || row.durationSeconds === undefined
        ? null
        : Number(row.durationSeconds),
    transcriptionText: row.transcriptionText || null,
    transcriptionStatus: row.transcriptionStatus || null,
    createdAt: iso(row.createdAt),
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

    // No mock/demo rows: nothing is recorded yet, and an empty list says exactly that.
    if (isMockMode()) {
      return json({ recordings: [], total: 0, limit });
    }

    const db = getDb();
    const rows = await db
      .select({
        id: recordings.id,
        conversationId: recordings.conversationId,
        recordingUrl: recordings.recordingUrl,
        durationSeconds: recordings.durationSeconds,
        transcriptionText: recordings.transcriptionText,
        transcriptionStatus: recordings.transcriptionStatus,
        createdAt: recordings.createdAt,
        contactFirstName: contacts.firstName,
        contactLastName: contacts.lastName,
        contactPhone: contacts.phone,
      })
      .from(recordings)
      .leftJoin(conversations, eq(recordings.conversationId, conversations.id))
      .leftJoin(contacts, eq(conversations.contactId, contacts.id))
      .where(eq(recordings.organizationId, authResult.organizationId))
      .orderBy(desc(recordings.createdAt))
      .limit(limit);

    const shaped = (rows as RecordingRow[]).map(shapeRecording);

    return json({ recordings: shaped, total: shaped.length, limit });
  } catch (error) {
    console.error("[Recordings API] GET error:", error);
    return json({ error: "Failed to fetch recordings" }, 500);
  }
}
