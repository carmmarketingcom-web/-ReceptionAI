// ─── Twilio Voice Inbound Webhook API Route ───────────────────────────────────
// POST /api/voice/incoming
// Twilio sends a POST request here when an inbound call arrives.
// Returns TwiML that opens a Media Stream WebSocket.

import { generateVoiceTwiML, parseVoiceWebhook, getMediaStreamWsUrl } from "../../../../voice-engine/src/voice/handler.ts";

// Default org config for Twilio webhook (in production, look up by phone number)
const DEFAULT_ORG_ID = "default";

export async function POST({ request }: { request: Request }) {
  try {
    const text = await request.text();
    const params = new URLSearchParams(text);
    const webhook = parseVoiceWebhook(params);

    console.log(`[Voice Incoming] CallSid: ${webhook.CallSid}, From: ${webhook.From}, To: ${webhook.To}`);

    // In production, look up org by the "To" phone number
    // const orgConfig = await lookupOrgByPhoneNumber(webhook.To);
    const orgConfig = {
      id: DEFAULT_ORG_ID,
      name: "Your Business",
      industry: "Service",
      businessHours: [],
      timezone: "America/Chicago",
      locale: "en",
      services: [],
      faqEntries: [],
      escalationPhone: process.env.ESCALATION_PHONE || "",
      calendarConfig: { provider: "internal" as const },
      greetingMessage: "Thank you for calling. I'm your AI receptionist. How can I help you today?",
    };

    // Get the WebSocket URL for Media Streams
    const wsUrl = getMediaStreamWsUrl();
    const twiml = generateVoiceTwiML(webhook, orgConfig, wsUrl);

    return new Response(twiml, {
      status: 200,
      headers: {
        "Content-Type": "text/xml",
      },
    });
  } catch (error) {
    console.error("[Voice Incoming] Error:", error);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>I'm sorry, we're experiencing technical difficulties. Goodbye.</Say></Response>`,
      {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      },
    );
  }
}