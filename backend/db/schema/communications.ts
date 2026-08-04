import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  pgEnum,
  integer,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations, users } from "./organizations";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const conversationTypeEnum = pgEnum("conversation_type", [
  "call",
  "sms",
  "web_chat",
  "whatsapp",
  "facebook",
]);

export const conversationStatusEnum = pgEnum("conversation_status", [
  "active",
  "ended",
  "missed",
  "voicemail",
  "transferred",
]);

export const conversationDirectionEnum = pgEnum("conversation_direction", [
  "inbound",
  "outbound",
]);

export const messageRoleEnum = pgEnum("message_role", [
  "user",
  "assistant",
  "system",
]);

export const messageContentTypeEnum = pgEnum("message_content_type", [
  "text",
  "audio",
  "transcript",
  "image",
]);

export const transcriptionStatusEnum = pgEnum("transcription_status", [
  "pending",
  "completed",
  "failed",
]);

export const callbackStatusEnum = pgEnum("callback_status", [
  "pending",
  "contacted",
  "resolved",
  "declined",
]);

// ─── Phone Numbers ───────────────────────────────────────────────────────────

export const phoneNumbers = pgTable(
  "phone_numbers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
    label: varchar("label", { length: 100 }),
    provider: varchar("provider", { length: 50 }).notNull().default("twilio"),
    providerSid: varchar("provider_sid", { length: 100 }),
    telnyxNumberId: varchar("telnyx_number_id", { length: 100 }),
    isActive: boolean("is_active").notNull().default(true),
    capabilities: jsonb("capabilities").notNull().default({
      voice: true,
      sms: true,
      mms: false,
    }),
    forwardingNumber: varchar("forwarding_number", { length: 20 }),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("phone_numbers_number_idx").on(table.phoneNumber),
    index("phone_numbers_org_idx").on(table.organizationId),
  ]
);

// ─── Contacts ────────────────────────────────────────────────────────────────

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 30 }),
    company: varchar("company", { length: 255 }),
    notes: text("notes"),
    tags: jsonb("tags").default([]),
    preferredLanguage: varchar("preferred_language", { length: 10 }).default("en"),
    optOutSms: boolean("opt_out_sms").default(false),
    optOutEmail: boolean("opt_out_email").default(false),
    metadata: jsonb("metadata").default({}),
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("contacts_org_idx").on(table.organizationId),
    index("contacts_phone_idx").on(table.phone),
    index("contacts_email_idx").on(table.email),
    uniqueIndex("contacts_org_phone_idx")
      .on(table.organizationId, table.phone)
      // Only enforce uniqueness when phone is not null
      .where("phone IS NOT NULL"),
  ]
);

// ─── Conversations ───────────────────────────────────────────────────────────

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    phoneNumberId: uuid("phone_number_id").references(() => phoneNumbers.id, {
      onDelete: "set null",
    }),
    assignedUserId: uuid("assigned_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    type: conversationTypeEnum("type").notNull().default("call"),
    status: conversationStatusEnum("status").notNull().default("active"),
    direction: conversationDirectionEnum("direction").notNull().default("inbound"),
    subject: varchar("subject", { length: 500 }),
    twilioCallSid: varchar("twilio_call_sid", { length: 100 }),
    twilioChatSid: varchar("twilio_chat_sid", { length: 100 }),
    sourceUrl: text("source_url"),
    aiHandled: boolean("ai_handled").default(true),
    escalatedToHuman: boolean("escalated_to_human").default(false),
    escalatedAt: timestamp("escalated_at", { withTimezone: true }),
    escalationReason: text("escalation_reason"),
    metadata: jsonb("metadata").default({}),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("conversations_org_idx").on(table.organizationId),
    index("conversations_contact_idx").on(table.contactId),
    index("conversations_phone_idx").on(table.phoneNumberId),
    index("conversations_status_idx").on(table.status),
    index("conversations_started_idx").on(table.startedAt),
    index("conversations_twilio_call_idx").on(table.twilioCallSid),
  ]
);

