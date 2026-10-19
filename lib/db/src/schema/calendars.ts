import { pgTable, text, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { couplesTable, datesTable } from "./couples";

// OAuth tokens stay with Clerk. This table stores only application opt-in.
export const calendarConnectionsTable = pgTable("calendar_connections", {
  userId: text("user_id").primaryKey(),
  coupleId: integer("couple_id").notNull().references(() => couplesTable.id),
  enabled: boolean("enabled").notNull().default(true),
  shareAvailability: boolean("share_availability").notNull().default(false),
  needsConsent: boolean("needs_consent").notNull().default(false),
});
export const calendarCopiesTable = pgTable("calendar_copies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: text("user_id").notNull(),
  dateId: integer("date_id").notNull().references(() => datesTable.id, { onDelete: "cascade" }),
  eventId: text("event_id").notNull(),
  eventUrl: text("event_url"),
  snapshotHash: text("snapshot_hash").notNull(),
  savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("calendar_copy_owner_date").on(t.userId, t.dateId)]);
