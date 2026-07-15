// ─── Channel Types ───────────────────────────────────────────────────────────

export type Channel = "voice" | "sms" | "chat" | "whatsapp" | "messenger";
export type Language = "en" | "es";
export type ConversationStatus = "active" | "completed" | "abandoned" | "escalated";
export type AppointmentStatus = "confirmed" | "cancelled" | "completed" | "no_show" | "rescheduled";
export type EscalationUrgency = "low" | "medium" | "high";
export type EscalationStatus = "pending" | "in_progress" | "resolved";
export type MessageRole = "customer" | "ai" | "system" | "human";
export type ContentType = "text" | "audio" | "image" | "action";

// ─── Organization Config ─────────────────────────────────────────────────────

export interface OrgService {
  name: string;
  description: string;
  durationMinutes: number;
  price?: string;
}

export interface FAQEntry {
  question: string;
  answer: string;
}

export interface BusinessHours {
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
  open: string;      // HH:MM
  close: string;     // HH:MM
  isClosed: boolean;
}

export interface CalendarConfig {
  provider: "google" | "outlook" | "internal";
  token?: string;
  calendarId?: string;
}

export interface OrganizationConfig {
  id: string;
  name: string;
  industry: string;
  businessHours: BusinessHours[];
  timezone: string;
  locale: string;
  services: OrgService[];
  faqEntries: FAQEntry[];
  escalationPhone: string;
  calendarConfig: CalendarConfig;
  greetingMessage?: string;
  voiceId?: string;
  voiceIdEs?: string;
  aiModel?: string;
}

// ─── Conversation Types ──────────────────────────────────────────────────────

export interface ConversationContext {
  organizationId: string;
  conversationId: string;
  channel: Channel;
  language: Language;
  customerInfo?: CustomerInfo;
  messageHistory: ConversationMessage[];
  pendingAction?: string;
  lastToolCall?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationMessage {
  role: MessageRole;
  content: string;
  contentType: ContentType;
  functionCall?: FunctionCall;
  functionResult?: unknown;
  sttConfidence?: number;
  latencyMs?: number;
  timestamp: Date;
}

export interface FunctionCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface CustomerInfo {
  name?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

// ─── Appointment Types ───────────────────────────────────────────────────────

export interface Appointment {
  id: string;
  organizationId: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  service: string;
  date: string;       // YYYY-MM-DD
  time: string;       // HH:MM
  durationMinutes: number;
  status: AppointmentStatus;
  calendarEventId?: string;
  notes?: string;
  source: Channel;
  conversationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Webhook Payloads ────────────────────────────────────────────────────────

export interface TwilioVoiceWebhook {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  CallStatus: string;
  Direction: string;
  ForwardedFrom?: string;
  CallerName?: string;
  CalledVia?: string;
}

export interface TwilioSmsWebhook {
  MessageSid: string;
  AccountSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
  SmsStatus: string;
  SmsSid: string;
}

// ─── WebSocket Stream Messages ───────────────────────────────────────────────

export interface TwilioMediaStream {
  event: "connected" | "start" | "media" | "stop" | "mark";
  streamSid: string;
  sequenceNumber?: string;
  start?: {
    accountSid: string;
    streamSid: string;
    callSid: string;
    tracks: string[];
    customParameters: Record<string, string>;
  };
  media?: {
    track: "inbound" | "outbound";
    chunk: string; // base64 μ-law audio
    timestamp: number;
  };
  stop?: {
    accountSid: string;
    callSid: string;
  };
  mark?: {
    name: string;
  };
}

export interface ChatWebSocketMessage {
  type: "message" | "typing" | "action";
  content?: string;
  sessionId: string;
  orgId: string;
  customer?: { name?: string; email?: string; phone?: string };
  action?: string;
  data?: Record<string, unknown>;
  timestamp?: string;
}

// ─── LLM Function Calling Types ──────────────────────────────────────────────

export interface LLMFunction {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface LLMResponse {
  content: string | null;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

// ─── Escalation Types ────────────────────────────────────────────────────────

export interface Escalation {
  id: string;
  organizationId: string;
  conversationId: string;
  channel: Channel;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  reason: string;
  summary: string;
  urgency: EscalationUrgency;
  status: EscalationStatus;
  assignedTo?: string;
  transcriptUrl?: string;
  createdAt: Date;
  resolvedAt?: Date;
}