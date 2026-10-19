import { Router, type IRouter } from "express";
import { requirePlus } from "../lib/billing";
import { db, checkInsTable } from "@workspace/db";
import { CheckInBody, CheckInResponse, GetSummaryResponse, GetRecapQueryParams, GetRecapResponse } from "@workspace/api-zod";
import { requireUser, requireCouple, dayInZone, summary, records, longestRun } from "../lib/couple";

const router: IRouter = Router();
router.use(["/summary", "/check-ins", "/recap"], requireUser, requireCouple);
router.get("/summary", async (_req, res): Promise<void> => {
  res.json(GetSummaryResponse.parse(await summary(res.locals.couple)));
});
router.post("/check-ins", async (req, res): Promise<void> => {
  const { activity } = CheckInBody.parse(req.body);
  await db.insert(checkInsTable).values({ coupleId: res.locals.couple.id, date: dayInZone(res.locals.couple.timezone), activity }).onConflictDoNothing();
  res.json(CheckInResponse.parse(await summary(res.locals.couple)));
});
router.get("/recap", async (req, res): Promise<void> => {
  await requirePlus(res.locals.couple.id);
  const query = GetRecapQueryParams.parse(req.query);
  const year = query.year ?? Number(dayInZone(res.locals.couple.timezone).slice(0, 4));
  const all = await records(res.locals.couple.id);
  const inYear = (x: { date: string }) => Number(x.date.slice(0, 4)) === year;
  const memories = all.memories.filter(inYear);
  const dates = all.dates.filter(inYear).filter(d => d.status === "completed");
  const checks = all.checkIns.filter(inYear);
  const categories: Record<string, number> = {};
  for (const x of [...memories, ...dates]) categories[x.category] = (categories[x.category] ?? 0) + 1;
  const rated = dates.filter(d => d.rating != null);
  res.json(GetRecapResponse.parse({
    year, memoryCount: memories.length, dateCount: dates.length,
    averageRating: rated.length ? Math.round(rated.reduce((n, d) => n + d.rating!, 0) / rated.length * 10) / 10 : 0,
    topCategory: Object.entries(categories).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Your story is just beginning",
    topMemories: memories.sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.date.localeCompare(a.date)).slice(0, 5).map(m => ({ ...m, createdAt: m.createdAt.toISOString() })),
    longestStreak: longestRun(checks.map(x => x.date)),
    activeDays: new Set([...memories, ...dates, ...checks].map(x => x.date)).size,
    monthlyCounts: Array.from({ length: 12 }, (_, i) => [...memories, ...dates].filter(x => Number(x.date.slice(5, 7)) === i + 1).length),
  }));
});
export default router;
