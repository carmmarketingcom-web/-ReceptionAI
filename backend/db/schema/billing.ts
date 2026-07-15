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
  uniqueIndex,
  decimal,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "past_due",
  "canceled",
  "trialing",
  "incomplete",
  "incomplete_expired",
  "unpaid",
  "paused",
]);

export const billingCycleEnum = pgEnum("billing_cycle", ["monthly", "annual"]);

export const usageTypeEnum = pgEnum("usage_type", [
  "ai_minutes",
  "sms_outbound",
  "sms_inbound",
  "phone_line",
  "recording_storage",
]);

// ─── Subscription Plans ─────────────────────────────────────────────────────

export const subscriptionPlans = pgTable(
  "subscription_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull().unique(), // starter, growth, scale
    displayName: varchar("display_name", { length: 255 }).notNull(),
    description: text("description"),
    stripePriceIdMonthly: varchar("stripe_price_id_monthly", { length: 255 }),
    stripePriceIdAnnual: varchar("stripe_price_id_annual", { length: 255 }),
    priceMonthlyCents: integer("price_monthly_cents").notNull(),
    priceAnnualCents: integer("price_annual_cents").notNull(),
    includedPhoneLines: integer("included_phone_lines").notNull().default(1),
    includedAiMinutes: integer("included_ai_minutes").notNull().default(500),
    includedSmsMessages: integer("included_sms_messages").default(0),
    features: jsonb("features").default([]),
    limits: jsonb("limits").default({}),
    isActive: boolean("is_active").default(true),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("plans_name_idx").on(table.name),
  ]
);

// ─── Subscriptions ──────────────────────────────────────────────────────────

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => subscriptionPlans.id),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    status: subscriptionStatusEnum("status").notNull().default("incomplete"),
    billingCycle: billingCycleEnum("billing_cycle").notNull().default("monthly"),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }),
    currentPeriodEnd: timestamp("current_period_end", {
      withTimezone: true,
    }),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
    addons: jsonb("addons").default({}), // { extra_lines: 2, extra_minutes: 1000 }
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("subscriptions_org_idx").on(table.organizationId),
    index("subscriptions_stripe_customer_idx").on(table.stripeCustomerId),
    index("subscriptions_stripe_sub_idx").on(table.stripeSubscriptionId),
    index("subscriptions_status_idx").on(table.status),
  ]
);

// ─── Usage Records ──────────────────────────────────────────────────────────

export const usageRecords = pgTable(
  "usage_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    recordType: usageTypeEnum("record_type").notNull(),
    quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
    unitLabel: varchar("unit_label", { length: 50 }).default("minutes"),
    description: varchar("description", { length: 500 }),
    metadata: jsonb("metadata").default({}),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("usage_org_idx").on(table.organizationId),
    index("usage_sub_idx").on(table.subscriptionId),
    index("usage_type_idx").on(table.recordType),
    index("usage_recorded_idx").on(table.recordedAt),
  ]
);

// ─── Stripe Webhook Events (audit log) ──────────────────────────────────────

export const stripeEvents = pgTable(
  "stripe_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stripeEventId: varchar("stripe_event_id", { length: 255 }).notNull().unique(),
    eventType: varchar("event_type", { length: 255 }).notNull(),
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("stripe_events_type_idx").on(table.eventType),
  ]
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const subscriptionPlansRelations = relations(
  subscriptionPlans,
  ({ many }) => ({
    subscriptions: many(subscriptions),
  })
);

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [subscriptions.organizationId],
    references: [organizations.id],
  }),
  plan: one(subscriptionPlans, {
    fields: [subscriptions.planId],
    references: [subscriptionPlans.id],
  }),
  usageRecords: many(usageRecords),
}));

export const usageRecordsRelations = relations(usageRecords, ({ one }) => ({
  organization: one(organizations, {
    fields: [usageRecords.organizationId],
    references: [organizations.id],
  }),
  subscription: one(subscriptions, {
    fields: [usageRecords.subscriptionId],
    references: [subscriptions.id],
  }),
}));