// ─── Messages ────────────────────────────────────────────────────────────────

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull().default("user"),
    content: text("content").notNull(),
    contentType: messageContentTypeEnum("content_type").notNull().default("text"),
    twilioMessageSid: varchar("twilio_message_sid", { length: 100 }),
    mediaUrls: jsonb("media_urls").default([]),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("messages_conversation_idx").on(table.conversationId),
    index("messages_org_idx").on(table.organizationId),
    index("messages_created_idx").on(table.createdAt),
  ]
);

// ─── Recordings ──────────────────────────────────────────────────────────────

export const recordings = pgTable(
  "recordings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    recordingUrl: text("recording_url"),
    durationSeconds: integer("duration_seconds"),
    transcriptionText: text("transcription_text"),
    transcriptionStatus: transcriptionStatusEnum("transcription_status")
      .default("pending"),
    storageProvider: varchar("storage_provider", { length: 50 }),
    storageKey: varchar("storage_key", { length: 500 }),
    twilioRecordingSid: varchar("twilio_recording_sid", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("recordings_org_idx").on(table.organizationId),
    index("recordings_conversation_idx").on(table.conversationId),
  ]
);

// ─── Missed Calls ────────────────────────────────────────────────────────────

export const missedCalls = pgTable(
  "missed_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    phoneNumberId: uuid("phone_number_id")
      .references(() => phoneNumbers.id, { onDelete: "set null" }),
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    callerNumber: varchar("caller_number", { length: 20 }).notNull(),
    callerName: varchar("caller_name", { length: 255 }),
    twilioCallSid: varchar("twilio_call_sid", { length: 100 }),
    ringDurationSeconds: integer("ring_duration_seconds"),
    voicemailUrl: text("voicemail_url"),
    voicemailTranscription: text("voicemail_transcription"),
    callbackRequested: boolean("callback_requested").default(false),
    callbackStatus: callbackStatusEnum("callback_status").default("pending"),
    callbackNotes: text("callback_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("missed_calls_org_idx").on(table.organizationId),
    index("missed_calls_callback_idx").on(table.callbackStatus),
    index("missed_calls_created_idx").on(table.createdAt),
  ]
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const phoneNumbersRelations = relations(phoneNumbers, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [phoneNumbers.organizationId],
    references: [organizations.id],
  }),
  conversations: many(conversations),
  missedCalls: many(missedCalls),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [contacts.organizationId],
    references: [organizations.id],
  }),
  conversations: many(conversations),
  missedCalls: many(missedCalls),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [conversations.organizationId],
    references: [organizations.id],
  }),
  contact: one(contacts, {
    fields: [conversations.contactId],
    references: [contacts.id],
  }),
  phoneNumber: one(phoneNumbers, {
    fields: [conversations.phoneNumberId],
    references: [phoneNumbers.id],
  }),
  assignedUser: one(users, {
    fields: [conversations.assignedUserId],
    references: [users.id],
  }),
  messages: many(messages),
  recordings: many(recordings),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  organization: one(organizations, {
    fields: [messages.organizationId],
    references: [organizations.id],
  }),
}));

export const recordingsRelations = relations(recordings, ({ one }) => ({
  organization: one(organizations, {
    fields: [recordings.organizationId],
    references: [organizations.id],
  }),
  conversation: one(conversations, {
    fields: [recordings.conversationId],
    references: [conversations.id],
  }),
}));

export const missedCallsRelations = relations(missedCalls, ({ one }) => ({
  organization: one(organizations, {
    fields: [missedCalls.organizationId],
    references: [organizations.id],
  }),
  phoneNumber: one(phoneNumbers, {
    fields: [missedCalls.phoneNumberId],
    references: [phoneNumbers.id],
  }),
  contact: one(contacts, {
    fields: [missedCalls.contactId],
    references: [contacts.id],
  }),
}));
