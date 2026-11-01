import { count, eq, sql } from "drizzle-orm";
import {
  accountLinksTable,
  assistantTurnsTable,
  calendarConnectionsTable,
  checkInsTable,
  couplesTable,
  datesTable,
  db,
  memoriesTable,
  membersTable,
  preferencesTable,
  spaceSubscriptionsTable,
  uploadsTable,
} from "@workspace/db";
import { cleanupAbandonedSoloSpace, joinCoupleByInvite } from "./couple-membership";
import {
  classifyCoupleSpace,
  planCoupleSpaceCleanup,
  type CleanupPlan,
  type SpaceCleanupCandidate,
} from "./couple-space-cleanup-plan";
import { fail } from "./validation";

export type { CleanupPlan, SpaceCleanupCandidate };
export { planCoupleSpaceCleanup, classifyCoupleSpace };

/** Snapshot every couple space for cleanup reporting. Never guesses merges by name. */
export async function listCoupleSpaceCandidates(): Promise<SpaceCleanupCandidate[]> {
  const couples = await db.select().from(couplesTable).orderBy(couplesTable.id);
  const out: SpaceCleanupCandidate[] = [];
  for (const couple of couples) {
    const members = await db.select().from(membersTable).where(eq(membersTable.coupleId, couple.id));
    const memberUserIds = members.map(m => m.userId);
    const [dates] = await db.select({ total: count() }).from(datesTable).where(eq(datesTable.coupleId, couple.id));
    const [memories] = await db.select({ total: count() }).from(memoriesTable).where(eq(memoriesTable.coupleId, couple.id));
    const [checkIns] = await db.select({ total: count() }).from(checkInsTable).where(eq(checkInsTable.coupleId, couple.id));
    const [uploads] = await db.select({ total: count() }).from(uploadsTable).where(eq(uploadsTable.coupleId, couple.id));
    const [assistantTurns] = await db.select({ total: count() }).from(assistantTurnsTable).where(eq(assistantTurnsTable.coupleId, couple.id));
    const [sub] = await db.select().from(spaceSubscriptionsTable).where(eq(spaceSubscriptionsTable.coupleId, couple.id)).limit(1);
    let hasAccountLink = false;
    for (const userId of memberUserIds) {
      const [link] = await db.select().from(accountLinksTable).where(eq(accountLinksTable.memberUserId, userId)).limit(1);
      if (link) { hasAccountLink = true; break; }
    }
    const base = {
      coupleId: couple.id,
      inviteCode: couple.inviteCode,
      yourName: couple.yourName,
      partnerName: couple.partnerName,
      memberCount: members.length,
      memberUserIds,
      dates: dates?.total ?? 0,
      memories: memories?.total ?? 0,
      checkIns: checkIns?.total ?? 0,
      uploads: uploads?.total ?? 0,
      assistantTurns: assistantTurns?.total ?? 0,
      hasSubscription: !!sub,
      hasAccountLink,
    };
    out.push({ ...base, kind: classifyCoupleSpace(base) });
  }
  return out;
}

/** Remove couple rows that no longer have any members. */
export async function applyOrphanCoupleCleanup(orphans: SpaceCleanupCandidate[], apply: boolean) {
  const results: { coupleId: number; deleted: boolean }[] = [];
  for (const orphan of orphans) {
    if (!apply) {
      results.push({ coupleId: orphan.coupleId, deleted: false });
      continue;
    }
    await db.transaction(async tx => {
      await cleanupAbandonedSoloSpace(tx, orphan.coupleId);
    });
    results.push({ coupleId: orphan.coupleId, deleted: true });
  }
  return results;
}

/**
 * Release an empty mistaken solo space so the person returns to onboarding and
 * can join their partner's invite. Skips subscriptions and account-recovery links.
 */
export async function releaseEmptySoloSpace(coupleId: number, apply: boolean) {
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${coupleId})`);
    const [couple] = await tx.select().from(couplesTable).where(eq(couplesTable.id, coupleId)).for("update");
    if (!couple) fail(404, `Couple ${coupleId} was not found.`);
    const members = await tx.select().from(membersTable).where(eq(membersTable.coupleId, coupleId));
    if (members.length !== 1) fail(409, `Couple ${coupleId} is not a solo space.`);
    const userId = members[0]!.userId;

    const [sub] = await tx.select().from(spaceSubscriptionsTable).where(eq(spaceSubscriptionsTable.coupleId, coupleId));
    if (sub) fail(409, `Couple ${coupleId} has a subscription and cannot be released automatically.`);
    const [link] = await tx.select().from(accountLinksTable).where(eq(accountLinksTable.memberUserId, userId));
    if (link) fail(409, `Member ${userId} has an account-recovery link; refuse automatic release.`);

    const [dates] = await tx.select({ total: count() }).from(datesTable).where(eq(datesTable.coupleId, coupleId));
    const [memories] = await tx.select({ total: count() }).from(memoriesTable).where(eq(memoriesTable.coupleId, coupleId));
    const [checkIns] = await tx.select({ total: count() }).from(checkInsTable).where(eq(checkInsTable.coupleId, coupleId));
    const [uploads] = await tx.select({ total: count() }).from(uploadsTable).where(eq(uploadsTable.coupleId, coupleId));
    const [assistant] = await tx.select({ total: count() }).from(assistantTurnsTable).where(eq(assistantTurnsTable.coupleId, coupleId));
    const content = (dates?.total ?? 0) + (memories?.total ?? 0) + (checkIns?.total ?? 0) + (uploads?.total ?? 0) + (assistant?.total ?? 0);
    if (content > 0) fail(409, `Couple ${coupleId} still has shared content and cannot be released automatically.`);

    if (!apply) return { coupleId, userId, released: false as const };

    await tx.delete(preferencesTable).where(eq(preferencesTable.userId, userId));
    await tx.delete(calendarConnectionsTable).where(eq(calendarConnectionsTable.userId, userId));
    await tx.delete(membersTable).where(eq(membersTable.userId, userId));
    await cleanupAbandonedSoloSpace(tx, coupleId);
    return { coupleId, userId, released: true as const };
  });
}

export async function applyEmptySoloReleases(emptySolos: SpaceCleanupCandidate[], apply: boolean) {
  const results = [];
  for (const solo of emptySolos) {
    results.push(await releaseEmptySoloSpace(solo.coupleId, apply));
  }
  return results;
}

/** Explicit, safe move into a known invite — same path as the product join API. */
export async function moveUserIntoInvite(userId: string, inviteCode: string) {
  return joinCoupleByInvite(userId, inviteCode);
}
