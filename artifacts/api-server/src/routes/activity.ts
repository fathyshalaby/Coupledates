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
  const averageRating = rated.length ? Math.round(rated.reduce((n, d) => n + d.rating!, 0) / rated.length * 10) / 10 : 0;
  const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const longestStreak = longestRun(checks.map(x => x.date));
  const activeDays = new Set([...memories, ...dates, ...checks].map(x => x.date)).size;
  const topRated = [...rated].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.date.localeCompare(a.date))[0] ?? null;
  const peakMonth = (() => {
    const counts = Array.from({ length: 12 }, (_, i) => [...memories, ...dates].filter(x => Number(x.date.slice(5, 7)) === i + 1).length);
    const peak = Math.max(0, ...counts);
    if (!peak) return null;
    return { index: counts.indexOf(peak), count: peak };
  })();
  const monthName = peakMonth
    ? new Date(year, peakMonth.index, 1).toLocaleString("en", { month: "long" })
    : null;
  const storyTitle = dates.length || memories.length
    ? (topRated ? `“${topRated.title}” still stands out` : longestStreak > 1 ? `${longestStreak} days in a row` : `${year}, kept`)
    : `${year} is waiting`;
  const storyBits = [
    dates.length ? `${dates.length} date${dates.length === 1 ? "" : "s"} you finished together` : null,
    memories.length ? `${memories.length} memor${memories.length === 1 ? "y" : "ies"} saved` : null,
    topCategory ? `leaning into ${topCategory}` : null,
    longestStreak > 1 ? `a ${longestStreak}-day check-in streak` : null,
    monthName && peakMonth ? `${monthName} as your busiest month` : null,
  ].filter((x): x is string => !!x);
  const storyBody = storyBits.length === 0
    ? "Your recap fills in from the dates, memories, and check-ins you two actually add."
    : storyBits.length === 1
      ? `A look back at ${storyBits[0]}.`
      : `A look back at ${storyBits.slice(0, -1).join(", ")}, and ${storyBits[storyBits.length - 1]}.`;
  res.json(GetRecapResponse.parse({
    year, memoryCount: memories.length, dateCount: dates.length,
    averageRating, topCategory,
    topMemories: memories.sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.date.localeCompare(a.date)).slice(0, 5).map(m => ({ ...m, createdAt: m.createdAt.toISOString() })),
    longestStreak, activeDays,
    monthlyCounts: Array.from({ length: 12 }, (_, i) => [...memories, ...dates].filter(x => Number(x.date.slice(5, 7)) === i + 1).length),
    storyTitle, storyBody, topRatedTitle: topRated?.title ?? null,
  }));
});
export default router;
