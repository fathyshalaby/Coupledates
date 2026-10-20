import { accountLinksTable, db } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function effectiveMemberId(authUserId: string) {
  const [link] = await db.select().from(accountLinksTable).where(eq(accountLinksTable.authUserId, authUserId));
  return link?.active ? link.memberUserId : authUserId;
}
export async function calendarAuthUserId(memberUserId: string) {
  const [link] = await db.select().from(accountLinksTable).where(eq(accountLinksTable.memberUserId, memberUserId));
  return link?.authUserId ?? memberUserId;
}
