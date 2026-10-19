import { randomUUID } from "node:crypto";
import type { Whop } from "@whop/sdk";
import {
  db, couplesTable, billingCheckoutsTable, spaceSubscriptionsTable, billingWebhookSettingsTable,
} from "@workspace/db";
import { and, eq, desc, sql } from "drizzle-orm";
import { getWhopClient } from "./whopClient";
import { fail } from "./validation";
import { hasPaidAccess, PLUS_PERIOD_DAYS, PLUS_PRICE_USD, trustedWhopUrl, verifyMembershipBinding } from "./billing-policy";
import { encryptWebhookSecret } from "./billing-webhook-secret";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Subscription = typeof spaceSubscriptionsTable.$inferSelect;
type Checkout = typeof billingCheckoutsTable.$inferSelect;
const API_VERSION = "2026-10-15-1";
export function billingConfig() {
  const companyId = process.env.WHOP_COMPANY_ID;
  const productId = process.env.WHOP_PRODUCT_ID;
  const planId = process.env.WHOP_PLAN_ID;
  let origin: string;
  try {
    const url = new URL(process.env.BILLING_APP_ORIGIN || "");
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/") throw new Error();
    origin = url.origin;
  } catch { fail(503, "Billing hasn't been configured for this app address yet."); }
  if (!companyId || !productId || !planId) fail(503, "Billing isn't configured yet.");
  return { companyId: companyId!, productId: productId!, planId: planId!, origin: origin! };
}
export async function whopCall<T>(operation: () => PromiseLike<T>): Promise<T> {
  try { return await operation(); }
  catch (error) {
    // Don't let SDK errors containing headers/payment information reach request logs.
    if (error instanceof Error && error.constructor === Error && "status" in error && [400, 402, 403, 404, 409, 502, 503].includes(Number(error.status))) throw error;
    const rejected = error as { statusCode?: number; body?: { error?: { message?: string } } };
    if (rejected.statusCode === 400) console.warn("Whop rejected billing configuration:", rejected.body?.error?.message?.slice(0, 300) || "Invalid provider request");
    fail(503, "Whop couldn't verify or update billing just now. Please retry; your memories are unaffected.");
  }
}
async function lockSpace(tx: Tx, coupleId: number) {
  const [couple] = await tx.select().from(couplesTable).where(eq(couplesTable.id, coupleId)).for("update");
  if (!couple) fail(404, "Couple space not found.");
}
async function latestCheckout(tx: Tx, coupleId: number) {
  const [row] = await tx.select().from(billingCheckoutsTable).where(eq(billingCheckoutsTable.coupleId, coupleId))
    .orderBy(desc(billingCheckoutsTable.createdAt)).limit(1);
  return row;
}
async function subscription(tx: Tx, coupleId: number) {
  const [row] = await tx.select().from(spaceSubscriptionsTable).where(eq(spaceSubscriptionsTable.coupleId, coupleId));
  return row;
}
export async function ensureBillingWebhook() {
  const config = billingConfig();
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`billing-webhook:${config.origin}`}))`);
    const [known] = await tx.select().from(billingWebhookSettingsTable).where(eq(billingWebhookSettingsTable.origin, config.origin));
    if (known) return known;
    const client = await getWhopClient();
    const request = {
      api_version_date: API_VERSION, account_id: config.companyId,
      url: `${config.origin}/api/billing/webhook`,
      events: ["membership.activated", "membership.deactivated", "membership.updated", "payment.succeeded", "payment.failed"] as Whop.CreateWebhooksRequest.Events.Item[],
    };
    const webhook = await whopCall(() => client.webhooks.create(request));
    if (!webhook.webhook_secret) fail(503, "Whop did not provide a webhook signing secret. Billing setup couldn't finish.");
    const [saved] = await tx.insert(billingWebhookSettingsTable).values({
      origin: config.origin, webhookId: webhook.id, encryptedSecret: encryptWebhookSecret(webhook.webhook_secret),
    }).returning();
    return saved!;
  });
}
async function applyMembership(tx: Tx, intent: Checkout, membership: Whop.Membership) {
  const config = billingConfig();
  verifyMembershipBinding(membership, intent, config.companyId, config.productId);
  const existing = await subscription(tx, intent.coupleId);
  // A retired checkout must not replace a later subscription.
  if (existing && existing.checkoutId !== intent.id) {
    const newest = await latestCheckout(tx, intent.coupleId);
    if (newest?.id !== intent.id) return existing;
    if (hasPaidAccess(existing)) fail(409, "This space already has a subscription. No second upgrade was applied.");
  }
  const end = membership.current_period_end ? new Date(membership.current_period_end) : null;
  if (end && !Number.isFinite(end.getTime())) fail(502, "Whop returned an invalid billing period.");
  const update = {
    payerUserId: intent.payerUserId, membershipId: membership.id, checkoutId: intent.id,
    status: membership.status, cancelAtPeriodEnd: membership.cancel_at_period_end,
    currentPeriodEnd: end, checkedAt: new Date(),
  };
  const [row] = await tx.insert(spaceSubscriptionsTable).values({ coupleId: intent.coupleId, ...update })
    .onConflictDoUpdate({ target: spaceSubscriptionsTable.coupleId, set: update }).returning();
  await tx.update(billingCheckoutsTable).set({ state: "linked", checkedAt: new Date() }).where(eq(billingCheckoutsTable.id, intent.id));
  return row!;
}
async function reconcileLocked(tx: Tx, coupleId: number, force: boolean) {
  const existing = await subscription(tx, coupleId);
  const newest = await latestCheckout(tx, coupleId);
  const replacing = newest?.state === "pending" && newest.id !== existing?.checkoutId;
  const intent = replacing ? newest : existing ? (await tx.select().from(billingCheckoutsTable).where(eq(billingCheckoutsTable.id, existing.checkoutId)))[0] : newest;
  if (!intent) return existing;
  const fresh = replacing ? intent.checkedAt : existing?.checkedAt ?? intent.checkedAt;
  if (!force && fresh && Date.now() - fresh.getTime() < (existing && !replacing ? 60000 : 10000)) return existing;
  const client = await getWhopClient();
  if (existing && !replacing) {
    const membership = await whopCall(() => client.memberships.retrieve({ id: existing.membershipId }));
    return applyMembership(tx, intent, membership);
  }
  if (!intent.planId || intent.state !== "pending") return existing;
  const memberships = await whopCall(() => client.memberships.list({ account_id: billingConfig().companyId, plan_ids: [intent.planId!], first: 10 }));
  const match = memberships.data.find(m => m.metadata.cd_checkout_id === intent.id && !!m.user_id && ["active", "trialing", "canceling", "past_due", "canceled", "expired"].includes(m.status));
  await tx.update(billingCheckoutsTable).set({ checkedAt: new Date() }).where(eq(billingCheckoutsTable.id, intent.id));
  return match ? applyMembership(tx, intent, match) : existing;
}
export async function refreshSubscription(coupleId: number, force = false) {
  return db.transaction(async tx => { await lockSpace(tx, coupleId); return reconcileLocked(tx, coupleId, force); });
}
export async function requirePlus(coupleId: number) {
  const row = await refreshSubscription(coupleId);
  if (!hasPaidAccess(row)) fail(402, "Couple Dates Plus unlocks the AI date assistant and yearly recap for both partners. Your memories and manual date plans remain free.");
}
export async function billingStatus(coupleId: number, userId: string, force = false) {
  let row: Subscription | undefined, verificationPending = false;
  try { row = await refreshSubscription(coupleId, force); }
  catch { verificationPending = true; [row] = await db.select().from(spaceSubscriptionsTable).where(eq(spaceSubscriptionsTable.coupleId, coupleId)); }
  const [intent] = await db.select().from(billingCheckoutsTable).where(eq(billingCheckoutsTable.coupleId, coupleId)).orderBy(desc(billingCheckoutsTable.createdAt)).limit(1);
  const entitled = !verificationPending && hasPaidAccess(row);
  const pending = intent?.state === "pending";
  const isPayer = pending ? intent.payerUserId === userId : !!row && row.payerUserId === userId;
  const renewable = !!row && !["canceled", "expired", "completed"].includes(row.status);
  return {
    plan: entitled ? "plus" as const : "free" as const, entitled, providerStatus: verificationPending ? "unknown" : row?.status ?? "none",
    isPayer, canManage: !!row && !pending && isPayer && !verificationPending,
    cancelAtPeriodEnd: row?.cancelAtPeriodEnd ?? false, currentPeriodEnd: row?.currentPeriodEnd?.toISOString() ?? null,
    checkoutPending: !!pending, checkoutAvailable: !verificationPending && !entitled && !renewable && (!pending || isPayer),
    verificationPending, price: PLUS_PRICE_USD, currency: "usd", billingIntervalDays: PLUS_PERIOD_DAYS,
    notice: verificationPending ? "We couldn't verify billing with Whop. Retry before starting checkout. Your memories are still available."
      : entitled ? row?.cancelAtPeriodEnd ? "Renewal is off. Both partners keep Plus until the end of the paid period. Memories stay accessible afterward." : "One subscription covers both partners in this space."
        : pending ? "Checkout is awaiting a verified purchase. A redirect or confirmation message alone does not activate Plus."
          : "Memories, photos, manual dates, calendars and streaks remain free. Plus adds the AI date assistant and yearly recap for both partners.",
  };
}
export async function createCheckout(coupleId: number, userId: string) {
  const config = billingConfig();
  await ensureBillingWebhook();
  return db.transaction(async tx => {
    await lockSpace(tx, coupleId);
    const row = await reconcileLocked(tx, coupleId, true);
    if (hasPaidAccess(row)) fail(409, "Both partners already have Plus in this space.");
    if (row && !["canceled", "expired", "completed"].includes(row.status)) fail(409, "This space already has a renewable subscription. Manage its payment details instead of starting another.");
    const old = await latestCheckout(tx, coupleId);
    if (old?.state === "pending" && old.checkoutUrl) {
      if (old.payerUserId !== userId) fail(409, "Your partner has checkout in progress. Ask them to finish or resume it; you don't need separate subscriptions.");
      return { url: trustedWhopUrl(old.checkoutUrl), resumed: true };
    }
    const client = await getWhopClient();
    const base = await whopCall(() => client.plans.retrieve({ id: config.planId }));
    if (base.renewal_price !== PLUS_PRICE_USD || base.initial_price !== 0 || base.billing_period !== PLUS_PERIOD_DAYS || base.currency !== "usd" || base.product?.id !== config.productId) {
      fail(503, "The Whop offer doesn't match the approved US$5 recurring price. Checkout has been paused.");
    }
    // Retire old links before replacing an ended subscription.
    if (old?.planId) await whopCall(() => client.plans.update({ id: old.planId!, visibility: "archived" }));
    const id = randomUUID();
    // One unit of stock makes this couple's private offer single-purchase, even if
    // both partners reach the hosted checkout simultaneously.
    const plan = await whopCall(() => client.plans.create({
      account_id: config.companyId, product_id: config.productId, title: "Couple Dates Plus",
      plan_type: "renewal", initial_price: 0, renewal_price: base.renewal_price,
      billing_period: base.billing_period, currency: base.currency, visibility: "hidden",
      unlimited_stock: false, stock: 1, trial_period_days: 0,
    }, { idempotencyKey: `couple-plan-${id}` }));
    const checkout = await whopCall(() => client.checkoutConfigurations.create({
      account_id: config.companyId, plan_id: plan.id, mode: "payment",
      redirect_url: `${config.origin}/billing?checkout=return`, metadata: { cd_checkout_id: id },
    }, { idempotencyKey: `couple-checkout-${id}` }));
    const url = trustedWhopUrl(checkout.purchase_url);
    await tx.insert(billingCheckoutsTable).values({ id, coupleId, payerUserId: userId, planId: plan.id, checkoutId: checkout.id, checkoutUrl: url });
    return { url, resumed: false };
  });
}
export async function manageSubscription(coupleId: number, userId: string, action: "manage" | "cancel" | "resume") {
  return db.transaction(async tx => {
    await lockSpace(tx, coupleId);
    const row = await subscription(tx, coupleId);
    if (!row) fail(409, "This space has no subscription to manage.");
    if (row.payerUserId !== userId) fail(403, "Only the partner who started this subscription can manage its billing.");
    const client = await getWhopClient();
    let membership = await whopCall(() => client.memberships.retrieve({ id: row.membershipId }));
    const [intent] = await tx.select().from(billingCheckoutsTable).where(eq(billingCheckoutsTable.id, row.checkoutId));
    if (!intent) fail(409, "This subscription's checkout couldn't be verified.");
    verifyMembershipBinding(membership, intent, billingConfig().companyId, billingConfig().productId);
    if (action === "cancel" && hasPaidAccess({ status: membership.status, currentPeriodEnd: membership.current_period_end ? new Date(membership.current_period_end) : null }) && !membership.cancel_at_period_end) {
      membership = await whopCall(() => client.memberships.cancel({ id: row.membershipId, cancel_at_period_end: true, reason: "Partner requested cancellation in Couple Dates." }));
    } else if (action === "resume") {
      if (!membership.cancel_at_period_end || !hasPaidAccess({ status: membership.status, currentPeriodEnd: membership.current_period_end ? new Date(membership.current_period_end) : null })) fail(409, "Only a subscription still in its paid period can resume renewal.");
      membership = await whopCall(() => client.memberships.resume({ id: row.membershipId }));
    }
    await applyMembership(tx, intent, membership);
    return action === "manage" ? { url: trustedWhopUrl(membership.manage_url || "https://whop.com/orders") } : null;
  });
}
export async function reconcileWebhookMembership(membershipId: string) {
  const client = await getWhopClient();
  const hint = await whopCall(() => client.memberships.retrieve({ id: membershipId }));
  const intentId = hint.metadata.cd_checkout_id;
  if (typeof intentId !== "string" || !/^[0-9a-f-]{36}$/i.test(intentId)) return;
  const [intent] = await db.select().from(billingCheckoutsTable).where(eq(billingCheckoutsTable.id, intentId));
  if (!intent) return; // The company's other products/environments aren't this space.
  await db.transaction(async tx => {
    await lockSpace(tx, intent.coupleId);
    // Re-read after acquiring the lock: delivery order never overwrites newer provider state.
    const current = await whopCall(() => client.memberships.retrieve({ id: membershipId }));
    await applyMembership(tx, intent, current);
  });
}
