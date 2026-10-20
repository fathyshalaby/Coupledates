import test, { before, beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { request, type Server } from "node:http";
import express from "express";
import { eq } from "drizzle-orm";
import {
  db, pool, couplesTable, membersTable, memoriesTable, billingCheckoutsTable,
  spaceSubscriptionsTable, billingWebhookSettingsTable, billingWebhookEventsTable,
} from "@workspace/db";
import { billingStatus, createCheckout, manageSubscription, refreshSubscription, requirePlus } from "../src/lib/billing";
import { getWhopClient } from "../src/lib/whopClient";
import { billingWebhook } from "../src/routes/billing-webhook";
import { decryptWebhookSecret } from "../src/lib/billing-webhook-secret";
import { WhopTransport, START, END, SIGNING_KEY } from "./fixtures/whop-transport";

// This entry point is launched ONLY by run-billing-contract.mjs with a scrubbed
// environment and a brand-new local database. Never point it at an app database.
const database = new URL(process.env.DATABASE_URL!);
assert.equal(process.env.BILLING_CONTRACT_TEST, "isolated");
assert.equal(database.pathname, "/billing_contract");
assert.match(database.searchParams.get("host")!, /^\/tmp\/cd-billing-[^/]+\/socket$/);
const transport = new WhopTransport();
transport.install();
let server: Server;
let coupleId: number;
const owner = "partner_contract_owner", partner = "partner_contract_other";
const memory = { title: "Keep this memory", note: "Billing must never remove this",
  date: "2026-10-01", category: "adventure", photoPath: "/objects/contract/photo", favorite: true };

before(async () => {
  await pool.query(await readFile(process.env.BILLING_CONTRACT_SCHEMA!, "utf8"));
  const app = express();
  app.post("/api/billing/webhook", express.raw({ type: "application/json" }), billingWebhook);
  app.use((error: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.status || 500).json({ error: "Fixture request failed" });
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
});

beforeEach(async context => {
  assert.ok("mock" in context);
  context.mock.timers.enable({ apis: ["Date"], now: START });
  transport.reset();
  // Only the disposable cluster is reachable; reset between independent scenarios.
  await pool.query("TRUNCATE billing_webhook_events, billing_webhook_settings, space_subscriptions, billing_checkouts, memories, couple_members, couples RESTART IDENTITY CASCADE");
  const [space] = await db.insert(couplesTable).values({
    yourName: "Owner", partnerName: "Partner", anniversary: "2020-01-01",
    timezone: "UTC", inviteCode: randomUUID(),
  }).returning();
  coupleId = space.id;
  await db.insert(membersTable).values([{ coupleId, userId: owner }, { coupleId, userId: partner }]);
  await db.insert(memoriesTable).values({ coupleId, ...memory });
});

afterEach(() => {
  assert.deepEqual(transport.violations, [], "Contract fixture assertions must not be swallowed by whopCall");
});

after(async () => {
  globalThis.fetch = transport.originalFetch;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await pool.end();
  assert.deepEqual(transport.blocked, [], "No unexpected/external requests are permitted");
});

function rejectsStatus(operation: Promise<unknown>, status: number) {
  return assert.rejects(operation, (error: unknown) => (error as { status?: number }).status === status);
}
async function checkout() {
  await createCheckout(coupleId, owner);
  const [intent] = await db.select().from(billingCheckoutsTable).where(eq(billingCheckoutsTable.coupleId, coupleId));
  assert.equal(intent.state, "pending");
  return intent;
}
async function activated() {
  const intent = await checkout();
  const member = transport.activate(intent);
  await refreshSubscription(coupleId, true);
  return { intent, member };
}
async function sharedAccess(entitled: boolean) {
  for (const user of [owner, partner]) {
    const status = await billingStatus(coupleId, user);
    assert.equal(status.entitled, entitled);
    assert.equal(status.plan, entitled ? "plus" : "free");
  }
  if (entitled) await requirePlus(coupleId);
  else await rejectsStatus(requirePlus(coupleId), 402);
}
async function memoriesIntact() {
  const rows = await db.select().from(memoriesTable).where(eq(memoriesTable.coupleId, coupleId));
  assert.equal(rows.length, 1);
  for (const [key, value] of Object.entries(memory)) assert.equal(rows[0][key as keyof typeof rows[0]], value);
  const members = await db.select().from(membersTable).where(eq(membersTable.coupleId, coupleId));
  assert.deepEqual(members.map(m => m.userId).sort(), [owner, partner].sort());
}

// Real HTTP/raw-body authentication without reaching the running application.
function deliver(type: string, id: string, options: {
  eventId?: string; stamp?: string; signature?: string; tamper?: boolean; extra?: Record<string, unknown>;
} = {}) {
  const eventId = options.eventId ?? `msg_${randomUUID()}`;
  const stamp = options.stamp ?? String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ type, data: { id, ...options.extra } });
  const signature = options.signature ?? `v1,${createHmac("sha256", SIGNING_KEY).update(`${eventId}.${stamp}.${body}`).digest("base64")}`;
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return new Promise<number>((resolve, reject) => {
    const req = request({
      hostname: "127.0.0.1", port: address.port, path: "/api/billing/webhook", method: "POST",
      headers: { "content-type": "application/json", "webhook-id": eventId, "webhook-timestamp": stamp, "webhook-signature": signature },
    }, res => {
      res.resume();
      res.on("end", () => resolve(res.statusCode!));
    });
    req.on("error", reject);
    req.end(body + (options.tamper ? " " : ""));
  });
}

