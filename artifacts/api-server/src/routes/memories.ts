import { Router, type IRouter } from "express";
import { db, memoriesTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import {
  CreateMemoryBody, CreateMemoryResponse, UpdateMemoryBody, UpdateMemoryParams,
  UpdateMemoryResponse, DeleteMemoryParams, ListMemoriesResponse,
} from "@workspace/api-zod";
import { requireUser, requireCouple, validateDay, fail } from "../lib/couple";
import { ownedPhoto } from "../lib/uploads";

const router: IRouter = Router();
router.use("/memories", requireUser, requireCouple);
router.get("/memories", async (_req, res): Promise<void> => {
  const rows = await db.select().from(memoriesTable).where(eq(memoriesTable.coupleId, res.locals.couple.id)).orderBy(desc(memoriesTable.date), desc(memoriesTable.id));
  res.json(ListMemoriesResponse.parse(rows.map(x => ({ ...x, createdAt: x.createdAt.toISOString() }))));
});
router.post("/memories", async (req, res): Promise<void> => {
  const data = CreateMemoryBody.parse(req.body);
  validateDay(data.date);
  if (!data.title.trim()) fail(400, "Give this memory a title.");
  if (data.photoPath) await ownedPhoto(data.photoPath, res.locals.couple.id);
  const [row] = await db.insert(memoriesTable).values({ ...data, coupleId: res.locals.couple.id }).returning();
  res.status(201).json(CreateMemoryResponse.parse({ ...row, createdAt: row!.createdAt.toISOString() }));
});
router.patch("/memories/:id", async (req, res): Promise<void> => {
  const { id } = UpdateMemoryParams.parse(req.params);
  const data = UpdateMemoryBody.parse(req.body);
  validateDay(data.date);
  if (!data.title.trim()) fail(400, "Give this memory a title.");
  if (data.photoPath) await ownedPhoto(data.photoPath, res.locals.couple.id);
  const [row] = await db.update(memoriesTable).set(data)
    .where(and(eq(memoriesTable.id, id), eq(memoriesTable.coupleId, res.locals.couple.id))).returning();
  if (!row) fail(404, "Memory not found.");
  res.json(UpdateMemoryResponse.parse({ ...row, createdAt: row.createdAt.toISOString() }));
});
router.delete("/memories/:id", async (req, res): Promise<void> => {
  const { id } = DeleteMemoryParams.parse(req.params);
  const [row] = await db.delete(memoriesTable).where(and(eq(memoriesTable.id, id), eq(memoriesTable.coupleId, res.locals.couple.id))).returning();
  if (!row) fail(404, "Memory not found.");
  res.sendStatus(204);
});
export default router;
