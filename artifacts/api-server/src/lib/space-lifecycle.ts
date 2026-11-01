import { randomBytes } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  couplesTable,
  membersTable,
  memoriesTable,
  datesTable,
  checkInsTable,
  uploadsTable,
  preferencesTable,
  assistantTurnsTable,
  aiUsageTable,
  calendarConnectionsTable,
  calendarCopiesTable,
  dateReviewsTable,
  reminderPreferencesTable,
  remindersTable,
  billingCheckoutsTable,
  spaceSubscriptionsTable,
} from "@workspace/db";
import { fail } from "./validation";
import { hasPaidAccess } from "./billing-policy";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function newInviteCode() {
  return randomBytes(16).toString("hex");
}

async function deleteSpaceContents(tx: Tx, coupleId: number, dateIds: number[]) {
  if (dateIds.length) {
    await tx.delete(remindersTable).where(inArray(remindersTable.dateId, dateIds));
    await tx.delete(dateReviewsTable).where(inArray(dateReviewsTable.dateId, dateIds));
    await tx.delete(calendarCopiesTable).where(inArray(calendarCopiesTable.dateId, dateIds));
  }
  await tx.delete(memoriesTable).where(eq(memoriesTable.coupleId, coupleId));
  await tx.delete(datesTable).where(eq(datesTable.coupleId, coupleId));
  await tx.delete(checkInsTable).where(eq(checkInsTable.coupleId, coupleId));
  await tx.delete(uploadsTable).where(eq(uploadsTable.coupleId, coupleId));
  await tx.delete(preferencesTable).where(eq(preferencesTable.coupleId, coupleId));
  await tx.delete(assistantTurnsTable).where(eq(assistantTurnsTable.coupleId, coupleId));
  await tx.delete(aiUsageTable).where(eq(aiUsageTable.coupleId, coupleId));
  await tx.delete(calendarConnectionsTable).where(eq(calendarConnectionsTable.coupleId, coupleId));
  await tx.delete(spaceSubscriptionsTable).where(eq(spaceSubscriptionsTable.coupleId, coupleId));
  await tx.delete(billingCheckoutsTable).where(eq(billingCheckoutsTable.coupleId, coupleId));
  await tx.delete(membersTable).where(eq(membersTable.coupleId, coupleId));
  await tx.delete(couplesTable).where(eq(couplesTable.id, coupleId));
}

/** Leave the couple space. Last member deletes the space; otherwise rotate the invite for the remaining partner. */
export async function leaveCoupleSpace(userId: string) {
  return db.transaction(async (tx) => {
    const [member] = await tx.select().from(membersTable).where(eq(membersTable.userId, userId)).for("update");
    if (!member) fail(409, "You are not in a couple space.");
    const coupleId = member.coupleId;
    const [couple] = await tx.select().from(couplesTable).where(eq(couplesTable.id, coupleId)).for("update");
    if (!couple) fail(404, "Couple space not found.");

    const [sub] = await tx.select().from(spaceSubscriptionsTable).where(eq(spaceSubscriptionsTable.coupleId, coupleId));
    if (sub && sub.payerUserId === userId && hasPaidAccess(sub)) {
      fail(409, "Cancel Couple Dates Plus for this space first, or wait until the paid period ends, before leaving as the billing owner.");
    }

    const members = await tx.select().from(membersTable).where(eq(membersTable.coupleId, coupleId));
    const dateIds = (await tx.select({ id: datesTable.id }).from(datesTable).where(eq(datesTable.coupleId, coupleId))).map((d) => d.id);

    // Personal reminder prefs / ledger rows for this user (membership FK cascades for prefs).
    await tx.delete(remindersTable).where(eq(remindersTable.userId, userId));
    await tx.delete(reminderPreferencesTable).where(eq(reminderPreferencesTable.userId, userId));
    await tx.delete(calendarConnectionsTable).where(and(
      eq(calendarConnectionsTable.userId, userId),
      eq(calendarConnectionsTable.coupleId, coupleId),
    ));
    await tx.delete(preferencesTable).where(eq(preferencesTable.userId, userId));

    if (members.length <= 1) {
      await deleteSpaceContents(tx, coupleId, dateIds);
      return null;
    }

    await tx.delete(membersTable).where(eq(membersTable.userId, userId));
    // Invalidate the old invite so a departed partner cannot rejoin with a leaked code.
    const [updated] = await tx.update(couplesTable)
      .set({ inviteCode: newInviteCode() })
      .where(eq(couplesTable.id, coupleId))
      .returning();
    return updated!;
  });
}

export async function rotateInvite(userId: string) {
  return db.transaction(async (tx) => {
    const [member] = await tx.select().from(membersTable).where(eq(membersTable.userId, userId)).for("update");
    if (!member) fail(409, "Create or join your couple space first.");
    const members = await tx.select().from(membersTable).where(eq(membersTable.coupleId, member.coupleId));
    if (members.length >= 2) fail(409, "This space already has two partners, so the invite code is not needed.");
    const [updated] = await tx.update(couplesTable)
      .set({ inviteCode: newInviteCode() })
      .where(eq(couplesTable.id, member.coupleId))
      .returning();
    if (!updated) fail(404, "Couple space not found.");
    return updated;
  });
}
