import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { membersTable } from "./couples";

// An ownership-proven link, not an email/name match or a copy of relationship data.
export const accountLinksTable = pgTable("account_links", {
  authUserId: text("auth_user_id").primaryKey(),
  memberUserId: text("member_user_id").notNull().unique().references(() => membersTable.userId, { onDelete: "cascade" }),
  active: boolean("active").notNull().default(true),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
});
