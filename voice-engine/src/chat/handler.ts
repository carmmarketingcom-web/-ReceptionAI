// ─── Web Chat Handler ────────────────────────────────────────────────────────
// WebSocket server for real-time web chat conversations.

import type { ChatWebSocketMessage, OrganizationConfig } from "../types/index.ts";
import { processTextMessage } from "../voice/stream.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatSession {
  sessionId: string;
  organizationId: string;
  ws: WebSocket;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  isActive: boolean;
}

// ─── Active Chat Sessions ────────────────────────────────────────────────────

const activeChatSessions = new Map<string, ChatSession>();

// ─── WebSocket Handler ───────────────────────────────────────────────────────

/**
 * Handle an incoming WebSocket connection for web chat.
 * This is the endpoint for the customer-facing chat widget.
 */
export async function handleChatWebSocket(
  ws: WebSocket,
  url: URL,
): Promise<void> {
  let session: ChatSession | null = null;

  ws.on("error", (err) => {
    console.error("Chat WebSocket error:", err);
  });

  ws.on("close", () => {
    if (session) {
      console.log(`[Chat/${session.sessionId}] Session closed`);
      session.isActive = false;
      activeChatSessions.delete(session.sessionId);
    }
  });

  ws.on("message", async (data: Buffer | string) => {
    try {
      const message: ChatWebSocketMessage = JSON.parse(data.toString());

      switch (message.type) {
        case "message":
          if (session) {
            await handleChatMessage(session, message);
          }
          break;

        default:
          // Handle other message types (typing indicators, etc.)
          break;
      }
    } catch (err) {
      console.error("Error processing chat message:", err);
      sendError(ws, "Invalid message format");
    }
  });

  // Send welcome message to indicate connection
  const welcome: ChatWebSocketMessage = {
    type: "message",
    sessionId: crypto.randomUUID(),
    orgId: "",
    content: "Connected to ReceptionAI chat. How can we help you?",
  };
  ws.send(JSON.stringify(welcome));
}

// ─── Chat Message Handler ────────────────────────────────────────────────────

async function handleChatMessage(
  session: ChatSession,
  message: ChatWebSocketMessage,
): Promise<void> {
  const text = message.content || "";
  if (!text.trim()) return;

  console.log(`[Chat/${session.sessionId}] Message: "${text.substring(0, 100)}"`);

  // Send typing indicator
  sendTyping(session.ws, session.sessionId, true);

  try {
    // Load org config (in production, fetch from DB)
    const orgConfig = await loadOrgConfig(session.organizationId);

    // Update customer info if provided
    if (message.customer) {
      if (message.customer.name) session.customerName = message.customer.name;
      if (message.customer.email) session.customerEmail = message.customer.email;
      if (message.customer.phone) session.customerPhone = message.customer.phone;
    }

    // Process through conversation engine
    const response = await processTextMessage(
      session.sessionId,
      orgConfig,
      text,
      "chat",
    );

    // Send typing indicator off
    sendTyping(session.ws, session.sessionId, false);

    // Send AI response
    const responseMessage: ChatWebSocketMessage = {
      type: "message",
      sessionId: session.sessionId,
      orgId: session.organizationId,
      content: response,
      timestamp: new Date().toISOString(),
    };
    session.ws.send(JSON.stringify(responseMessage));
  } catch (err) {
    console.error(`[Chat/${session.sessionId}] Error:`, err);
    sendTyping(session.ws, session.sessionId, false);

    const errorMessage: ChatWebSocketMessage = {
      type: "message",
      sessionId: session.sessionId,
      orgId: session.organizationId,
      content: "I apologize, but I'm having trouble processing your message. Please try again.",
      timestamp: new Date().toISOString(),
    };
    session.ws.send(JSON.stringify(errorMessage));
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sendTyping(ws: WebSocket, sessionId: string, isTyping: boolean): void {
  const typingMessage: ChatWebSocketMessage = {
    type: "typing",
    sessionId,
    orgId: "",
    action: isTyping ? "ai_thinking" : "ai_ready",
  };
  ws.send(JSON.stringify(typingMessage));
}

function sendError(ws: WebSocket, error: string): void {
  const errorMessage: ChatWebSocketMessage = {
    type: "message",
    sessionId: "",
    orgId: "",
    content: `Error: ${error}`,
  };
  ws.send(JSON.stringify(errorMessage));
}

/**
 * Load organization configuration.
 * In production, this fetches from PostgreSQL.
 */
async function loadOrgConfig(
  organizationId: string,
): Promise<OrganizationConfig> {
  // In production, fetch from DB using Drizzle
  // For now, return a default config
  // This same function exists in stream.ts - in production, share via a service layer
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
  };
}

/**
 * Create a new chat session when a customer connects.
 * Called from the API route when a connection is established.
 */
export function createChatSession(
  sessionId: string,
  organizationId: string,
  ws: WebSocket,
): ChatSession {
  const session: ChatSession = {
    sessionId,
    organizationId,
    ws,
    isActive: true,
  };
  activeChatSessions.set(sessionId, session);
  return session;
}