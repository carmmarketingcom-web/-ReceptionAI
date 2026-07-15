import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  pgEnum,
  boolean,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { contacts, conversations } from "./communications";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const campaignTriggerEnum = pgEnum("campaign_trigger", [
  "missed_call",
  "after_appointment",
  "no_contact",
  "birthday",
  "appointment_reminder",
  "custom",
]);

export const followUpChannelEnum = pgEnum("follow_up_channel", [
  "sms",
  "email",
  "voice",
]);

export const followUpStatusEnum = pgEnum("follow_up_status", [
  "pending",
  "queued",
  "sent",
  "delivered",
  "failed",
  "opted_out",
  "replied",
]);

// ─── Follow-Up Campaigns ────────────────────────────────────────────────────

export const followUpCampaigns = pgTable(
  "follow_up_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    triggerEvent: campaignTriggerEnum("trigger_event").notNull(),
    delayMinutes: integer("delay_minutes").notNull().default(15),
    maxAttempts: integer("max_attempts").notNull().default(3),
    intervalMinutes: integer("interval_minutes").notNull().default(1440), // between retries
    channels: jsonb("channels").notNull().default(["sms"]),
    messageTemplate: text("message_template"), // with {{variables}}
    language: varchar("language", { length: 10 }).default("en"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("campaigns_org_idx").on(table.organizationId),
    index("campaigns_trigger_idx").on(table.triggerEvent),
  ]
);

// ─── Follow-Up Messages ─────────────────────────────────────────────────────

export const followUpMessages = pgTable(
  "follow_up_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => followUpCampaigns.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(
      () => conversations.id,
      { onDelete: "set null" }
    ),
    channel: followUpChannelEnum("channel").notNull().default("sms"),
    messageContent: text("message_content").notNull(),
    status: followUpStatusEnum("status").notNull().default("pending"),
    attemptNumber: integer("attempt_number").notNull().default(1),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    twilioMessageSid: varchar("twilio_message_sid", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("followup_msgs_org_idx").on(table.organizationId),
    index("followup_msgs_campaign_idx").on(table.campaignId),
    index("followup_msgs_contact_idx").on(table.contactId),
    index("followup_msgs_status_idx").on(table.status),
    index("followup_msgs_scheduled_idx").on(table.scheduledFor),
  ]
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const followUpCampaignsRelations = relations(
  followUpCampaigns,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [followUpCampaigns.organizationId],
      references: [organizations.id],
    }),
    messages: many(followUpMessages),
  })
);

export const followUpMessagesRelations = relations(followUpMessages, ({ one }) => ({
  campaign: one(followUpCampaigns, {
    fields: [followUpMessages.campaignId],
    references: [followUpCampaigns.id],
  }),
  organization: one(organizations, {
    fields: [followUpMessages.organizationId],
    references: [organizations.id],
  }),
  contact: one(contacts, {
    fields: [followUpMessages.contactId],
    references: [contacts.id],
  }),
  conversation: one(conversations, {
    fields: [followUpMessages.conversationId],
    references: [conversations.id],
  }),
}));
