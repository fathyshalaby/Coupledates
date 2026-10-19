import { pgTable, serial, text, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { datesTable, membersTable } from "./couples";

export const reminderPreferencesTable = pgTable("reminder_preferences", {
  userId: text("user_id").primaryKey().references(() => membersTable.userId, { onDelete: "cascade" }),
  timezone: text("timezone").notNull(),
  dateEnabled: boolean("date_enabled").notNull().default(false),
  photoEnabled: boolean("photo_enabled").notNull().default(false),
  leadMinutes: integer("lead_minutes").notNull().default(60),
});

// Rows also serve as the durable delivery ledger; dismissing never deletes them.
export const remindersTable = pgTable("date_reminders", {
  id: serial("id").primaryKey(),
  dateId: integer("date_id").notNull().references(() => datesTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => membersTable.userId, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  dismissed: boolean("dismissed").notNull().default(false),
}, t => [uniqueIndex("date_reminder_once").on(t.dateId, t.userId, t.kind)]);
