import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db, couplesTable, membersTable, memoriesTable, datesTable, checkInsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { effectiveMemberId } from "./account-identity";

export { fail, validateDay } from "./validation";

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const id = getAuth(req).userId;
  if (!id) { res.status(401).json({ error: "Please sign in to your private space." }); return; }
  res.locals.clerkUserId = id;
  res.locals.userId = await effectiveMemberId(id);
  res.setHeader("Cache-Control", "no-store");
  next();
}

export async function findCouple(userId: string) {
  const [row] = await db.select({ couple: couplesTable }).from(membersTable)
    .innerJoin(couplesTable, eq(membersTable.coupleId, couplesTable.id)).where(eq(membersTable.userId, userId));
  return row?.couple ?? null;
}

export async function requireCouple(_req: Request, res: Response, next: NextFunction) {
  const couple = await findCouple(res.locals.userId);
  if (!couple) { res.status(409).json({ error: "Create or join your couple space first." }); return; }
  res.locals.couple = couple;
  next();
}

export type CoupleRow = typeof couplesTable.$inferSelect;

export async function coupleResponse(couple: CoupleRow) {
  const members = await db.select().from(membersTable).where(eq(membersTable.coupleId, couple.id));
  return { ...couple, memberCount: members.length };
}

export function dayInZone(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const p = (type: string) => parts.find(x => x.type === type)!.value;
  return `${p("year")}-${p("month")}-${p("day")}`;
}
export function ordinal(day: string) { return Math.floor(Date.parse(`${day}T12:00:00Z`) / 86400000); }
export function offsetDay(day: string, offset: number) { return new Date((ordinal(day) + offset) * 86400000).toISOString().slice(0, 10); }
export function longestRun(days: string[]) {
  const unique = [...new Set(days)].sort();
  let longest = 0, current = 0, previous = -Infinity;
  for (const d of unique) {
    const n = ordinal(d);
    current = n === previous + 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = n;
  }
  return longest;
}
export async function records(coupleId: number) {
  const [memories, dates, checkIns] = await Promise.all([
    db.select().from(memoriesTable).where(eq(memoriesTable.coupleId, coupleId)),
    db.select().from(datesTable).where(eq(datesTable.coupleId, coupleId)),
    db.select().from(checkInsTable).where(eq(checkInsTable.coupleId, coupleId)),
  ]);
  return { memories, dates, checkIns };
}
export async function summary(couple: CoupleRow) {
  const { memories, dates, checkIns } = await records(couple.id);
  const today = dayInZone(couple.timezone);
  const days = new Set(checkIns.map(x => x.date));
  let cursor = days.has(today) ? today : offsetDay(today, -1);
  let currentStreak = 0;
  while (days.has(cursor)) { currentStreak++; cursor = offsetDay(cursor, -1); }
  return {
    daysTogether: Math.max(0, ordinal(today) - ordinal(couple.anniversary)),
    memoryCount: memories.length,
    completedDates: dates.filter(x => x.status === "completed").length,
    currentStreak,
    longestStreak: longestRun([...days]),
    checkedInToday: days.has(today),
    weekDays: Array.from({ length: 7 }, (_, i) => {
      const date = offsetDay(today, i - 6); return { date, checked: days.has(date) };
    }),
  };
}
