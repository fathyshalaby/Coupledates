// Launched ONLY by the scrubbed disposable-cluster runner (`pnpm test:couple-join`).
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db, pool, couplesTable, membersTable, preferencesTable, datesTable, accountLinksTable,
} from "@workspace/db";
import { joinCoupleByInvite } from "../src/lib/couple-membership";
import {
  applyOrphanCoupleCleanup,
  listCoupleSpaceCandidates,
  planCoupleSpaceCleanup,
  releaseEmptySoloSpace,
} from "../src/lib/couple-space-cleanup";

const database = new URL(process.env.DATABASE_URL!);
assert.equal(process.env.BILLING_CONTRACT_TEST, "isolated");
assert.equal(database.pathname, "/billing_contract");
assert.match(database.searchParams.get("host")!, /^\/tmp\/cd-billing-[^/]+\/socket$/);

async function expectFail(run: () => Promise<unknown>, status: number) {
  try {
    await run();
    assert.fail("expected join to fail");
  } catch (error) {
    assert.equal((error as { status?: number }).status, status);
  }
}

before(async () => {
  await pool.query(await readFile(process.env.BILLING_CONTRACT_SCHEMA!, "utf8"));
});

after(async () => {
  await pool.end();
});

test("solo partners can abandon a mistaken empty space and join the shared invite", async () => {
  const owner = `join-owner-${randomUUID()}`;
  const partner = `join-partner-${randomUUID()}`;
  const outsider = `join-outsider-${randomUUID()}`;
  const invite = `invite-${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const soloInvite = `solo-${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const fullInvite = `full-${randomUUID().replace(/-/g, "").slice(0, 16)}`;

  const [shared] = await db.insert(couplesTable).values({
    yourName: "Owner", partnerName: "Partner", anniversary: "2024-01-01", timezone: "UTC", inviteCode: invite,
  }).returning();
  const [solo] = await db.insert(couplesTable).values({
    yourName: "Alone", partnerName: "Waiting", anniversary: "2024-02-02", timezone: "UTC", inviteCode: soloInvite,
  }).returning();
  const [full] = await db.insert(couplesTable).values({
    yourName: "Full A", partnerName: "Full B", anniversary: "2024-03-03", timezone: "UTC", inviteCode: fullInvite,
  }).returning();

  await db.insert(membersTable).values([
    { userId: owner, coupleId: shared.id },
    { userId: partner, coupleId: solo.id },
    { userId: outsider, coupleId: full.id },
    { userId: `${outsider}-b`, coupleId: full.id },
  ]);
  await db.insert(preferencesTable).values({
    userId: partner, coupleId: solo.id, displayName: "Partner", interests: ["coffee"], avoid: "",
    budget: 40, currency: "EUR", city: "Vienna", timezone: "Europe/Vienna",
    relationshipMode: "together", availability: ["weeknights"], notes: "",
  });
  await db.insert(datesTable).values({
    coupleId: shared.id, proposedBy: owner, title: "Shared proposal", date: "2099-06-01",
    location: "", category: "Everyday", notes: "visible once joined", status: "proposed",
  });
  await db.insert(datesTable).values({
    coupleId: solo.id, proposedBy: partner, title: "Solo draft", date: "2099-06-02",
    location: "", category: "Everyday", notes: "should disappear with abandoned solo space", status: "proposed",
  });
  await db.insert(accountLinksTable).values({
    authUserId: `auth-${partner}`, memberUserId: partner, active: true,
  });

  const joined = await joinCoupleByInvite(partner, invite);
  assert.equal(joined.id, shared.id);

  const members = await db.select().from(membersTable).where(eq(membersTable.coupleId, shared.id));
  assert.equal(members.length, 2);
  assert.ok(members.some(m => m.userId === owner));
  assert.ok(members.some(m => m.userId === partner));

  const prefs = await db.select().from(preferencesTable).where(eq(preferencesTable.userId, partner));
  assert.equal(prefs[0]?.coupleId, shared.id);

  const abandoned = await db.select().from(couplesTable).where(eq(couplesTable.id, solo.id));
  assert.equal(abandoned.length, 0);

  const soloDates = await db.select().from(datesTable).where(eq(datesTable.coupleId, solo.id));
  assert.equal(soloDates.length, 0);

  const sharedDates = await db.select().from(datesTable).where(eq(datesTable.coupleId, shared.id));
  assert.equal(sharedDates.length, 1);
  assert.equal(sharedDates[0]?.title, "Shared proposal");

  const links = await db.select().from(accountLinksTable).where(eq(accountLinksTable.memberUserId, partner));
  assert.equal(links.length, 1, "account recovery links must survive the membership move");

  const again = await joinCoupleByInvite(partner, invite);
  assert.equal(again.id, shared.id);
  assert.equal((await db.select().from(membersTable).where(eq(membersTable.coupleId, shared.id))).length, 2);

  await expectFail(() => joinCoupleByInvite(`fresh-${randomUUID()}`, fullInvite), 409);
  await expectFail(() => joinCoupleByInvite(owner, "missing-invite-code-xx"), 404);
});

test("cleanup can remove orphan couples and release empty mistaken solos", async () => {
  const soloUser = `cleanup-solo-${randomUUID()}`;
  const [orphan] = await db.insert(couplesTable).values({
    yourName: "Ghost", partnerName: "None", anniversary: "2024-01-01", timezone: "UTC",
    inviteCode: `orphan-${randomUUID().replace(/-/g, "").slice(0, 12)}`,
  }).returning();
  const [emptySolo] = await db.insert(couplesTable).values({
    yourName: "Stuck", partnerName: "Partner", anniversary: "2024-01-01", timezone: "UTC",
    inviteCode: `empty-${randomUUID().replace(/-/g, "").slice(0, 12)}`,
  }).returning();
  await db.insert(membersTable).values({ userId: soloUser, coupleId: emptySolo.id });

  const candidates = await listCoupleSpaceCandidates();
  const plan = planCoupleSpaceCleanup(candidates);
  assert.ok(plan.orphans.some(c => c.coupleId === orphan.id));
  assert.ok(plan.emptySolos.some(c => c.coupleId === emptySolo.id));

  const dryOrphans = await applyOrphanCoupleCleanup(plan.orphans.filter(c => c.coupleId === orphan.id), false);
  assert.equal(dryOrphans[0]?.deleted, false);
  assert.equal((await db.select().from(couplesTable).where(eq(couplesTable.id, orphan.id))).length, 1);

  const appliedOrphans = await applyOrphanCoupleCleanup(plan.orphans.filter(c => c.coupleId === orphan.id), true);
  assert.equal(appliedOrphans[0]?.deleted, true);
  assert.equal((await db.select().from(couplesTable).where(eq(couplesTable.id, orphan.id))).length, 0);

  const dryRelease = await releaseEmptySoloSpace(emptySolo.id, false);
  assert.equal(dryRelease.released, false);
  assert.equal((await db.select().from(membersTable).where(eq(membersTable.userId, soloUser))).length, 1);

  const released = await releaseEmptySoloSpace(emptySolo.id, true);
  assert.equal(released.released, true);
  assert.equal((await db.select().from(membersTable).where(eq(membersTable.userId, soloUser))).length, 0);
  assert.equal((await db.select().from(couplesTable).where(eq(couplesTable.id, emptySolo.id))).length, 0);
});
