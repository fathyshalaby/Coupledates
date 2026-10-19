import { pgTable, serial, text, integer, date, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";

export const couplesTable = pgTable("couples", {
  id: serial("id").primaryKey(),
  yourName: text("your_name").notNull(),
  partnerName: text("partner_name").notNull(),
  anniversary: date("anniversary", { mode: "string" }).notNull(),
  timezone: text("timezone").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
});

export const membersTable = pgTable("couple_members", {
  userId: text("user_id").primaryKey(),
  coupleId: integer("couple_id").notNull().references(() => couplesTable.id),
});

export const memoriesTable = pgTable("memories", {
  id: serial("id").primaryKey(),
  coupleId: integer("couple_id").notNull().references(() => couplesTable.id),
  title: text("title").notNull(),
  note: text("note").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  category: text("category").notNull(),
  photoPath: text("photo_path"),
  favorite: boolean("favorite").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const datesTable = pgTable("date_plans", {
  id: serial("id").primaryKey(),
  coupleId: integer("couple_id").notNull().references(() => couplesTable.id),
  title: text("title").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  time: text("time").notNull().default(""),
  location: text("location").notNull(),
  category: text("category").notNull(),
  notes: text("notes").notNull(),
  status: text("status").notNull(),
  rating: integer("rating"),
});

export const checkInsTable = pgTable("check_ins", {
  id: serial("id").primaryKey(),
  coupleId: integer("couple_id").notNull().references(() => couplesTable.id),
  date: date("date", { mode: "string" }).notNull(),
  activity: text("activity").notNull(),
}, (t) => [uniqueIndex("check_in_day_unique").on(t.coupleId, t.date)]);

export const uploadsTable = pgTable("couple_uploads", {
  objectPath: text("object_path").primaryKey(),
  coupleId: integer("couple_id").notNull().references(() => couplesTable.id),
  userId: text("user_id").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
});
