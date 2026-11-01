import { Router, type IRouter } from "express";
import { db, datesTable, membersTable, remindersTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import {
  CreateDateBody, CreateDateResponse, UpdateDateBody, UpdateDateParams,
  UpdateDateResponse, DeleteDateParams, ListDatesResponse,
} from "@workspace/api-zod";
import { requireUser, requireCouple, validateDay, fail } from "../lib/couple";
import { dateResponse } from "../lib/date-details";
import { validateTime, validateMeeting } from "../lib/date-state";
import { validTimezone, zonedInstant } from "../lib/calendar-time";
import { notifyPartner } from "../lib/partner-notices";

const router: IRouter = Router();
router.use("/dates", requireUser, requireCouple);
function validate(data: { date: string; time?: string; title: string; status: string; rating?: number | null }) {
  validateDay(data.date);
  if (!data.title.trim()) fail(400, "Give your date a title.");
  validateTime(data.time);
}
router.get("/dates", async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const rows = await db.select().from(datesTable).where(eq(datesTable.coupleId, res.locals.couple.id)).orderBy(desc(datesTable.date), desc(datesTable.id));
  // Saved ideas stay private to the person who wrote them until they propose.
  const visible = rows.filter(r => r.status !== "idea" || r.proposedBy === userId);
  res.json(ListDatesResponse.parse(visible.map(r => dateResponse(r, userId))));
});
router.post("/dates", async (req, res): Promise<void> => {
  const data = CreateDateBody.parse(req.body);
  validate(data);
  validateMeeting(data);
  const timezone = validTimezone(data.timezone || res.locals.couple.timezone);
  if (data.time) zonedInstant(data.date, data.time, timezone);
  const { expectedVersion: _v, ...input } = data;
  const members = await db.select().from(membersTable).where(eq(membersTable.coupleId, res.locals.couple.id));
  const status = members.length < 2 ? "idea" : "proposed";
  const row = await db.transaction(async tx => {
    const [created] = await tx.insert(datesTable).values({
      ...input, timezone, mode: data.mode ?? "in_person", rating: null, status,
      proposedBy: res.locals.userId, coupleId: res.locals.couple.id,
    }).returning();
    if (status === "proposed") {
      await notifyPartner(tx, {
        coupleId: res.locals.couple.id, fromUserId: res.locals.userId, dateId: created!.id, kind: "proposal",
      });
    }
    return created!;
  });
  res.status(201).json(CreateDateResponse.parse(dateResponse(row, res.locals.userId)));
});
router.patch("/dates/:id", async (req, res): Promise<void> => {
  const { id } = UpdateDateParams.parse(req.params);
  const data = UpdateDateBody.parse(req.body);
  validate(data);
  validateMeeting(data);
  const row = await db.transaction(async tx => {
    const [current] = await tx.select().from(datesTable)
      .where(and(eq(datesTable.id, id), eq(datesTable.coupleId, res.locals.couple.id))).for("update");
    if (!current) fail(404, "Date not found.");
    const timezone = validTimezone(data.timezone || current.timezone || res.locals.couple.timezone);
    if (data.time) zonedInstant(data.date, data.time, timezone);
    if (data.expectedVersion !== current.version) fail(409, "This date changed. Refresh it before saving.");
    if (["active", "completed"].includes(current.status)) fail(409, "An active or completed date cannot be replanned.");
    if (current.status === "idea") {
      if (current.proposedBy !== res.locals.userId) fail(403, "Only the person who saved this idea can edit it.");
      if (data.status !== "idea") fail(400, "Use Propose to send this idea to your partner.");
    } else if (data.status !== current.status && !(current.status === "declined" && data.status === "proposed")) {
      fail(400, "Use the date response actions to change its status.");
    }
    const members = await tx.select().from(membersTable).where(eq(membersTable.coupleId, res.locals.couple.id));
    const nextStatus = current.status === "idea" ? "idea" : (members.length < 2 ? "idea" : "proposed");
    const { expectedVersion: _v, ...input } = data;
    await tx.delete(remindersTable).where(eq(remindersTable.dateId, id));
    const [updated] = await tx.update(datesTable).set({
      ...input, timezone, rating: null, status: nextStatus, proposedBy: res.locals.userId,
      version: current.version + 1, responseNote: "",
    }).where(eq(datesTable.id, id)).returning();
    if (nextStatus === "proposed") {
      await notifyPartner(tx, {
        coupleId: res.locals.couple.id, fromUserId: res.locals.userId, dateId: id, kind: "proposal",
      });
    }
    return updated!;
  });
  res.json(UpdateDateResponse.parse(dateResponse(row, res.locals.userId)));
});
router.delete("/dates/:id", async (req, res): Promise<void> => {
  const { id } = DeleteDateParams.parse(req.params);
  const [row] = await db.delete(datesTable).where(and(eq(datesTable.id, id), eq(datesTable.coupleId, res.locals.couple.id))).returning();
  if (!row) fail(404, "Date not found.");
  res.sendStatus(204);
});
export default router;
