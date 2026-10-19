import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { couplesTable } from "./couples";

export const preferencesTable = pgTable("partner_preferences", {
  userId: text("user_id").primaryKey(),
  coupleId: integer("couple_id").notNull().references(() => couplesTable.id),
  displayName: text("display_name").notNull(),
  interests: text("interests").array().notNull(),
  avoid: text("avoid").notNull(),
  budget: integer("budget").notNull(),
  currency: text("currency").notNull(),
  city: text("city").notNull(),
  timezone: text("timezone").notNull(),
  relationshipMode: text("relationship_mode").notNull(),
  availability: text("availability").array().notNull(),
  notes: text("notes").notNull(),
});

export const assistantTurnsTable = pgTable("date_assistant_turns", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  coupleId: integer("couple_id").notNull().references(() => couplesTable.id),
  prompt: text("prompt").notNull(),
  message: text("message").notNull(),
  ideas: jsonb("ideas").$type<unknown[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Durable reservations prevent concurrent requests/restarts bypassing the AI allowance.
export const aiUsageTable = pgTable("date_ai_usage", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  coupleId: integer("couple_id").notNull().references(() => couplesTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
