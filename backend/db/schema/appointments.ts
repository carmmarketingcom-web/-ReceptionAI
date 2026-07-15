import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  pgEnum,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations, users } from "./organizations";
import { contacts, conversations } from "./communications";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "scheduled",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
  "rescheduled",
]);

export const calendarProviderEnum = pgEnum("calendar_provider", [
  "google",
  "microsoft",
]);

// ─── Appointments ────────────────────────────────────────────────────────────

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
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
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }).notNull(),
    timezone: varchar("timezone", { length: 100 }).notNull().default("America/Chicago"),
    status: appointmentStatusEnum("status").notNull().default("scheduled"),
    cancellationReason: text("cancellation_reason"),
    serviceType: varchar("service_type", { length: 255 }),
    staffAssignedId: uuid("staff_assigned_id").references(() => users.id, {
      onDelete: "set null",
    }),
    location: varchar("location", { length: 500 }),
    notes: text("notes"),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    reminderSentCount: varchar("reminder_sent_count", { length: 1 }).default("0"),
    confirmationSentAt: timestamp("confirmation_sent_at", { withTimezone: true }),
    externalCalendarEventId: varchar("external_calendar_event_id", {
      length: 255,
    }),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("appointments_org_idx").on(table.organizationId),
    index("appointments_contact_idx").on(table.contactId),
    index("appointments_start_idx").on(table.startTime),
    index("appointments_status_idx").on(table.status),
    index("appointments_staff_idx").on(table.staffAssignedId),
  ]
);

// ─── Calendar Integrations ──────────────────────────────────────────────────

export const calendarIntegrations = pgTable(
  "calendar_integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: calendarProviderEnum("provider").notNull(),
    providerEmail: varchar("provider_email", { length: 255 }).notNull(),
    accessTokenEncrypted: text("access_token_encrypted"),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    syncEnabled: boolean("sync_enabled").notNull().default(true),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    calendarId: varchar("calendar_id", { length: 500 }),
    calendarName: varchar("calendar_name", { length: 255 }),
    syncDirection: varchar("sync_direction", { length: 20 }).default("both"), // both, import, export
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("cal_integrations_org_idx").on(table.organizationId),
    index("cal_integrations_user_idx").on(table.userId),
    uniqueIndex("cal_integrations_org_provider_idx").on(
      table.organizationId,
      table.provider,
      table.providerEmail
    ),
  ]
);

// ─── Business Hours ──────────────────────────────────────────────────────────

export const businessHours = pgTable(
  "business_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    dayOfWeek: varchar("day_of_week", { length: 1 }).notNull(), // 0=Sun..6=Sat
    openTime: varchar("open_time", { length: 5 }).notNull().default("09:00"), // HH:MM 24h
    closeTime: varchar("close_time", { length: 5 }).notNull().default("17:00"),
    isClosed: boolean("is_closed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("biz_hours_org_day_idx").on(table.organizationId, table.dayOfWeek),
    index("biz_hours_org_idx").on(table.organizationId),
  ]
);

// ─── Holiday Overrides ──────────────────────────────────────────────────────

export const holidayOverrides = pgTable(
  "holiday_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    date: timestamp("date", { withTimezone: true }).notNull(),
    isClosed: boolean("is_closed").notNull().default(true),
    openTime: varchar("open_time", { length: 5 }),
    closeTime: varchar("close_time", { length: 5 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("holidays_org_idx").on(table.organizationId),
    index("holidays_date_idx").on(table.date),
  ]
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  organization: one(organizations, {
    fields: [appointments.organizationId],
    references: [organizations.id],
  }),
  contact: one(contacts, {
    fields: [appointments.contactId],
    references: [contacts.id],
  }),
  conversation: one(conversations, {
    fields: [appointments.conversationId],
    references: [conversations.id],
  }),
  staffAssigned: one(users, {
    fields: [appointments.staffAssignedId],
    references: [users.id],
  }),
}));

export const calendarIntegrationsRelations = relations(
  calendarIntegrations,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [calendarIntegrations.organizationId],
      references: [organizations.id],
    }),
    user: one(users, {
      fields: [calendarIntegrations.userId],
      references: [users.id],
    }),
  })
);

export const businessHoursRelations = relations(businessHours, ({ one }) => ({
  organization: one(organizations, {
    fields: [businessHours.organizationId],
    references: [organizations.id],
  }),
}));

export const holidayOverridesRelations = relations(holidayOverrides, ({ one }) => ({
  organization: one(organizations, {
    fields: [holidayOverrides.organizationId],
    references: [organizations.id],
  }),
}));
