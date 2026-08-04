/**
 * GET /api/health
 *
 * Returns diagnostic data for the authenticated organization:
 *   - Phone number status
 *   - Last call info
 *   - Webhook status
 *   - Calendar connection status
 *
 * Used by the /dashboard/health self-serve page.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({});


import { neon } from "@neondatabase/serverless";
import { authenticate } from "../../lib/middleware";

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
    // 1. Phone number status
    const phoneRows = await db`
      SELECT phone_number, status, sms_enabled, voice_enabled, telnyx_number_id
      FROM phone_numbers
      WHERE organization_id = ${organizationId}
      ORDER BY is_active DESC, created_at DESC
      LIMIT 1
    `;
    const phoneStatus = phoneRows[0]
      ? {
          provisioned: true,
          number: phoneRows[0].phone_number,
          status: phoneRows[0].status,
          smsEnabled: phoneRows[0].sms_enabled,
          voiceEnabled: phoneRows[0].voice_enabled,
        }
      : { provisioned: false, number: null, status: "none", smsEnabled: false, voiceEnabled: false };

    // 2. Last call
    const lastCallRow = await db`
      SELECT c.external_phone as caller_number, c.started_at, c.ended_at,
             c.status, c.duration_seconds, c.ai_handled, c.escalated_to_human
      FROM conversations c
      WHERE c.organization_id = ${organizationId}
        AND c.type = 'voice'
      ORDER BY c.started_at DESC
      LIMIT 1
    `;
    const lastCall = lastCallRow[0]
      ? {
          found: true,
          callerNumber: lastCallRow[0].caller_number,
          time: lastCallRow[0].started_at,
          duration: lastCallRow[0].duration_seconds,
          outcome: lastCallRow[0].ai_handled
            ? "AI handled"
            : lastCallRow[0].escalated_to_human
              ? "Transferred to human"
              : lastCallRow[0].status || "unknown",
        }
      : { found: false };

    // 3. Webhook status — check if we've received webhooks recently
    // We use the most recent call.initiated timestamp as proxy for webhook health
    const webhookRow = await db`
      SELECT c.started_at, pn.phone_number as org_number
      FROM conversations c
      LEFT JOIN phone_numbers pn ON pn.organization_id = c.organization_id AND pn.is_active = true
      WHERE c.organization_id = ${organizationId}
        AND c.type = 'voice'
      ORDER BY c.started_at DESC
      LIMIT 1
    `;

    const telnyxApiKey = process.env.TELNYX_API_KEY || "";
    let webhookConfigured = false;
    let webhookLastReceived: string | null = webhookRow[0]?.started_at || null;

    // Check Telnyx webhook config if we have a number and API key
    if (phoneRows[0]?.telnyx_number_id && telnyxApiKey) {
      try {
        const res = await fetch(
          `https://api.telnyx.com/v2/phone_numbers/${phoneRows[0].telnyx_number_id}/voice`,
          { headers: { Authorization: `Bearer ${telnyxApiKey}` } },
        );
        if (res.ok) {
          const data = (await res.json()) as any;
          webhookConfigured =
            data.data?.connection_name === process.env.TELNYX_CONNECTION_NAME ||
            data.data?.connection_id === process.env.TELNYX_CONNECTION_ID ||
            !!data.data?.call_hangup_url || !!data.data?.call_answering_url;
        }
      } catch {
        // Can't reach Telnyx, assume OK if we've received webhooks
        webhookConfigured = !!webhookLastReceived;
      }
    } else {
      webhookConfigured = !!webhookLastReceived;
    }

    const webhookStatus = {
      configured: webhookConfigured,
      lastReceived: webhookLastReceived,
      recent: webhookLastReceived
        ? (Date.now() - new Date(webhookLastReceived).getTime()) < 24 * 60 * 60 * 1000
        : false,
    };

    // 4. Schedule status — count upcoming appointments
    const scheduleRow = await db`
      SELECT COUNT(*) as count
      FROM appointments
      WHERE organization_id = ${organizationId}
        AND start_time >= NOW()
        AND status IN ('confirmed', 'scheduled')
    `;
    const scheduleStatus = {
      upcoming: Number(scheduleRow[0]?.count || 0),
    };

    // 5. Aggregate status
    const allOk =
      phoneStatus.provisioned &&
      lastCall.found &&
      webhookStatus.configured;

    // 6. Troubleshooting tips
    const tips: string[] = [];
    if (!phoneStatus.provisioned) {
      tips.push("No phone number is provisioned. Contact support to get a phone number assigned.");
    } else if (phoneStatus.status === "pending_port") {
      tips.push("Your phone number port is still in progress. Ports can take 5-10 business days. Once complete, your number will be live.");
    }
    if (!lastCall.found) {
      tips.push("No calls received yet. Make sure you're forwarding your business calls to your ReceptionAI number. If you brought your own number, ensure call forwarding is set up with your current carrier.");
    }
    if (!webhookStatus.configured) {
      tips.push("The Telnyx webhook may not be configured correctly. Our system needs to receive call events. Try restarting the connection or contact support.");
    }

    return new Response(
      JSON.stringify({
        phoneStatus,
        lastCall,
        webhookStatus,
        scheduleStatus,
        allOk,
        tips,
        checkedAt: new Date().toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[Health API] Error:", errMsg);
    return new Response(
      JSON.stringify({ error: "Health check failed", detail: errMsg }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
