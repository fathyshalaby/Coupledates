import { Router, type IRouter } from "express";
import { db, datesTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import {
  CreateDateBody, CreateDateResponse, UpdateDateBody, UpdateDateParams,
  UpdateDateResponse, DeleteDateParams, ListDatesResponse,
} from "@workspace/api-zod";
import { requireUser, requireCouple, validateDay, fail } from "../lib/couple";
import { dateResponse } from "../lib/date-details";
import { validateTime, validateMeeting } from "../lib/date-state";
const router: IRouter = Router();
router.use("/dates", requireUser, requireCouple);
function validate(data: { date: string; time?: string; title: string; status: string; rating?: number | null }) {
  validateDay(data.date);
  if (!data.title.trim()) fail(400, "Give your date a title.");
  validateTime(data.time);
}
router.get("/dates", async (_req, res): Promise<void> => {
  const rows = await db.select().from(datesTable).where(eq(datesTable.coupleId, res.locals.couple.id)).orderBy(desc(datesTable.date), desc(datesTable.id));
  res.json(ListDatesResponse.parse(rows.map(r => dateResponse(r, res.locals.userId))));
});
router.post("/dates", async (req, res): Promise<void> => {
  const data = CreateDateBody.parse(req.body);
  validate(data);
  validateMeeting(data);
  const { expectedVersion: _v, ...input } = data;
  const [row] = await db.insert(datesTable).values({
    ...input, mode: data.mode ?? "in_person", rating: null, status: "proposed",
    proposedBy: res.locals.userId, coupleId: res.locals.couple.id,
  }).returning();
  res.status(201).json(CreateDateResponse.parse(dateResponse(row!, res.locals.userId)));
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
    if (data.expectedVersion !== current.version) fail(409, "This date changed. Refresh it before saving.");
    if (["active", "completed"].includes(current.status)) fail(409, "An active or completed date cannot be replanned.");
    if (data.status !== current.status) fail(400, "Use the date response actions to change its status.");
    const { expectedVersion: _v, ...input } = data;
    const [updated] = await tx.update(datesTable).set({
      ...input, rating: null, status: "proposed", proposedBy: res.locals.userId,
      version: current.version + 1, responseNote: "",
    }).where(eq(datesTable.id, id)).returning();
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
