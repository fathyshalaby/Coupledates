// Launched ONLY by the scrubbed disposable-cluster runner. No real Google or app data.
import test, { before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { Server } from "node:http";
import express from "express";
import { eq } from "drizzle-orm";
import { db, pool, couplesTable, membersTable, memoriesTable, datesTable, accountLinksTable, calendarConnectionsTable } from "@workspace/db";
import recoveryRouter, { setGoogleAccountLoaderForIsolatedTests } from "../src/routes/account-recovery";
import coupleRouter from "../src/routes/couple";
import { effectiveMemberId, calendarAuthUserId } from "../src/lib/account-identity";
import { googleOwnership, issueRecovery } from "../src/lib/recovery-policy";
import "./recovery-policy.test";

const database = new URL(process.env.DATABASE_URL!);
assert.equal(process.env.BILLING_CONTRACT_TEST, "isolated");
assert.equal(database.pathname, "/billing_contract");
assert.match(database.searchParams.get("host")!, /^\/tmp\/cd-billing-[^/]+\/socket$/);
const origin = "https://billing.example.test";
const legacy = "user_previewOwner", current = "user_liveOwner", partner = "user_partner", outsider = "user_outsider";
let server: Server, url: string, originalId: number, newerId: number;
let subject = "same-google-subject";
const external = () => ({ provider: "oauth_google", externalId: subject, verification: { status: "verified" } });
const code = () => issueRecovery(legacy, originalId, googleOwnership([external()], process.env.SESSION_SECRET!), process.env.SESSION_SECRET!).code;
async function call(path: string, user = current, data?: unknown, requestOrigin = origin) {
  const response = await fetch(url + path, { method: data === undefined ? "GET" : "POST",
    headers: { "x-fixture-user": user, origin: requestOrigin, "content-type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data) });
  return { status: response.status, body: await response.json() as Record<string, unknown>, headers: response.headers };
}
before(async () => {
  await pool.query(await readFile(process.env.BILLING_CONTRACT_SCHEMA!, "utf8"));
  // Only the fixture server bypasses Clerk middleware. The actual getAuth/requireUser
  // and membership resolver run; the production app has no fixture header support.
  setGoogleAccountLoaderForIsolatedTests(async () => [external()]);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const auth = Object.assign(() => ({ userId: req.get("x-fixture-user") || null, tokenType: "session_token" }), {
      [Symbol.for("@clerk/express.auth")]: true,
    });
    Object.assign(req, { auth, log: { info() {} } });
    next();
  });
  app.use("/api", recoveryRouter, coupleRouter);
  app.use((error: { status?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.status || 500).json({ error: error.message || "Fixture error" });
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  url = `http://127.0.0.1:${address.port}`;
});
beforeEach(async () => {
  await pool.query("TRUNCATE couples RESTART IDENTITY CASCADE");
  const [original, newer] = await db.insert(couplesTable).values([
    { yourName: "Original", partnerName: "Pair", anniversary: "2025-01-01", timezone: "UTC", inviteCode: "original-fixture-invite" },
    { yourName: "Newer", partnerName: "Pair", anniversary: "2025-01-01", timezone: "UTC", inviteCode: "newer-fixture-invite" },
  ]).returning();
  originalId = original.id; newerId = newer.id;
  await db.insert(membersTable).values([{ userId: legacy, coupleId: originalId }, { userId: partner, coupleId: originalId }, { userId: current, coupleId: newerId }]);
  await db.insert(memoriesTable).values([
    { coupleId: originalId, title: "Original memory", note: "", date: "2026-10-01", category: "other", favorite: true },
    { coupleId: newerId, title: "Newer memory", note: "", date: "2026-10-02", category: "other", favorite: false },
  ]);
  await db.insert(datesTable).values({ coupleId: originalId, title: "Existing proposal", date: "2026-10-21", category: "other", status: "proposed", proposedBy: legacy, location: "", notes: "" });
  await db.insert(calendarConnectionsTable).values({ userId: legacy, coupleId: originalId, enabled: true, shareAvailability: true });
  subject = "same-google-subject";
  process.env.NODE_ENV = "production";
});
after(async () => { server?.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await pool.end(); });

test("anonymous and cross-origin recovery requests are rejected without links", async () => {
  assert.equal((await call("/api/account/recovery", "")).status, 401);
  assert.equal((await call("/api/account/recovery/confirm", current, { code: code() }, "https://evil.example.test")).status, 403);
  assert.equal((await db.select().from(accountLinksTable)).length, 0);
});
test("ownership check is read-only, and names/emails cannot override a different Google subject", async () => {
  const proof = code();
  const checked = await call("/api/account/recovery/check", current, { code: proof });
  assert.equal(checked.status, 200);
  assert.equal(checked.body.spaceName, "Original & Pair");
  assert.equal((await db.select().from(accountLinksTable)).length, 0);
  subject = "different-google-subject";
  assert.equal((await call("/api/account/recovery/confirm", outsider, { code: proof })).status, 403);
  assert.equal((await effectiveMemberId(current)), current);
});
test("confirm reconnects the existing space and preserves both partner seats and both spaces' data", async () => {
  const proof = code();
  assert.equal((await call("/api/account/recovery/confirm", current, { code: proof })).status, 200);
  const resolved = await call("/api/couple");
  assert.equal(resolved.status, 200);
  assert.equal((resolved.body.couple as { id: number }).id, originalId);
  assert.equal(resolved.headers.get("cache-control"), "no-store");
  assert.equal(await effectiveMemberId(current), legacy);
  assert.equal(await effectiveMemberId(partner), partner);
  assert.equal(await effectiveMemberId(outsider), outsider);
  assert.equal(await calendarAuthUserId(legacy), current);
  assert.equal((await db.select().from(couplesTable)).length, 2);
  assert.equal((await db.select().from(membersTable)).length, 3);
  assert.equal((await db.select().from(memoriesTable)).length, 2);
  assert.equal((await db.select().from(datesTable))[0].proposedBy, legacy);
  const [calendar] = await db.select().from(calendarConnectionsTable);
  assert.equal(calendar.enabled, false); assert.equal(calendar.shareAvailability, false); assert.equal(calendar.needsConsent, true);
  // Retry is idempotent and cannot consume a partner seat or replace data.
  assert.equal((await call("/api/account/recovery/confirm", current, { code: proof })).status, 200);
  assert.equal((await db.select().from(accountLinksTable)).length, 1);
  assert.equal((await db.select().from(membersTable)).length, 3);
});
test("another login cannot replace an existing recovery link, even with a replayed proof", async () => {
  const proof = code();
  assert.equal((await call("/api/account/recovery/confirm", current, { code: proof })).status, 200);
  assert.equal((await call("/api/account/recovery/confirm", outsider, { code: proof })).status, 409);
  assert.equal(await effectiveMemberId(outsider), outsider);
});
test("explicit space selection preserves data and survives future authenticated requests", async () => {
  await call("/api/account/recovery/confirm", current, { code: code() });
  assert.equal((await call("/api/account/recovery/select", current, { useRecovered: false })).status, 200);
  assert.equal(((await call("/api/couple")).body.couple as { id: number }).id, newerId);
  await call("/api/account/recovery/select", current, { useRecovered: true });
  assert.equal(((await call("/api/couple")).body.couple as { id: number }).id, originalId);
  assert.equal((await db.select().from(memoriesTable)).length, 2);
});
test("missing memberships and invalid codes never create links", async () => {
  const proof = code();
  await db.delete(membersTable).where(eq(membersTable.userId, legacy));
  assert.equal((await call("/api/account/recovery/confirm", current, { code: proof })).status, 404);
  assert.equal((await call("/api/account/recovery/confirm", current, { code: "malformed".repeat(5) })).status, 403);
  assert.equal((await db.select().from(accountLinksTable)).length, 0);
});
test("proof generation is preview-only; verified Google ownership is mandatory", async () => {
  assert.equal((await call("/api/account/recovery/proof", legacy, {})).status, 409);
  process.env.NODE_ENV = "test";
  const result = await call("/api/account/recovery/proof", legacy, {});
  assert.equal(result.status, 200); assert.equal(typeof result.body.code, "string");
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal((await call("/api/account/recovery/check", current, { code: result.body.code })).status, 409);
});
