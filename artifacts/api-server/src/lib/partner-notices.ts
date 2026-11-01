import { eq } from "drizzle-orm";
import { db, membersTable, remindersTable } from "@workspace/db";

export const PARTNER_NOTICE_KINDS = ["proposal", "accepted", "countered", "declined"] as const;
export type PartnerNoticeKind = (typeof PARTNER_NOTICE_KINDS)[number];

export function isPartnerNoticeKind(kind: string): kind is PartnerNoticeKind {
  return (PARTNER_NOTICE_KINDS as readonly string[]).includes(kind);
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Deliver an in-app partner lifecycle notice to the other member of the space. */
export async function notifyPartner(
  tx: Tx,
  opts: { coupleId: number; fromUserId: string; dateId: number; kind: PartnerNoticeKind },
) {
  const members = await tx.select().from(membersTable).where(eq(membersTable.coupleId, opts.coupleId));
  const partner = members.find((m) => m.userId !== opts.fromUserId);
  if (!partner) return;
  await tx.insert(remindersTable).values({
    dateId: opts.dateId,
    userId: partner.userId,
    kind: opts.kind,
    dueAt: new Date(),
    dismissed: false,
  }).onConflictDoUpdate({
    target: [remindersTable.dateId, remindersTable.userId, remindersTable.kind],
    set: { dueAt: new Date(), dismissed: false },
  });
}

export function partnerNoticeCopy(kind: PartnerNoticeKind): string {
  switch (kind) {
    case "proposal": return "Your partner proposed a date";
    case "accepted": return "Your partner said yes";
    case "countered": return "Your partner suggested another time";
    case "declined": return "Your partner declined a proposal";
  }
}

/** Partner lifecycle notices stay in the inbox for two weeks unless dismissed. */
export const PARTNER_NOTICE_TTL_MS = 14 * 24 * 3600_000;
