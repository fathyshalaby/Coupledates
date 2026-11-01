import { eq, sql } from "drizzle-orm";
import {
  aiUsageTable,
  assistantTurnsTable,
  billingCheckoutsTable,
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
import { fail } from "./validation";

export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Delete a couple row only after every membership has already moved away. */
export async function cleanupAbandonedSoloSpace(tx: DbTx, coupleId: number) {
  const remaining = await tx.select().from(membersTable).where(eq(membersTable.coupleId, coupleId));
  if (remaining.length > 0) return;

  await tx.delete(spaceSubscriptionsTable).where(eq(spaceSubscriptionsTable.coupleId, coupleId));
  await tx.delete(billingCheckoutsTable).where(eq(billingCheckoutsTable.coupleId, coupleId));
  await tx.delete(datesTable).where(eq(datesTable.coupleId, coupleId));
  await tx.delete(memoriesTable).where(eq(memoriesTable.coupleId, coupleId));
  await tx.delete(checkInsTable).where(eq(checkInsTable.coupleId, coupleId));
  await tx.delete(uploadsTable).where(eq(uploadsTable.coupleId, coupleId));
  await tx.delete(assistantTurnsTable).where(eq(assistantTurnsTable.coupleId, coupleId));
  await tx.delete(aiUsageTable).where(eq(aiUsageTable.coupleId, coupleId));
  await tx.delete(couplesTable).where(eq(couplesTable.id, coupleId));
}

/**
 * One shared space, at most two partners.
 * Joining is idempotent. A mistaken empty solo space can be abandoned so the
 * person can enter their partner's invite instead of getting stuck at "1 of 2".
 */
export async function joinCoupleByInvite(userId: string, rawCode: string) {
  const code = rawCode.trim();
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);

    const [target] = await tx.select().from(couplesTable).where(eq(couplesTable.inviteCode, code)).for("update");
    if (!target) fail(404, "That invite code wasn't found. Check with your partner.");

    const targetMembers = await tx.select().from(membersTable).where(eq(membersTable.coupleId, target.id));
    if (targetMembers.some(m => m.userId === userId)) return target;
    if (targetMembers.length >= 2) fail(409, "This space already has two partners.");

    const [existing] = await tx.select().from(membersTable).where(eq(membersTable.userId, userId));
    if (!existing) {
      await tx.insert(membersTable).values({ userId, coupleId: target.id });
      return target;
    }

    const soloMembers = await tx.select().from(membersTable).where(eq(membersTable.coupleId, existing.coupleId));
    if (soloMembers.length > 1) {
      fail(409, "You're already in a shared space with your partner. Couple Dates keeps one space per person.");
    }

    const [paid] = await tx.select().from(spaceSubscriptionsTable)
      .where(eq(spaceSubscriptionsTable.coupleId, existing.coupleId));
    if (paid) {
      fail(409, "Your current space still has a subscription attached, so it can't be left automatically. Stay there, or recover the original shared space instead.");
    }

    const abandonedId = existing.coupleId;
    // Keep the same membership row so account-recovery links (FK on user_id) survive.
    await tx.update(membersTable).set({ coupleId: target.id }).where(eq(membersTable.userId, userId));
    await tx.update(preferencesTable).set({ coupleId: target.id }).where(eq(preferencesTable.userId, userId));
    await tx.update(calendarConnectionsTable).set({ coupleId: target.id }).where(eq(calendarConnectionsTable.userId, userId));
    await cleanupAbandonedSoloSpace(tx, abandonedId);
    return target;
  });
}
