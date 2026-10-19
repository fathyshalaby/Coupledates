import { db, datesTable, memoriesTable, dateReviewsTable, preferencesTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { fail } from "./couple";

export function dateResponse(row: typeof datesTable.$inferSelect, userId: string) {
  return {
    ...row,
    isProposer: row.proposedBy === userId,
    canRespond: row.status === "proposed" && !!row.proposedBy && row.proposedBy !== userId,
    startedAt: row.startedAt?.toISOString() ?? null,
  };
}
export async function dateDetail(id: number, coupleId: number, userId: string) {
  const [row] = await db.select().from(datesTable)
    .where(and(eq(datesTable.id, id), eq(datesTable.coupleId, coupleId)));
  if (!row) fail(404, "Date not found.");
  const [memories, reviews] = await Promise.all([
    db.select().from(memoriesTable).where(and(eq(memoriesTable.dateId, id), eq(memoriesTable.coupleId, coupleId))).orderBy(desc(memoriesTable.id)),
    db.select({ review: dateReviewsTable, displayName: preferencesTable.displayName })
      .from(dateReviewsTable).leftJoin(preferencesTable, eq(dateReviewsTable.userId, preferencesTable.userId))
      .where(eq(dateReviewsTable.dateId, id)).orderBy(dateReviewsTable.id),
  ]);
  return {
    date: dateResponse(row!, userId),
    memories: memories.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })),
    reviews: reviews.map(({ review: r, displayName }) => ({
      id: r.id, rating: r.rating, note: r.note, isYou: r.userId === userId,
      displayName: displayName || (r.userId === userId ? "You" : "Your partner"),
    })),
  };
}
