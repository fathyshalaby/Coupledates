import type { Request, Response } from "express";
import { unwrapWebhook } from "@whop/sdk/helpers";
import { db, billingWebhookSettingsTable, billingWebhookEventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { billingConfig, reconcileWebhookMembership, whopCall } from "../lib/billing";
import { decryptWebhookSecret } from "../lib/billing-webhook-secret";
import { getWhopClient } from "../lib/whopClient";
import { z } from "zod";

const eventSchema = z.object({ type: z.string().max(120), data: z.object({ id: z.string().max(150) }).passthrough() });
// Mounted BEFORE JSON parsing and Clerk. It authenticates the raw bytes via Whop.
export async function billingWebhook(req: Request, res: Response): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  const headers: Record<string, string> = {};
  for (const name of ["webhook-id", "webhook-signature", "webhook-timestamp"]) {
    const value = req.headers[name];
    if (typeof value !== "string" || !value || value.length > 2048) { res.status(400).json({ error: "Missing webhook signature." }); return; }
    headers[name] = value;
  }
  if (!Buffer.isBuffer(req.body)) { res.status(400).json({ error: "Expected raw JSON payload." }); return; }
  const [settings] = await db.select().from(billingWebhookSettingsTable).where(eq(billingWebhookSettingsTable.origin, billingConfig().origin));
  if (!settings) { res.status(503).json({ error: "Webhook verification is not configured." }); return; }
  let parsed: unknown;
  try {
    parsed = unwrapWebhook(req.body.toString("utf8"), { headers, key: decryptWebhookSecret(settings.encryptedSecret) });
  } catch {
    res.status(403).json({ error: "Invalid webhook signature." }); return;
  }
  const event = eventSchema.safeParse(parsed);
  if (!event.success) { res.status(400).json({ error: "Invalid webhook payload." }); return; }
  const [processed] = await db.select().from(billingWebhookEventsTable).where(eq(billingWebhookEventsTable.id, headers["webhook-id"]));
  if (processed) { res.json({ received: true }); return; }
  const { type, data } = event.data;
  let membershipId: string | null = null;
  if (type.startsWith("membership.") && data.id.startsWith("mem_")) membershipId = data.id;
  if (["payment.succeeded", "payment.failed"].includes(type) && data.id.startsWith("pay_")) {
    const client = await getWhopClient();
    const payment = await whopCall(() => client.payments.retrieve({ id: data.id }));
    membershipId = payment.membership_id;
  }
  if (membershipId) await reconcileWebhookMembership(membershipId);
  await db.insert(billingWebhookEventsTable).values({ id: headers["webhook-id"], type }).onConflictDoNothing();
  res.json({ received: true });
}
