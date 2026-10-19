import { Router, type IRouter } from "express";
import { db, datesTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import {
  CreateDateBody, CreateDateResponse, UpdateDateBody, UpdateDateParams,
  UpdateDateResponse, DeleteDateParams, ListDatesResponse,
} from "@workspace/api-zod";
import { requireUser, requireCouple, validateDay, fail } from "../lib/couple";
const router: IRouter = Router();
router.use("/dates", requireUser, requireCouple);
function validate(data: { date: string; time?: string; title: string; status: string; rating?: number | null }) {
  validateDay(data.date);
  if (!data.title.trim()) fail(400, "Give your date a title.");
  if (data.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.time)) fail(400, "Choose a valid time.");
  if (data.status !== "completed" && data.rating != null) fail(400, "Complete the date before rating it.");
}
router.get("/dates", async (_req, res): Promise<void> => {
  const rows = await db.select().from(datesTable).where(eq(datesTable.coupleId, res.locals.couple.id)).orderBy(desc(datesTable.date), desc(datesTable.id));
  res.json(ListDatesResponse.parse(rows));
});
router.post("/dates", async (req, res): Promise<void> => {
  const data = CreateDateBody.parse(req.body);
  validate(data);
  const [row] = await db.insert(datesTable).values({ ...data, coupleId: res.locals.couple.id }).returning();
  res.status(201).json(CreateDateResponse.parse(row));
});
router.patch("/dates/:id", async (req, res): Promise<void> => {
  const { id } = UpdateDateParams.parse(req.params);
  const data = UpdateDateBody.parse(req.body);
  validate(data);
  const [row] = await db.update(datesTable).set({ ...data, rating: data.rating ?? null })
    .where(and(eq(datesTable.id, id), eq(datesTable.coupleId, res.locals.couple.id))).returning();
  if (!row) fail(404, "Date not found.");
  res.json(UpdateDateResponse.parse(row));
});
router.delete("/dates/:id", async (req, res): Promise<void> => {
  const { id } = DeleteDateParams.parse(req.params);
  const [row] = await db.delete(datesTable).where(and(eq(datesTable.id, id), eq(datesTable.coupleId, res.locals.couple.id))).returning();
  if (!row) fail(404, "Date not found.");
  res.sendStatus(204);
});
export default router;
