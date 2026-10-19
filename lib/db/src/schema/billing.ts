import { pgTable, text, integer, boolean, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { couplesTable } from "./couples";

// A private checkout reservation, never a client-supplied purchase claim.
export const billingCheckoutsTable = pgTable("billing_checkouts", {
  id: uuid("id").primaryKey(),
  coupleId: integer("couple_id").notNull().references(() => couplesTable.id),
  payerUserId: text("payer_user_id").notNull(),
  planId: text("plan_id").unique(),
  checkoutId: text("checkout_id").unique(),
  checkoutUrl: text("checkout_url"),
  state: text("state").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  checkedAt: timestamp("checked_at", { withTimezone: true }),
}, t => [index("billing_checkout_space").on(t.coupleId)]);

// Minimal local access snapshot. Whop remains the membership source of truth.
export const spaceSubscriptionsTable = pgTable("space_subscriptions", {
  coupleId: integer("couple_id").primaryKey().references(() => couplesTable.id),
  payerUserId: text("payer_user_id").notNull(),
  membershipId: text("membership_id").notNull().unique(),
  checkoutId: uuid("checkout_intent_id").notNull().references(() => billingCheckoutsTable.id),
  status: text("status").notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  providerUpdatedAt: timestamp("provider_updated_at", { withTimezone: true }),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
});
export const billingWebhookSettingsTable = pgTable("billing_webhook_settings", {
  origin: text("origin").primaryKey(),
  webhookId: text("webhook_id").notNull(),
  encryptedSecret: text("encrypted_secret").notNull(),
});
export const billingWebhookEventsTable = pgTable("billing_webhook_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});
