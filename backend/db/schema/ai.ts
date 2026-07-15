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
import { organizations } from "./organizations";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const triggerTypeEnum = pgEnum("trigger_type", [
  "greeting",
  "voicemail",
  "appointment_booking",
  "appointment_reminder",
  "faq",
  "fallback",
  "after_hours",
  "transfer",
  "follow_up",
]);

export const languageEnum = pgEnum("language_code", ["en", "es"]);

// ─── AI Response Templates ──────────────────────────────────────────────────

export const aiResponseTemplates = pgTable(
  "ai_response_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    triggerType: triggerTypeEnum("trigger_type").notNull(),
    language: languageEnum("language").notNull().default("en"),
    responseText: text("response_text").notNull(),
    voiceId: varchar("voice_id", { length: 100 }), // TTS voice ID
    systemPrompt: text("system_prompt"), // AI system prompt override
    variables: jsonb("variables").default([]), // [{ name, description, required }]
    isDefault: boolean("is_default").default(false),
    isActive: boolean("is_active").default(true),
    sortOrder: varchar("sort_order", { length: 3 }).default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ai_templates_org_idx").on(table.organizationId),
    index("ai_templates_trigger_idx").on(table.triggerType, table.language),
  ]
);

// ─── AI Knowledge Base ──────────────────────────────────────────────────────

export const aiKnowledgeBase = pgTable(
  "ai_knowledge_base",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    category: varchar("category", { length: 255 }),
    language: languageEnum("language").notNull().default("en"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ai_kb_org_idx").on(table.organizationId),
    index("ai_kb_category_idx").on(table.category),
  ]
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const aiResponseTemplatesRelations = relations(
  aiResponseTemplates,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [aiResponseTemplates.organizationId],
      references: [organizations.id],
    }),
  })
);

export const aiKnowledgeBaseRelations = relations(aiKnowledgeBase, ({ one }) => ({
  organization: one(organizations, {
    fields: [aiKnowledgeBase.organizationId],
    references: [organizations.id],
  }),
}));
