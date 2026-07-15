// ─── Twilio Media Stream WebSocket Handler ───────────────────────────────────
// Handles bidirectional audio streaming via Twilio Media Streams.
// Manages Deepgram STT, OpenAI conversation engine, and ElevenLabs TTS.

import type { TwilioMediaStream, OrganizationConfig } from "../types/index.ts";
import { ConversationManager, sessionStore } from "../conversation/engine.ts";
import { functionHandlers } from "../conversation/function-registry.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StreamSession {
  callSid: string;
  streamSid: string;
  organizationId: string;
  conversationManager: ConversationManager;
  orgConfig: OrganizationConfig;
  ws: WebSocket;
  audioBuffer: Buffer[];
  isSpeaking: boolean;
  transcriptBuffer: string;
}

// ─── Active Streams ──────────────────────────────────────────────────────────

const activeStreams = new Map<string, StreamSession>();

// ─── WebSocket Handler ───────────────────────────────────────────────────────

/**
 * Handle an incoming WebSocket connection from Twilio Media Streams.
 * This is called when the Twilio <Connect><Stream> opens a WebSocket.
 */
export async function handleMediaStreamWebSocket(
  ws: WebSocket,
  url: URL,
): Promise<void> {
  let session: StreamSession | null = null;

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
  });

  ws.on("close", () => {
    if (session) {
      console.log(`[${session.callSid}] Stream closed`);
      activeStreams.delete(session.streamSid);
    }
  });

  ws.on("message", async (data: Buffer | string) => {
    try {
      const message: TwilioMediaStream = JSON.parse(data.toString());

      switch (message.event) {
        case "connected":
          console.log("Twilio Media Stream connected");
          break;

        case "start":
          await handleStreamStart(ws, message, url, session);
          session = activeStreams.get(message.streamSid) || null;
          break;

        case "media":
          if (session && message.media?.track === "inbound") {
            await handleInboundAudio(session, message);
          }
          break;

        case "mark":
          // A mark event - audio has finished playing
          if (session) {
            session.isSpeaking = false;
          }
          break;

        case "stop":
          await handleStreamStop(session);
          break;
      }
    } catch (err) {
      console.error("Error processing stream message:", err);
    }
  });
}

// ─── Stream Event Handlers ───────────────────────────────────────────────────

async function handleStreamStart(
  ws: WebSocket,
  message: TwilioMediaStream,
  url: URL,
  existingSession: StreamSession | null,
): Promise<void> {
  const start = message.start;
  if (!start) return;

  const callSid = start.customParameters?.callSid || start.callSid;
  const organizationId = start.customParameters?.organizationId || "";
  const from = start.customParameters?.from || "unknown";
  const language = start.customParameters?.language || "en";

  console.log(`[${callSid}] Stream started, org: ${organizationId}, from: ${from}`);

  // Load org config (in production, fetch from DB)
  const orgConfig = await loadOrganizationConfig(organizationId);

  // Create or get conversation manager
  const conversationId = `voice-${callSid}`;
  const convManager = sessionStore.getOrCreate(conversationId, orgConfig, "voice");

  // Add initial system message about the call
  convManager.addSystemMessage(
    `Inbound call from ${from}. Greet the caller and ask how you can help.`,
  );

  const session: StreamSession = {
    callSid,
    streamSid: message.streamSid,
    organizationId,
    conversationManager: convManager,
    orgConfig,
    ws,
    audioBuffer: [],
    isSpeaking: false,
    transcriptBuffer: "",
  };

  activeStreams.set(message.streamSid, session);

  // Send a welcome message via TTS
  await playTTS(session, getGreeting(orgConfig, language));
}

async function handleInboundAudio(
  session: StreamSession,
  message: TwilioMediaStream,
): Promise<void> {
  if (!message.media) return;
  if (session.isSpeaking) return; // Don't process while AI is speaking

  // Decode base64 μ-law audio chunk
  const audioChunk = Buffer.from(message.media.chunk, "base64");
  session.audioBuffer.push(audioChunk);

  // In production, send audio chunks to Deepgram for real-time transcription
  // For now, we accumulate audio and use a simplified approach
  // Deepgram integration would be:
  //
  // const deepgramLive = deepgramClient.listen.live({...});
  // deepgramLive.send(audioChunk);
  // deepgramLive.on('transcript', (data) => { ... });
  //
  // For the MVP, we'll use a text-based flow (the webhook handler approach)
}

async function handleStreamStop(session: StreamSession | null): Promise<void> {
  if (!session) return;
  console.log(`[${session.callSid}] Stream stopped`);

  // Save conversation to DB (in production)
  // For now, just log it
  console.log(`[${session.callSid}] Conversation summary:`, 
    session.conversationManager.getSummary());

  activeStreams.delete(session.streamSid);
}

// ─── TTS / Audio Output ──────────────────────────────────────────────────────

