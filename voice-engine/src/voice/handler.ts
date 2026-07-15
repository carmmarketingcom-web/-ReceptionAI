// ─── Twilio Voice Webhook Handler ───────────────────────────────────────────
// Generates TwiML for inbound voice calls and manages the Media Stream connection.

import type { TwilioVoiceWebhook, OrganizationConfig } from "../types/index.ts";

/**
 * Generate TwiML response for an inbound voice call.
 *
 * Returns XML that:
 * 1. Greets the caller with Twilio's built-in TTS (instant)
 * 2. Opens a bidirectional Media Stream WebSocket for real-time audio
 */
export function generateVoiceTwiML(
  webhook: TwilioVoiceWebhook,
  orgConfig: OrganizationConfig,
  wsUrl: string,
): string {
  const greeting = orgConfig.greetingMessage || "Thank you for calling. Please hold while I connect you.";

  // Determine language for the greeting
  const langAttr = orgConfig.locale === "es" ? "es-ES" : "en-US";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="${langAttr}">
    ${escapeXml(greeting)}
  </Say>
  <Connect>
    <Stream url="${escapeXml(wsUrl)}">
      <Parameter name="callSid" value="${escapeXml(webhook.CallSid)}"/>
      <Parameter name="organizationId" value="${escapeXml(orgConfig.id)}"/>
      <Parameter name="language" value="${escapeXml(orgConfig.locale)}"/>
      <Parameter name="from" value="${escapeXml(webhook.From)}"/>
      <Parameter name="to" value="${escapeXml(webhook.To)}"/>
    </Stream>
  </Connect>
</Response>`;
}

/**
 * Generate TwiML for transferring a call to a human.
 */
export function generateTransferTwiML(
  phoneNumber: string,
  statusCallbackUrl: string,
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Please hold while I transfer you to a team member.</Say>
  <Dial timeout="30" record="true" action="${escapeXml(statusCallbackUrl)}">
    <Number statusCallbackEvent="initiated ringing answered completed">
      ${escapeXml(phoneNumber)}
    </Number>
  </Dial>
  <Say>I'm sorry, no one is available. Please try again later. Goodbye.</Say>
</Response>`;
}

/**
 * Generate TwiML for handling call completion/errors.
 */
export function generateHangupTwiML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thank you for calling. Goodbye.</Say>
</Response>`;
}

/**
 * Determine the WebSocket URL for Media Streams based on the current server.
 */
export function getMediaStreamWsUrl(): string {
  // In development, use the host from the request
  // The host will be injected via the request headers
  const host = process.env.HOST || "localhost:3000";
  const protocol = host.includes("localhost") ? "ws" : "wss";
  // Use 0.0.0.0 or the externally accessible hostname
  const wsHost = process.env.WS_HOST || host;
  return `${protocol}://${wsHost}/api/voice/stream`;
}

/**
 * Parse Twilio voice webhook form parameters into a typed object.
 */
export function parseVoiceWebhook(params: URLSearchParams): TwilioVoiceWebhook {
  return {
    CallSid: params.get("CallSid") || "",
    AccountSid: params.get("AccountSid") || "",
    From: params.get("From") || "",
    To: params.get("To") || "",
    CallStatus: params.get("CallStatus") || "",
    Direction: params.get("Direction") || "",
    ForwardedFrom: params.get("ForwardedFrom") || undefined,
    CallerName: params.get("CallerName") || undefined,
    CalledVia: params.get("CalledVia") || undefined,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}