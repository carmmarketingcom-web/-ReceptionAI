/**
 * ReceptionAI — Database Schema
 *
 * Multi-tenant AI receptionist SaaS platform.
 * All tables include organization_id for tenant isolation.
 *
 * Schema domains:
 *  - organizations.ts   — tenants, users, invitations, settings
 *  - communications.ts  — phone numbers, contacts, conversations, messages, recordings, missed calls
 *  - appointments.ts    — appointments, calendar integrations, business hours, holidays
 *  - ai.ts              — AI response templates, knowledge base
 *  - follow-ups.ts      — follow-up campaigns and messages
 *  - billing.ts         — subscription plans, subscriptions, usage records, Stripe events
 */

// ─── Organizations & Users ──────────────────────────────────────────────────

export {
  organizations,
  organizationSettings,
  users,
  userInvitations,
  userRoleEnum,
  organizationsRelations,
  organizationSettingsRelations,
  usersRelations,
  userInvitationsRelations,
} from "./organizations";

// ─── Communications ─────────────────────────────────────────────────────────

export {
  phoneNumbers,
  contacts,
  conversations,
  messages,
  recordings,
  missedCalls,
  conversationTypeEnum,
  conversationStatusEnum,
  conversationDirectionEnum,
  messageRoleEnum,
  messageContentTypeEnum,
  transcriptionStatusEnum,
  callbackStatusEnum,
  phoneNumbersRelations,
  contactsRelations,
  conversationsRelations,
  messagesRelations,
  recordingsRelations,
  missedCallsRelations,
} from "./communications";

// ─── Appointments & Calendar ────────────────────────────────────────────────

export {
  appointments,
  calendarIntegrations,
  businessHours,
  holidayOverrides,
  appointmentStatusEnum,
  calendarProviderEnum,
  appointmentsRelations,
  calendarIntegrationsRelations,
  businessHoursRelations,
  holidayOverridesRelations,
} from "./appointments";

// ─── AI ─────────────────────────────────────────────────────────────────────

export {
  aiResponseTemplates,
  aiKnowledgeBase,
  triggerTypeEnum,
  languageEnum,
  aiResponseTemplatesRelations,
  aiKnowledgeBaseRelations,
} from "./ai";

// ─── Follow-Ups ─────────────────────────────────────────────────────────────

export {
  followUpCampaigns,
  followUpMessages,
  campaignTriggerEnum,
  followUpChannelEnum,
  followUpStatusEnum,
  followUpCampaignsRelations,
  followUpMessagesRelations,
} from "./follow-ups";

// ─── Billing ────────────────────────────────────────────────────────────────

export {
  subscriptionPlans,
  subscriptions,
  usageRecords,
  stripeEvents,
  subscriptionStatusEnum,
  billingCycleEnum,
  usageTypeEnum,
  subscriptionPlansRelations,
  subscriptionsRelations,
  usageRecordsRelations,
} from "./billing";

// ─── Combined schema for Drizzle migrations ─────────────────────────────────

import * as orgSchema from "./organizations";
import * as commSchema from "./communications";
import * as apptSchema from "./appointments";
import * as aiSchema from "./ai";
import * as followUpSchema from "./follow-ups";
import * as billingSchema from "./billing";

/**
 * All tables combined for drizzle-kit migrations.
 * Pass this to `drizzle.config.ts` as the schema source.
 */
export const allTables = {
  // Organizations
  ...orgSchema,
  // Communications
  ...commSchema,
  // Appointments
  ...apptSchema,
  // AI
  ...aiSchema,
  // Follow-ups
  ...followUpSchema,
  // Billing
  ...billingSchema,
};
