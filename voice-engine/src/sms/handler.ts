// ─── SMS Webhook Handler ─────────────────────────────────────────────────────
// Handles inbound SMS messages via Twilio and generates AI responses.

import type { TwilioSmsWebhook, OrganizationConfig } from "../types/index.ts";
import { processTextMessage } from "../voice/stream.ts";

/**
 * Handle an inbound SMS webhook from Twilio.
 * Returns the AI-generated response text.
 */
export async function handleInboundSms(
  webhook: TwilioSmsWebhook,
  orgConfig: OrganizationConfig,
): Promise<string> {
  const conversationId = `sms-${webhook.From}-${orgConfig.id}`;
  const text = webhook.Body || "";

  console.log(`[SMS] From: ${webhook.From}, Org: ${orgConfig.id}, Text: "${text.substring(0, 100)}"`);

  // Handle media messages (MMS)
  if (webhook.NumMedia && parseInt(webhook.NumMedia) > 0) {
    const mediaUrl = webhook.MediaUrl0;
    const mediaType = webhook.MediaContentType0;
    console.log(`[SMS] Media attached: ${mediaUrl} (${mediaType})`);
  }

  if (!text.trim()) {
    return "Thank you for your message. How can I help you today?";
  }

  // Process through conversation engine
  const response = await processTextMessage(
    conversationId,
    orgConfig,
    text,
    "sms",
  );

  return response;
}

/**
 * Generate a Twilio-compatible SMS response.
 * Returns the body text for the reply message.
 */
export function generateSmsResponse(aiResponse: string): string {
  // Truncate if too long (Twilio limit is 1600 chars per segment)
  if (aiResponse.length > 1600) {
    return aiResponse.substring(0, 1597) + "...";
  }
  return aiResponse;
}

/**
 * Parse Twilio SMS webhook form parameters into a typed object.
 */
export function parseSmsWebhook(params: URLSearchParams): TwilioSmsWebhook {
  return {
    MessageSid: params.get("MessageSid") || "",
    AccountSid: params.get("AccountSid") || "",
    From: params.get("From") || "",
    To: params.get("To") || "",
    Body: params.get("Body") || "",
    NumMedia: params.get("NumMedia") || "0",
    MediaUrl0: params.get("MediaUrl0") || undefined,
    MediaContentType0: params.get("MediaContentType0") || undefined,
    SmsStatus: params.get("SmsStatus") || "",
    SmsSid: params.get("SmsSid") || "",
  };
}

/**
 * Send an SMS reply via Twilio REST API.
 */
export async function sendSmsReply(
  to: string,
  from: string,
  body: string,
): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    console.warn("[SMS] Twilio credentials not configured - cannot send SMS");
    return false;
  }

  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: to,
          From: from,
          Body: body,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SMS] Twilio API error: ${response.status} ${errorText}`);
      return false;
    }

    console.log(`[SMS] Reply sent to ${to}`);
    return true;
  } catch (err) {
    console.error("[SMS] Error sending reply:", err);
    return false;
  }
}