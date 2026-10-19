import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { unwrapWebhook } from "@whop/sdk/helpers";
import { hasPaidAccess, trustedWhopUrl, verifyMembershipBinding } from "../src/lib/billing-policy";
import { encryptWebhookSecret, decryptWebhookSecret } from "../src/lib/billing-webhook-secret";

const now = Date.parse("2026-10-20T12:00:00Z");
const future = new Date(now + 86400000);
const membership = {
  id: "mem_test", account: { id: "biz_test" }, product_id: "prod_test", plan_id: "plan_private",
  user_id: "user_verified_whop", metadata: { cd_checkout_id: "private-server-reservation" },
};
const reservation = { id: "private-server-reservation", planId: "plan_private" };
const reject = (fn: () => unknown, status: number) => assert.throws(fn, (e: unknown) => (e as { status?: number }).status === status);

test("only provider-active memberships inside their paid period unlock both partners", () => {
  for (const status of ["active", "trialing", "canceling"]) assert.equal(hasPaidAccess({ status, currentPeriodEnd: future }, now), true);
  for (const status of ["none", "drafted", "past_due", "canceled", "expired", "completed", "unresolved"]) assert.equal(hasPaidAccess({ status, currentPeriodEnd: future }, now), false);
  assert.equal(hasPaidAccess(undefined, now), false);
  assert.equal(hasPaidAccess({ status: "active", currentPeriodEnd: null }, now), false);
  assert.equal(hasPaidAccess({ status: "active", currentPeriodEnd: new Date(now) }, now), false);
  assert.equal(hasPaidAccess({ status: "active", currentPeriodEnd: new Date(NaN) }, now), false);
});
test("cancel-at-period-end keeps access until the exact paid-through instant", () => {
  const canceledRenewal = { status: "canceling", currentPeriodEnd: future };
  assert.equal(hasPaidAccess(canceledRenewal, future.getTime() - 1), true);
  assert.equal(hasPaidAccess(canceledRenewal, future.getTime()), false);
});
test("a real Whop buyer must match the private server checkout, product, account, and reserved plan", () => {
  assert.doesNotThrow(() => verifyMembershipBinding(membership, reservation, "biz_test", "prod_test"));
  for (const changed of [
    { ...membership, account: { id: "biz_other" } }, { ...membership, product_id: "prod_other" },
    { ...membership, plan_id: "plan_shared_link" }, { ...membership, user_id: null },
    { ...membership, metadata: { cd_checkout_id: "someone-elses-space" } },
    { ...membership, id: "client_success_true" },
  ]) reject(() => verifyMembershipBinding(changed, reservation, "biz_test", "prod_test"), 409);
});
test("checkout and management links only go to HTTPS Whop hosts, not lookalikes", () => {
  assert.equal(trustedWhopUrl("https://whop.com/checkout/secret"), "https://whop.com/checkout/secret");
  assert.ok(trustedWhopUrl("https://payments.whop.com/checkout"));
  for (const url of ["http://whop.com", "https://whop.com.attacker.test", "https://whop.com@evil.test", "https://evil.test/?next=whop.com", "javascript:alert(1)", null]) reject(() => trustedWhopUrl(url), 502);
});
test("webhook secrets are authenticated-encrypted at rest, not readable or tamperable", () => {
  const previous = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "test-only-encryption-key-not-a-real-secret";
  try {
    const secret = "ws_test_only_signing_secret";
    const encrypted = encryptWebhookSecret(secret);
    assert.ok(!encrypted.includes(secret));
    assert.equal(decryptWebhookSecret(encrypted), secret);
    const pieces = encrypted.split(".");
    const bytes = Buffer.from(pieces[2], "base64"); bytes[0] ^= 1;
    pieces[2] = bytes.toString("base64");
    assert.throws(() => decryptWebhookSecret(pieces.join(".")));
  } finally {
    if (previous === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = previous;
  }
});
test("Whop webhook verification checks raw bytes, signature, and timestamp before trusting data", () => {
  const key = "ws_test_only_signing_secret";
  const body = JSON.stringify({ type: "membership.activated", data: { id: "mem_test" } });
  const id = "msg_test_delivery", timestamp = String(Math.floor(Date.now() / 1000));
  const sign = (time: string) => "v1," + createHmac("sha256", key).update(`${id}.${time}.${body}`).digest("base64");
  const headers = { "webhook-id": id, "webhook-timestamp": timestamp, "webhook-signature": sign(timestamp) };
  assert.deepEqual(unwrapWebhook(body, { key, headers }), JSON.parse(body));
  assert.throws(() => unwrapWebhook(body + " ", { key, headers }));
  assert.throws(() => unwrapWebhook(body, { key, headers: { ...headers, "webhook-signature": "v1,fake" } }));
  const old = String(Number(timestamp) - 600);
  assert.throws(() => unwrapWebhook(body, { key, headers: { ...headers, "webhook-timestamp": old, "webhook-signature": sign(old) } }));
});
