/**
 * ReceptionAI — Site Database Schema
 *
 * Re-exports from the backend schema at /home/team/shared/backend/db/schema/.
 * This module is imported by API routes and server functions within the TanStack Start site.
 */

// Re-export all schema tables and relations from the canonical backend schema
export {
  // Organizations & Users
  organizations,
  organizationSettings,
  users,
  userInvitations,
  userRoleEnum,
  organizationsRelations,
  organizationSettingsRelations,
  usersRelations,
  userInvitationsRelations,
  // Communications
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
  // Appointments & Calendar
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
  // AI
  aiResponseTemplates,
  aiKnowledgeBase,
  triggerTypeEnum,
  languageEnum,
  aiResponseTemplatesRelations,
  aiKnowledgeBaseRelations,
  // Follow-Ups
  followUpCampaigns,
  followUpMessages,
  campaignTriggerEnum,
  followUpChannelEnum,
  followUpStatusEnum,
  followUpCampaignsRelations,
  followUpMessagesRelations,
  // Billing
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
} from "../../../../../backend/db/schema/index";