/**
 * Play a TTS message back to the caller via Twilio Media Streams.
 * In production, this uses ElevenLabs streaming TTS.
 * For the MVP, we use a simple approach that sends mark events.
 */
async function playTTS(session: StreamSession, text: string): Promise<void> {
  session.isSpeaking = true;

  try {
    // In production: call ElevenLabs streaming API and send audio chunks
    // For now, we send a mark event to indicate the AI is speaking
    // The actual audio would be generated by ElevenLabs and streamed as μ-law

    // Send a mark to indicate start of speech
    const markStart = JSON.stringify({
      event: "mark",
      streamSid: session.streamSid,
      name: "ai-speech-start",
    });
    session.ws.send(markStart);

    // In production, the ElevenLabs TTS audio would be streamed here
    // using `media` events with base64-encoded μ-law audio chunks
    //
    // Example: 
    // const audioStream = await elevenLabsClient.generate(text, { voice: "..." });
    // for await (const chunk of audioStream) {
    //   const mediaMsg = {
    //     event: "media",
    //     streamSid: session.streamSid,
    //     media: {
    //       track: "outbound",
    //       chunk: chunk.toString("base64"),
    //       timestamp: Date.now(),
    //     },
    //   };
    //   session.ws.send(JSON.stringify(mediaMsg));
    // }

    // Send a mark to indicate end of speech
    const markEnd = JSON.stringify({
      event: "mark",
      streamSid: session.streamSid,
      name: "ai-speech-end",
    });
    session.ws.send(markEnd);

    console.log(`[${session.callSid}] TTS: "${text.substring(0, 100)}..."`);
  } catch (err) {
    console.error(`[${session.callSid}] TTS error:`, err);
    session.isSpeaking = false;
  } finally {
    // Give a moment for the audio to play before allowing new input
    setTimeout(() => {
      session.isSpeaking = false;
    }, text.length * 50); // Rough estimate: 50ms per character
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting(orgConfig: OrganizationConfig, language: string): string {
  if (orgConfig.greetingMessage) return orgConfig.greetingMessage;
  if (language === "es") {
    return `Gracias por llamar a ${orgConfig.name}. Soy ReceptionAI, su recepcionista virtual. ¿En qué puedo ayudarle hoy?`;
  }
  return `Thank you for calling ${orgConfig.name}. I'm ReceptionAI, your virtual receptionist. How can I help you today?`;
}

/**
 * Load organization configuration from the database.
 * In production, this fetches from PostgreSQL.
 * For now, returns a default config.
 */
async function loadOrganizationConfig(
  organizationId: string,
): Promise<OrganizationConfig> {
  // In production, fetch from DB using Drizzle:
  // const org = await db.query.organizations.findFirst({ where: eq(organizations.id, organizationId) });
  // return mapOrgToConfig(org);

  // For now, return a default config
  return {
    id: organizationId,
    name: "Your Business",
    industry: "Service",
    businessHours: [
      { dayOfWeek: 1, open: "09:00", close: "17:00", isClosed: false },
      { dayOfWeek: 2, open: "09:00", close: "17:00", isClosed: false },
      { dayOfWeek: 3, open: "09:00", close: "17:00", isClosed: false },
      { dayOfWeek: 4, open: "09:00", close: "17:00", isClosed: false },
      { dayOfWeek: 5, open: "09:00", close: "17:00", isClosed: false },
      { dayOfWeek: 6, open: "09:00", close: "17:00", isClosed: false },
      { dayOfWeek: 0, open: "00:00", close: "00:00", isClosed: true },
    ],
    timezone: "America/Chicago",
    locale: "en",
    services: [
      { name: "General Service", description: "Standard service appointment", durationMinutes: 60 },
    ],
    faqEntries: [],
    escalationPhone: "+15551234567",
    calendarConfig: { provider: "internal" },
    greetingMessage: "Thank you for calling. I'm your AI receptionist. How can I help you today?",
  };
}

/**
 * Process a text message through the conversation engine (used for non-voice channels).
 */
export async function processTextMessage(
  conversationId: string,
  orgConfig: OrganizationConfig,
  text: string,
  channel: "voice" | "sms" | "chat" | "whatsapp" | "messenger",
): Promise<string> {
  const manager = sessionStore.getOrCreate(conversationId, orgConfig, channel);
  const response = await manager.processMessage(text);

  // Handle function calls
  if (response.toolCalls && response.toolCalls.length > 0) {
    for (const toolCall of response.toolCalls) {
      const handler = functionHandlers[toolCall.name];
      if (handler) {
        const result = await handler(toolCall.arguments, orgConfig);
        const followUp = await manager.processFunctionResult(toolCall.name, result.data);
        if (followUp.content) {
          return followUp.content;
        }
      }
    }
  }

  return response.content || "I'll help you with that. One moment please.";
}

/**
 * Get a conversation manager for a given conversation ID.
 */
export function getConversationManager(
  conversationId: string,
): ConversationManager | undefined {
  return sessionStore.get(conversationId);
}