test("dated SDK wire contracts provision a private single-purchase offer and only verified activation unlocks both partners", async () => {
  const intent = await checkout();
  await sharedAccess(false);
  const status = await billingStatus(coupleId, owner);
  assert.equal(status.checkoutPending, true);
  assert.equal(status.canManage, false);
  assert.deepEqual([status.price, status.currency, status.billingIntervalDays], [5, "usd", 30]);
  const [settings] = await db.select().from(billingWebhookSettingsTable);
  assert.equal(decryptWebhookSecret(settings.encryptedSecret), SIGNING_KEY);
  assert.ok(!settings.encryptedSecret.includes(SIGNING_KEY));

  const member = transport.activate(intent);
  assert.equal(await deliver("membership.activated", member.id), 200);
  await sharedAccess(true);
  const [saved] = await db.select().from(spaceSubscriptionsTable);
  assert.equal(saved.membershipId, member.id);
  assert.equal(saved.checkoutId, intent.id);
  assert.equal(saved.currentPeriodEnd?.toISOString(), END, "ISO dates are not epoch seconds");
  assert.equal(saved.payerUserId, owner);
  const client = await getWhopClient();
  const raw = await client.memberships.retrieve({ id: member.id });
  assert.deepEqual(raw.account, member.account);
  assert.equal(raw.product_id, "prod_contract");
  assert.equal(raw.plan_id, intent.planId);
  assert.equal(raw.user_id, "user_whop_contract");
  assert.deepEqual(raw.metadata, { cd_checkout_id: intent.id });
  assert.equal(raw.current_period_end, END);
  assert.equal((await billingStatus(coupleId, owner)).canManage, true);
  assert.equal((await billingStatus(coupleId, partner)).canManage, false);
  const [linked] = await db.select().from(billingCheckoutsTable);
  assert.equal(linked.state, "linked");
  await memoriesIntact();
});

