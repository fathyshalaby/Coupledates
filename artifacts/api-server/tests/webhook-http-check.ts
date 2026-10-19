// Explicit development-only smoke check; no payment/membership mutations.
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { db, billingWebhookSettingsTable, billingWebhookEventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { decryptWebhookSecret } from "../src/lib/billing-webhook-secret";

async function run() {
  const origin = process.env.BILLING_APP_ORIGIN || "";
  if (!new URL(origin).hostname.endsWith(".replit.dev")) throw new Error("This smoke check is restricted to the development preview.");
  const [settings] = await db.select().from(billingWebhookSettingsTable).where(eq(billingWebhookSettingsTable.origin, origin));
  assert.ok(settings, "The development webhook must be provisioned.");
  const key = decryptWebhookSecret(settings.encryptedSecret);
  const id = `msg_smoke_${randomUUID()}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ type: "invoice.created", data: { id: "inv_unrelated_smoke_check" } });
  const signature = (stamp: string) => `v1,${createHmac("sha256", key).update(`${id}.${stamp}.${body}`).digest("base64")}`;
  const send = (text: string, stamp: string, sig: string) => fetch(`${origin}/api/billing/webhook`, {
    method: "POST", headers: { "Content-Type": "application/json", "webhook-id": id, "webhook-timestamp": stamp, "webhook-signature": sig }, body: text,
  });
  try {
    assert.equal((await send(body, timestamp, "v1,invalid")).status, 403);
    assert.equal((await send(body, timestamp, signature(timestamp))).status, 200);
    assert.equal((await send(body, timestamp, signature(timestamp))).status, 200);
    assert.equal((await send(body + " ", timestamp, signature(timestamp))).status, 403);
    const stale = String(Number(timestamp) - 600);
    assert.equal((await send(body, stale, signature(stale))).status, 403);
    const rows = await db.select().from(billingWebhookEventsTable).where(eq(billingWebhookEventsTable.id, id));
    assert.equal(rows.length, 1, "Repeat deliveries must be idempotent.");
    console.log("Webhook HTTP checks passed: valid delivery, duplicate delivery, forged signature, changed bytes, stale timestamp.");
  } finally {
    await db.delete(billingWebhookEventsTable).where(eq(billingWebhookEventsTable.id, id));
  }
}
run().then(() => process.exit(0)).catch(error => { console.error(error.message); process.exit(1); });
