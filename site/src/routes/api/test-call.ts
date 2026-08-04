/**
 * POST /api/test-call
 *
 * Triggers a test call to the authenticated organization's own phone number
 * using Telnyx outbound calling. The call connects to the AI receptionist,
 * proving the full pipeline works end-to-end.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/test-call")({});


import { neon } from "@neondatabase/serverless";
import { authenticate } from "../../lib/middleware";

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
}

export async function POST({ request }: { request: Request }) {
  const authResult = await authenticate(request);
  if (authResult instanceof Response) return authResult;

  const { organizationId } = authResult;
  const db = sql();

  const telnyxApiKey = process.env.TELNYX_API_KEY;
  if (!telnyxApiKey) {
    return new Response(
      JSON.stringify({ success: false, error: "Telnyx not configured on server" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    // Get org phone number
    const phoneRow = await db`
      SELECT phone_number, telnyx_number_id, voice_enabled
      FROM phone_numbers
      WHERE organization_id = ${organizationId}
        AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!phoneRow[0]) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No phone number found",
          tip: "Your organization doesn't have a phone number yet. Please provision one first.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const orgPhone = phoneRow[0].phone_number;

    // Get owner phone to call
    const ownerRow = await db`
      SELECT phone FROM users
      WHERE organization_id = ${organizationId}
        AND role = 'owner'
      ORDER BY created_at ASC
      LIMIT 1
    `;

    // Use owner phone, fallback to org phone (self-call — AI will answer itself)
    const toNumber = ownerRow[0]?.phone || orgPhone;

    // Get the app's public webhook URL base
    const baseUrl =
      (request.headers.get("x-forwarded-proto") || "https") +
      "://" +
      (request.headers.get("host") || "localhost:3000");

    // Initiate outbound call via Telnyx
    const connectionId = process.env.TELNYX_CONNECTION_ID;
    if (!connectionId) {
      return new Response(
        JSON.stringify({ success: false, error: "TELNYX_CONNECTION_ID not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const res = await fetch("https://api.telnyx.com/v2/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${telnyxApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        connection_id: connectionId,
        to: toNumber,
        from: orgPhone,
        webhook_url: `${baseUrl}/api/telnyx/voice`,
        // Optional: custom caller ID name for testing
        caller_id_name: "ReceptionAI Test",
      }),
    });

    const telnyxResponse = (await res.json()) as any;

    if (!res.ok) {
      const errMsg = telnyxResponse?.errors?.[0]?.detail || "Telnyx API error";
      return new Response(
        JSON.stringify({ success: false, error: errMsg, telnyxResponse }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Test call initiated to ${toNumber} from ${orgPhone}`,
        callControlId: telnyxResponse.data?.call_control_id,
        callLegId: telnyxResponse.data?.call_leg_id,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[Test Call] Error:", errMsg);
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
