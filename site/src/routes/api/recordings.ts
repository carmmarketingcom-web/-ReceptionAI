/**
 * GET /api/recordings — list call recordings for the authenticated org.
 *
 * Voicemail audio IS stored now: the conversation row is created when the call is ANSWERED
 * (serve.ts `ensureCallConversation`), so the recordings INSERT has a valid conversation_id
 * when `call.recording.saved` arrives mid-call. Nothing is invented: a row only exists when
 * Telnyx actually delivered a recording, and the caller name/number is joined from the row's
 * conversation → contact (null → the page says "Unknown Caller" / "Number not recorded").
 *
 * Playback: the URL Telnyx delivers in the webhook expires, so the durable handle is the
 * recording id (recordings.twilio_recording_sid). `recordingUrl` here is OUR signed endpoint
 * (`/api/recordings/audio?id=…&exp=…&sig=…`) which exchanges that id for a fresh download URL
 * on every play. It is null when no audio is stored, and the page then says "No audio stored".
 *
 * IMPORTANT: production traffic is served by the inline handlers in serve.ts /
 * site/serve.ts (see AUDIT_VOICE.md §0). This file and those handlers must stay in sync.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
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

// ── Signed playback links ───────────────────────────────────────────────────
// An <audio> element cannot send an Authorization header, so the player link carries its own
// short-lived signature (HMAC-SHA256 over id+expiry, keyed with JWT_SECRET). Links are only
// minted for rows in the caller's own org, so they cannot be replayed against someone else's.
export const RECORDING_LINK_TTL_SECONDS = 6 * 60 * 60;

export function recordingAudioPath(recordingId: string): string {
  const exp = Math.floor(Date.now() / 1000) + RECORDING_LINK_TTL_SECONDS;
  const sig = createHmac("sha256", process.env.JWT_SECRET || "")
    .update(`${recordingId}.${exp}`)
    .digest("hex");
  return `/api/recordings/audio?id=${encodeURIComponent(recordingId)}&exp=${exp}&sig=${sig}`;
}

export function verifyRecordingAudioSig(recordingId: string, exp: number, sig: string): boolean {
  const expected = createHmac("sha256", process.env.JWT_SECRET || "")
    .update(`${recordingId}.${exp}`)
    .digest("hex");
  const a = Buffer.from(sig, "utf-8");
  const b = Buffer.from(expected, "utf-8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface RecordingRow {
  id: string;
  conversationId: string | null;
  recordingUrl: string | null;
  twilioRecordingSid: string | null;
  durationSeconds: number | null;
  transcriptionText: string | null;
  transcriptionStatus: string | null;
  createdAt: Date | string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactPhone: string | null;
}

export function shapeRecording(row: RecordingRow) {
  // Audio exists only if Telnyx gave us something to store: a recording id (durable) or a URL.
  const hasAudio = Boolean(row.twilioRecordingSid || row.recordingUrl);
  return {
    id: row.id,
    conversationId: row.conversationId || null,
    callerName: fullName(row.contactFirstName, row.contactLastName),
    callerNumber: row.contactPhone || null,
    recordingUrl: hasAudio ? recordingAudioPath(row.id) : null,
    audioAvailable: hasAudio,
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

    // No mock/demo rows: an empty list says exactly that.
    if (isMockMode()) {
      return json({ recordings: [], total: 0, limit });
    }

    const db = getDb();
    const rows = await db
      .select({
        id: recordings.id,
        conversationId: recordings.conversationId,
        recordingUrl: recordings.recordingUrl,
        twilioRecordingSid: recordings.twilioRecordingSid,
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