test("simultaneous partner checkouts serialize, and the initiating owner alone can resume the one-use link", async () => {
  const results = await Promise.allSettled([createCheckout(coupleId, owner), createCheckout(coupleId, partner)]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  const rejected = results.find(r => r.status === "rejected") as PromiseRejectedResult;
  assert.equal(rejected.reason.status, 409);
  const [intent] = await db.select().from(billingCheckoutsTable);
  const resumed = await createCheckout(coupleId, intent.payerUserId);
  assert.equal(resumed.resumed, true);
  assert.equal(resumed.url, intent.checkoutUrl);
  assert.equal(transport.calls.filter(c => c.path === "/plans" && c.method === "POST").length, 1);
  assert.equal(transport.calls.filter(c => c.path === "/checkout_configurations").length, 1);
});

test("only the billing owner can manage, cancel or resume; cancellation preserves both partners' paid time", async () => {
  const { member } = await activated();
  const beforeCalls = transport.calls.length;
  for (const action of ["manage", "cancel", "resume"] as const) {
    await rejectsStatus(manageSubscription(coupleId, partner, action), 403);
  }
  assert.equal(transport.calls.length, beforeCalls, "Non-owner requests never reach Whop");
  assert.deepEqual(await manageSubscription(coupleId, owner, "manage"), { url: member.manage_url });
  await manageSubscription(coupleId, owner, "cancel");
  await sharedAccess(true);
  assert.equal((await billingStatus(coupleId, partner)).cancelAtPeriodEnd, true);
  await manageSubscription(coupleId, owner, "cancel");
  assert.equal(transport.calls.filter(c => c.path.endsWith("/cancel")).length, 1, "Cancel is idempotent");
  await manageSubscription(coupleId, owner, "resume");
  await sharedAccess(true);
  assert.equal((await billingStatus(coupleId, partner)).cancelAtPeriodEnd, false);
  await rejectsStatus(manageSubscription(coupleId, owner, "resume"), 409);
});

test("paid-period expiry gates Plus at the exact boundary without touching saved memories or partner membership", async context => {
  await activated();
  await manageSubscription(coupleId, owner, "cancel");
  context.mock.timers.setTime(Date.parse(END) - 1);
  await sharedAccess(true);
  context.mock.timers.setTime(Date.parse(END));
  await sharedAccess(false);
  await rejectsStatus(manageSubscription(coupleId, owner, "resume"), 409);
  await memoriesIntact();
});

test("failed renewal removes shared Plus, forbids a duplicate subscription, and payment recovery restores access", async () => {
  const { member } = await activated();
  member.status = "past_due";
  transport.payments.set("pay_failed", { id: "pay_failed", membership_id: member.id });
  assert.equal(await deliver("payment.failed", "pay_failed"), 200);
  await sharedAccess(false);
  assert.equal((await billingStatus(coupleId, owner)).checkoutAvailable, false);
  await rejectsStatus(createCheckout(coupleId, owner), 409);
  await memoriesIntact();
  member.status = "active";
  member.current_period_end = "2026-12-19T12:00:00.000Z";
  transport.payments.set("pay_recovered", { id: "pay_recovered", membership_id: member.id });
  assert.equal(await deliver("payment.succeeded", "pay_recovered"), 200);
  await sharedAccess(true);
  assert.equal((await billingStatus(coupleId, partner)).currentPeriodEnd, member.current_period_end);
  await memoriesIntact();
});

test("delayed/out-of-order deliveries ignore payload state and re-read provider state after taking the space lock", async () => {
  const { member } = await activated();
  const oldActive = structuredClone(member);
  member.status = "past_due";
  // First retrieve is only a routing hint; the second read under lock is authoritative.
  transport.retrievals.push(oldActive, structuredClone(member));
  assert.equal(await deliver("membership.activated", member.id, { extra: { status: "active", current_period_end: "2099-01-01T00:00:00Z" } }), 200);
  await sharedAccess(false);
  member.status = "active";
  member.current_period_end = "2026-12-19T12:00:00.000Z";
  assert.equal(await deliver("membership.deactivated", member.id, { extra: { status: "expired" } }), 200);
  await sharedAccess(true);
  transport.payments.set("pay_late_failure", { id: "pay_late_failure", membership_id: member.id });
  assert.equal(await deliver("payment.failed", "pay_late_failure"), 200);
  await sharedAccess(true);
});

test("ended memberships can resubscribe under a new owner; retired membership events cannot overwrite the new subscription", async context => {
  const { intent: oldIntent, member: oldMember } = await activated();
  oldMember.status = "expired";
  oldMember.current_period_end = new Date(START).toISOString();
  assert.equal(await deliver("membership.deactivated", oldMember.id), 200);
  await sharedAccess(false);
  context.mock.timers.setTime(START + 1000);
  assert.equal((await createCheckout(coupleId, partner)).resumed, false);
  const intents = await db.select().from(billingCheckoutsTable);
  const newIntent = intents.find(i => i.id !== oldIntent.id)!;
  assert.equal(newIntent.payerUserId, partner);
  assert.notEqual(newIntent.planId, oldIntent.planId);
  const archive = transport.calls.findIndex(c => c.path === `/plans/${oldIntent.planId}` && c.method === "PATCH");
  const newPlan = transport.calls.map(c => c.path === "/plans" && c.method === "POST").lastIndexOf(true);
  assert.ok(archive >= 0 && archive < newPlan, "Old purchase link is retired before a replacement is created");
  const current = transport.activate(newIntent);
  assert.equal(await deliver("membership.activated", current.id), 200);
  await sharedAccess(true);
  oldMember.status = "active"; // Even an old membership that reports active cannot replace the newer checkout.
  oldMember.current_period_end = "2027-01-01T00:00:00.000Z";
  assert.equal(await deliver("membership.updated", oldMember.id), 200);
  const [saved] = await db.select().from(spaceSubscriptionsTable);
  assert.equal(saved.membershipId, current.id);
  assert.equal(saved.checkoutId, newIntent.id);
  assert.equal(saved.payerUserId, partner);
  await rejectsStatus(manageSubscription(coupleId, owner, "cancel"), 403);
  await manageSubscription(coupleId, partner, "cancel");
  await memoriesIntact();
});

test("HTTP signatures reject forgery, changed bytes and stale timestamps; duplicate events do not repeat provider work", async () => {
  const { member } = await activated();
  const eventId = `msg_${randomUUID()}`;
  const count = transport.calls.length;
  assert.equal(await deliver("membership.updated", member.id, { eventId, signature: "v1,fake" }), 403);
  assert.equal(await deliver("membership.updated", member.id, { eventId, tamper: true }), 403);
  assert.equal(await deliver("membership.updated", member.id, { eventId, stamp: String(START / 1000 - 600) }), 403);
  assert.equal(transport.calls.length, count);
  assert.equal(await deliver("membership.updated", member.id, { eventId }), 200);
  const afterDelivery = transport.calls.length;
  assert.equal(await deliver("membership.updated", member.id, { eventId }), 200);
  assert.equal(transport.calls.length, afterDelivery);
  const rows = await db.select().from(billingWebhookEventsTable).where(eq(billingWebhookEventsTable.id, eventId));
  assert.equal(rows.length, 1);
});

test("provider outages fail closed, leave events retryable, and recover without losing the purchase mapping", async () => {
  const { member } = await activated();
  transport.unavailable = true;
  const status = await billingStatus(coupleId, owner, true);
  assert.equal(status.verificationPending, true);
  assert.equal(status.entitled, false);
  assert.equal(status.checkoutAvailable, false);
  assert.equal(status.canManage, false);
  await rejectsStatus(refreshSubscription(coupleId, true), 503);
  const eventId = `msg_${randomUUID()}`;
  assert.equal(await deliver("membership.updated", member.id, { eventId }), 503);
  assert.equal((await db.select().from(billingWebhookEventsTable).where(eq(billingWebhookEventsTable.id, eventId))).length, 0);
  await memoriesIntact();
  transport.unavailable = false;
  assert.equal(await deliver("membership.updated", member.id, { eventId }), 200);
  await sharedAccess(true);
});

test("price drift pauses checkout before any purchasable offer is created", async () => {
  transport.renewalPrice = 500; // Catch dollars/cents confusion as well as accidental price changes.
  await rejectsStatus(createCheckout(coupleId, owner), 503);
  assert.equal(transport.calls.filter(c => c.method === "POST" && c.path === "/plans").length, 0);
  assert.equal((await db.select().from(billingCheckoutsTable)).length, 0);
  await sharedAccess(false);
});
