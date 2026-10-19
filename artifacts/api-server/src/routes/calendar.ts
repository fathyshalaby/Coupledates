import { Router, type IRouter } from "express";
import { db, calendarConnectionsTable, membersTable } from "@workspace/db";
import { and, eq, ne } from "drizzle-orm";
import {
  GetCalendarStatusResponse, ConnectCalendarBody, ConnectCalendarResponse,
  SaveCalendarPreferencesBody, SaveCalendarPreferencesResponse,
  GetCalendarAvailabilityQueryParams, GetCalendarAvailabilityResponse,
} from "@workspace/api-zod";
import { requireUser, requireCouple, dayInZone, ordinal, fail, validateDay } from "../lib/couple";
import { validTimezone, zonedInstant, sharedSlots } from "../lib/calendar-time";
import { primaryBusy } from "../lib/google-calendar";

const router: IRouter = Router();
router.use("/calendar", requireUser, requireCouple);
export async function calendarStatus(userId: string, coupleId: number) {
  const connections = await db.select().from(calendarConnectionsTable).where(eq(calendarConnectionsTable.coupleId, coupleId));
  const mine = connections.find(c => c.userId === userId);
  return {
    connected: !!mine?.enabled && !mine.needsConsent,
    needsConsent: !!mine?.enabled && mine.needsConsent,
    shareAvailability: !!mine?.enabled && mine.shareAvailability,
    partnerSharing: connections.some(c => c.userId !== userId && c.enabled && c.shareAvailability && !c.needsConsent),
  };
}
router.get("/calendar/status", async (_req, res): Promise<void> => {
  res.json(GetCalendarStatusResponse.parse(await calendarStatus(res.locals.userId, res.locals.couple.id)));
});
router.post("/calendar/connect", async (req, res): Promise<void> => {
  const data = ConnectCalendarBody.parse(req.body);
  // Verify actual Google permission before reporting a successful connection.
  await primaryBusy(res.locals.userId, new Date().toISOString(), new Date(Date.now() + 3600000).toISOString());
  await db.insert(calendarConnectionsTable).values({
    userId: res.locals.userId, coupleId: res.locals.couple.id, enabled: true, needsConsent: false, ...data,
  }).onConflictDoUpdate({ target: calendarConnectionsTable.userId, set: { ...data, enabled: true, needsConsent: false } });
  res.json(ConnectCalendarResponse.parse(await calendarStatus(res.locals.userId, res.locals.couple.id)));
});
router.put("/calendar/preferences", async (req, res): Promise<void> => {
  const data = SaveCalendarPreferencesBody.parse(req.body);
  const [row] = await db.update(calendarConnectionsTable).set(data)
    .where(and(eq(calendarConnectionsTable.userId, res.locals.userId), eq(calendarConnectionsTable.coupleId, res.locals.couple.id), eq(calendarConnectionsTable.enabled, true))).returning();
  if (!row) fail(409, "Connect your Google Calendar first.");
  res.json(SaveCalendarPreferencesResponse.parse(await calendarStatus(res.locals.userId, res.locals.couple.id)));
});
router.delete("/calendar/connection", async (_req, res): Promise<void> => {
  await db.update(calendarConnectionsTable).set({ enabled: false, shareAvailability: false, needsConsent: false })
    .where(and(eq(calendarConnectionsTable.userId, res.locals.userId), eq(calendarConnectionsTable.coupleId, res.locals.couple.id)));
  res.sendStatus(204);
});
router.get("/calendar/availability", async (req, res): Promise<void> => {
  const { date, timezone, durationMinutes } = GetCalendarAvailabilityQueryParams.parse(req.query);
  validateDay(date); validTimezone(timezone);
  const diff = ordinal(date) - ordinal(dayInZone(timezone));
  if (diff < 0 || diff > 90) fail(400, "Check a date from today through the next 90 days.");
  const base = { timezone, checkedAt: new Date().toISOString(), slots: [] as Array<{ start: string; end: string }> };
  const mine = await db.select().from(calendarConnectionsTable)
    .where(and(eq(calendarConnectionsTable.userId, res.locals.userId), eq(calendarConnectionsTable.coupleId, res.locals.couple.id)));
  if (!mine[0]?.enabled || !mine[0]?.shareAvailability || mine[0]?.needsConsent) {
    res.json(GetCalendarAvailabilityResponse.parse({ ...base, complete: false, notice: "Connect your calendar and opt in to availability sharing first." })); return;
  }
  const [partner] = await db.select({ userId: membersTable.userId, connection: calendarConnectionsTable })
    .from(membersTable).leftJoin(calendarConnectionsTable, eq(membersTable.userId, calendarConnectionsTable.userId))
    .where(and(eq(membersTable.coupleId, res.locals.couple.id), ne(membersTable.userId, res.locals.userId)));
  if (!partner?.connection?.enabled || !partner.connection.shareAvailability || partner.connection.needsConsent) {
    res.json(GetCalendarAvailabilityResponse.parse({ ...base, complete: false, notice: "Your partner also needs to connect Google Calendar and choose to share availability. No mutual free times have been confirmed yet." })); return;
  }
  const begin = zonedInstant(date, "09:00", timezone).toString();
  const end = zonedInstant(date, "22:00", timezone).toString();
  const results = await Promise.allSettled([primaryBusy(res.locals.userId, begin, end), primaryBusy(partner.userId, begin, end)]);
  if (results.some(r => r.status === "rejected")) {
    res.json(GetCalendarAvailabilityResponse.parse({ ...base, complete: false, notice: "At least one calendar couldn't be checked. Check both connections and try again. We haven't assumed either partner is free." })); return;
  }
  const busy = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
  const consent = await db.select().from(calendarConnectionsTable).where(eq(calendarConnectionsTable.coupleId, res.locals.couple.id));
  if (![res.locals.userId, partner.userId].every(id => consent.some(c => c.userId === id && c.enabled && c.shareAvailability && !c.needsConsent))) {
    res.json(GetCalendarAvailabilityResponse.parse({ ...base, complete: false, notice: "A partner turned off availability sharing while we checked. No shared free times are shown." })); return;
  }
  res.json(GetCalendarAvailabilityResponse.parse({
    ...base, complete: true, slots: sharedSlots(date, timezone, durationMinutes, busy),
    notice: "Free on both primary Google calendars at the time checked, between 09:00 and 22:00 in the selected time zone. Other calendars and unrecorded plans aren't checked; your partner still needs to agree.",
  }));
});
export default router;
