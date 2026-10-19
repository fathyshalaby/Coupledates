import { pgTable, serial, text, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { datesTable } from "./couples";

export const dateReviewsTable = pgTable("date_reviews", {
  id: serial("id").primaryKey(),
  dateId: integer("date_id").notNull().references(() => datesTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  rating: integer("rating").notNull(),
  note: text("note").notNull(),
}, (t) => [uniqueIndex("date_review_member_unique").on(t.dateId, t.userId)]);
