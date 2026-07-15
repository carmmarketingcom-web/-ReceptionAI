// ─── Twilio SMS Inbound Webhook API Route ─────────────────────────────────────
// POST /api/sms/incoming
// Twilio sends a POST request here when an inbound SMS arrives.
// Returns the AI-generated reply.

import {
  handleInboundSms,
  parseSmsWebhook,
  generateSmsResponse,
  sendSmsReply,
} from "../../../../voice-engine/src/sms/handler.ts";

const DEFAULT_ORG_ID = "default";

export async function POST({ request }: { request: Request }) {
  try {
    const text = await request.text();
    const params = new URLSearchParams(text);
    const webhook = parseSmsWebhook(params);

    console.log(`[SMS Incoming] From: ${webhook.From}, Body: "${webhook.Body.substring(0, 100)}"`);

    // In production, look up org by the "To" phone number
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
    };

    // Process the message through the AI engine
    const aiResponse = await handleInboundSms(webhook, orgConfig);
    const smsBody = generateSmsResponse(aiResponse);

    // Send the reply via Twilio API
    await sendSmsReply(webhook.From, webhook.To, smsBody);

    // Return success to Twilio
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`,
      {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      },
    );
  } catch (error) {
    console.error("[SMS Incoming] Error:", error);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response><Message>I'm sorry, we're experiencing technical difficulties. Please try again later.</Message></Response>`,
      {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      },
    );
  }
}