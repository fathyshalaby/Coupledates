import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { db, couplesTable, membersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { SaveCoupleBody, JoinCoupleBody, GetCoupleResponse, SaveCoupleResponse, JoinCoupleResponse } from "@workspace/api-zod";
import { requireUser, findCouple, coupleResponse, fail, validateDay, dayInZone } from "../lib/couple";

const router: IRouter = Router();
router.use("/couple", requireUser);
router.get("/couple", async (_req, res): Promise<void> => {
  const c = await findCouple(res.locals.userId);
  res.json(GetCoupleResponse.parse({ couple: c ? await coupleResponse(c) : null }));
});
router.post("/couple", async (req, res): Promise<void> => {
  const input = SaveCoupleBody.parse(req.body);
  if (!input.yourName.trim() || !input.partnerName.trim()) fail(400, "Both names are required.");
  validateDay(input.anniversary);
  try { new Intl.DateTimeFormat("en", { timeZone: input.timezone }); }
  catch { fail(400, "Choose a valid timezone."); }
  if (input.anniversary > dayInZone(input.timezone)) fail(400, "Your anniversary cannot be in the future.");
  const userId = res.locals.userId as string;
  const result = await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
    const [member] = await tx.select().from(membersTable).where(eq(membersTable.userId, userId));
    if (member) {
      const [c] = await tx.update(couplesTable).set(input).where(eq(couplesTable.id, member.coupleId)).returning();
      return c!;
    }
    const [c] = await tx.insert(couplesTable).values({ ...input, inviteCode: randomBytes(16).toString("hex") }).returning();
    await tx.insert(membersTable).values({ userId, coupleId: c!.id });
    return c!;
  });
  res.json(SaveCoupleResponse.parse(await coupleResponse(result)));
});
router.post("/couple/join", async (req, res): Promise<void> => {
  const { code } = JoinCoupleBody.parse(req.body);
  const userId = res.locals.userId as string;
  const result = await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
    const [member] = await tx.select().from(membersTable).where(eq(membersTable.userId, userId));
    if (member) fail(409, "You already belong to a couple space.");
    const [c] = await tx.select().from(couplesTable).where(eq(couplesTable.inviteCode, code.trim())).for("update");
    if (!c) fail(404, "That invite code wasn't found. Check with your partner.");
    const members = await tx.select().from(membersTable).where(eq(membersTable.coupleId, c.id));
    if (members.length >= 2) fail(409, "This space already has two partners.");
    await tx.insert(membersTable).values({ userId, coupleId: c.id });
    return c;
  });
  res.json(JoinCoupleResponse.parse(await coupleResponse(result)));
});
export default router;
