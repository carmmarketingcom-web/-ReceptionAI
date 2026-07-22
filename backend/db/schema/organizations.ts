import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", [
  "owner",
  "admin",
  "agent",
  "viewer",
]);

// ─── Organizations ───────────────────────────────────────────────────────────

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 30 }),
    timezone: varchar("timezone", { length: 100 }).notNull().default("America/Chicago"),
    locale: varchar("locale", { length: 10 }).notNull().default("en"),
    logoUrl: text("logo_url"),
    website: varchar("website", { length: 500 }),
    addressLine1: varchar("address_line1", { length: 255 }),
    addressLine2: varchar("address_line2", { length: 255 }),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 100 }),
    postalCode: varchar("postal_code", { length: 20 }),
    country: varchar("country", { length: 100 }).default("US"),
    industry: varchar("industry", { length: 100 }),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("orgs_slug_idx").on(table.slug),
  ]
);

// ─── Organization Settings ───────────────────────────────────────────────────

export const organizationSettings = pgTable(
  "organization_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 255 }).notNull(),
    value: jsonb("value").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("org_settings_org_key_idx").on(table.organizationId, table.key),
    index("org_settings_org_idx").on(table.organizationId),
  ]
);

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    role: userRoleEnum("role").notNull().default("agent"),
    passwordHash: varchar("password_hash", { length: 255 }),
    avatarUrl: text("avatar_url"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    isActive: varchar("is_active", { length: 1 }).notNull().default("1"), // boolean as char for pg
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("users_org_email_idx").on(table.organizationId, table.email),
    index("users_org_idx").on(table.organizationId),
    index("users_email_idx").on(table.email),
  ]
);

// ─── User Invitations ────────────────────────────────────────────────────────

export const userInvitations = pgTable(
  "user_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    role: userRoleEnum("role").notNull().default("agent"),
    invitedBy: uuid("invited_by")
      .references(() => users.id, { onDelete: "set null" }),
    token: varchar("token", { length: 255 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("invitations_org_idx").on(table.organizationId),
    index("invitations_token_idx").on(table.token),
    index("invitations_email_idx").on(table.email),
  ]
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const organizationsRelations = relations(organizations, ({ many }) => ({
  settings: many(organizationSettings),
  users: many(users),
  invitations: many(userInvitations),
}));

export const organizationSettingsRelations = relations(
  organizationSettings,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationSettings.organizationId],
      references: [organizations.id],
    }),
  })
);

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  sentInvitations: many(userInvitations, { relationName: "invitedByUser" }),
}));

export const userInvitationsRelations = relations(userInvitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [userInvitations.organizationId],
    references: [organizations.id],
  }),
  invitedByUser: one(users, {
    fields: [userInvitations.invitedBy],
    references: [users.id],
    relationName: "invitedByUser",
  }),
}));
