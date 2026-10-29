/**
 * GET /api/recordings/audio?id=…&exp=…&sig=… — resolve a stored voicemail to playable audio.
 *
 * Why a signed query link instead of the usual Authorization header: this URL is the `src` of
 * an <audio> element, which cannot send headers. The signature (HMAC-SHA256 over id+expiry,
 * keyed with JWT_SECRET, minted only by /api/recordings for rows in the caller's own org) is
 * the authorization, and it expires after 6 hours.
 *
 * Why a redirect instead of proxying bytes: the recording URL Telnyx sends in the webhook is
 * time-limited. The durable handle we store is the recording id (recordings.twilio_recording_sid);
 * we exchange it for a fresh download URL on every play and 302 the browser straight to it.
 * If Telnyx cannot be asked, the URL delivered at call time is used as-is. If nothing is
 * stored, the response says so — no invented audio.
 *
 * IMPORTANT: production traffic is served by the inline handler in serve.ts / site/serve.ts.
 * Keep this file in sync with it.
 */
import { getDb, isMockMode } from "../../../db/index";
import { recordings } from "../../../db/schema/index";
import { eq } from "drizzle-orm";
import { verifyRecordingAudioSig } from "../recordings";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const TELNYX_API = "https://api.telnyx.com/v2";

export async function GET({ request }: { request: Request }) {
  try {
    const url = new URL(request.url);
    const recordingId = url.searchParams.get("id") || "";
    const exp = parseInt(url.searchParams.get("exp") || "0", 10) || 0;
    const sig = url.searchParams.get("sig") || "";
    if (!recordingId || !exp || !sig) {
      return json({ error: "id, exp and sig are required" }, 400);
    }
    if (Math.floor(Date.now() / 1000) > exp) {
      return json({ error: "This recording link expired — reload the Recordings page." }, 410);
    }
    if (!verifyRecordingAudioSig(recordingId, exp, sig)) {
      return json({ error: "Invalid recording link" }, 403);
    }
    if (isMockMode()) {
      return json({ error: "No database configured" }, 503);
    }

    const db = getDb();
    const rows = await db
      .select({
        id: recordings.id,
        recordingUrl: recordings.recordingUrl,
        twilioRecordingSid: recordings.twilioRecordingSid,
      })
      .from(recordings)
      .where(eq(recordings.id, recordingId))
      .limit(1);
    const rec = rows[0];
    if (!rec) return json({ error: "Recording not found" }, 404);

    let target: string | null = null;
    const apiKey = process.env.TELNYX_API_KEY || "";
    if (rec.twilioRecordingSid && apiKey) {
      try {
        const res = await fetch(
          `${TELNYX_API}/recordings/${encodeURIComponent(rec.twilioRecordingSid)}`,
          { headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" } }
        );
        if (res.ok) {
          const body = (await res.json()) as any;
          const urls = body?.data?.download_urls || {};
          target = urls.mp3 || urls.wav || null;
        } else {
          console.warn(`[Recordings audio] Telnyx download-url lookup failed (${res.status})`);
        }
      } catch (err) {
        console.warn("[Recordings audio] Telnyx download-url lookup error:", String(err).slice(0, 120));
      }
    }
    if (!target) target = rec.recordingUrl || null;
    if (!target) return json({ error: "No audio is stored for this recording." }, 404);

    return new Response(null, {
      status: 302,
      headers: { Location: target, "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[Recordings audio] GET error:", error);
    return json({ error: "Failed to resolve recording audio" }, 500);
  }
}
