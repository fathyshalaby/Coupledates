import { Router, type IRouter } from "express";
import { db, datesTable, dateReviewsTable, membersTable, remindersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import {
  GetDateDetailParams, GetDateDetailResponse, RespondToDateParams, RespondToDateBody, RespondToDateResponse,
  ReviewDateParams, ReviewDateBody, ReviewDateResponse,
} from "@workspace/api-zod";
import { requireUser, requireCouple, fail } from "../lib/couple";
import { dateDetail, dateResponse } from "../lib/date-details";
import { nextDateState } from "../lib/date-state";
import { zonedInstant } from "../lib/calendar-time";
import { notifyPartner, type PartnerNoticeKind } from "../lib/partner-notices";

const router: IRouter = Router();
router.use("/dates", requireUser, requireCouple);
router.get("/dates/:id/detail", async (req, res): Promise<void> => {
  const { id } = GetDateDetailParams.parse(req.params);
  const detail = await dateDetail(id, res.locals.couple.id, res.locals.userId);
  if (detail.date.status === "idea" && !detail.date.isProposer) fail(404, "Date not found.");
  res.json(GetDateDetailResponse.parse(detail));
});
router.post("/dates/:id/respond", async (req, res): Promise<void> => {
  const { id } = RespondToDateParams.parse(req.params);
  const data = RespondToDateBody.parse(req.body);
  const row = await db.transaction(async tx => {
    const [current] = await tx.select().from(datesTable)
      .where(and(eq(datesTable.id, id), eq(datesTable.coupleId, res.locals.couple.id))).for("update");
    if (!current) fail(404, "Date not found.");
    const members = await tx.select().from(membersTable).where(eq(membersTable.coupleId, res.locals.couple.id));
    const status = nextDateState(current, res.locals.userId, data, members.length);
    if (data.action === "counter" || data.action === "decline" || data.action === "propose") {
      await tx.delete(remindersTable).where(eq(remindersTable.dateId, id));
    } else if (data.action === "accept") {
      // Clear the recipient's proposal notice once they've answered.
      await tx.update(remindersTable).set({ dismissed: true }).where(and(
        eq(remindersTable.dateId, id),
        eq(remindersTable.userId, res.locals.userId),
        eq(remindersTable.kind, "proposal"),
      ));
    }
    if (data.action === "counter" && data.time) zonedInstant(data.date!, data.time, current.timezone || res.locals.couple.timezone);
    const [updated] = await tx.update(datesTable).set({
      status, version: current.version + 1,
      responseNote: data.note ?? "",
      ...(data.action === "counter" ? {
        date: data.date!, time: data.time ?? "", proposedBy: res.locals.userId,
      } : {}),
      ...(data.action === "start" ? { startedAt: new Date() } : {}),
    }).where(eq(datesTable.id, id)).returning();

    const notice: PartnerNoticeKind | null =
      data.action === "propose" ? "proposal"
        : data.action === "accept" ? "accepted"
          : data.action === "decline" ? "declined"
            : data.action === "counter" ? "countered"
              : null;
    if (notice) {
      await notifyPartner(tx, {
        coupleId: res.locals.couple.id, fromUserId: res.locals.userId, dateId: id, kind: notice,
      });
    }
    return updated!;
  });
  res.json(RespondToDateResponse.parse(dateResponse(row, res.locals.userId)));
});
router.put("/dates/:id/review", async (req, res): Promise<void> => {
  const { id } = ReviewDateParams.parse(req.params);
  const data = ReviewDateBody.parse(req.body);
  await db.transaction(async tx => {
    const [row] = await tx.select().from(datesTable)
      .where(and(eq(datesTable.id, id), eq(datesTable.coupleId, res.locals.couple.id))).for("update");
    if (!row) fail(404, "Date not found.");
    if (row.status !== "completed") fail(409, "Complete the date before leaving your review.");
    await tx.insert(dateReviewsTable).values({ ...data, dateId: id, userId: res.locals.userId })
      .onConflictDoUpdate({ target: [dateReviewsTable.dateId, dateReviewsTable.userId], set: data });
    const ratings = await tx.select().from(dateReviewsTable).where(eq(dateReviewsTable.dateId, id));
    const rating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
    await tx.update(datesTable).set({ rating }).where(eq(datesTable.id, id));
  });
  res.json(ReviewDateResponse.parse(await dateDetail(id, res.locals.couple.id, res.locals.userId)));
});
export default router;
