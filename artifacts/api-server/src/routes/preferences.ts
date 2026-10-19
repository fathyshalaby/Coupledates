import { Router, type IRouter } from "express";
import { db, preferencesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetPreferencesResponse, SavePreferencesBody, SavePreferencesResponse } from "@workspace/api-zod";
import { requireUser, requireCouple, fail } from "../lib/couple";

const router: IRouter = Router();
router.use("/preferences", requireUser, requireCouple);
router.get("/preferences", async (_req, res): Promise<void> => {
  const rows = await db.select().from(preferencesTable).where(eq(preferencesTable.coupleId, res.locals.couple.id));
  res.json(GetPreferencesResponse.parse(rows.map(r => ({ ...r, isYou: r.userId === res.locals.userId }))));
});
router.put("/preferences", async (req, res): Promise<void> => {
  const data = SavePreferencesBody.parse(req.body);
  if (!data.displayName.trim()) fail(400, "Tell us what to call you.");
  if (data.interests.some(x => !x.trim())) fail(400, "Interests cannot be blank.");
  try { new Intl.DateTimeFormat("en", { timeZone: data.timezone }); } catch { fail(400, "Choose a valid timezone."); }
  const [row] = await db.insert(preferencesTable)
    .values({ ...data, coupleId: res.locals.couple.id, userId: res.locals.userId })
    .onConflictDoUpdate({ target: preferencesTable.userId, set: data }).returning();
  res.json(SavePreferencesResponse.parse({ ...row, isYou: true }));
});
export default router;
