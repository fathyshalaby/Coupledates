import { Router, type IRouter } from "express";
import { createHash } from "node:crypto";
import { db, datesTable, calendarConnectionsTable, calendarCopiesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import {
  GetDateCalendarParams, GetDateCalendarResponse, SaveDateToCalendarParams, SaveDateToCalendarResponse,
  RemoveDateFromCalendarParams, ExportDateCalendarParams,
} from "@workspace/api-zod";
import { requireUser, requireCouple, fail } from "../lib/couple";
import { agreed, calendarIcs, eventPayload, planSnapshot } from "../lib/calendar-time";
import { googleCalendarRequest } from "../lib/google-calendar";

const router: IRouter = Router();
router.use("/dates", requireUser, requireCouple);
const copyNotice = "A saved copy, not automatic sync. Update or remove your copy here after changing the plan. Downloaded .ics files are also one-time copies.";
const eventPath = (id: string) => `calendars/primary/events/${encodeURIComponent(id)}`;
async function ownDate(id: number, coupleId: number) {
  const [date] = await db.select().from(datesTable).where(and(eq(datesTable.id, id), eq(datesTable.coupleId, coupleId)));
  if (!date) fail(404, "Date not found.");
  return date;
}
router.get("/dates/:id/calendar", async (req, res): Promise<void> => {
  const { id } = GetDateCalendarParams.parse(req.params);
  const date = await ownDate(id, res.locals.couple.id);
  const [copy] = await db.select().from(calendarCopiesTable)
    .where(and(eq(calendarCopiesTable.dateId, id), eq(calendarCopiesTable.userId, res.locals.userId)));
  res.json(GetDateCalendarResponse.parse({
    saved: !!copy,
    stale: !!copy && (!agreed(date) || copy.snapshotHash !== planSnapshot({ ...date, timezone: date.timezone || res.locals.couple.timezone })),
    eventUrl: copy?.eventUrl ?? null, notice: copyNotice,
  }));
});
router.get("/dates/:id/calendar.ics", async (req, res): Promise<void> => {
  const { id } = ExportDateCalendarParams.parse(req.params);
  const date = await ownDate(id, res.locals.couple.id);
  if (!agreed(date)) fail(409, "Both partners need to agree before adding this date to a calendar.");
  const text = calendarIcs({ ...date, timezone: date.timezone || res.locals.couple.timezone });
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="couple-date-${id}.ics"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(text);
});
router.post("/dates/:id/calendar", async (req, res): Promise<void> => {
  const { id } = SaveDateToCalendarParams.parse(req.params);
  const userId: string = res.locals.userId;
  const result = await db.transaction(async tx => {
    // Serializes duplicate clicks and prevents calendar writes racing approval/edits/deletion.
    const [date] = await tx.select().from(datesTable)
      .where(and(eq(datesTable.id, id), eq(datesTable.coupleId, res.locals.couple.id))).for("update");
    if (!date) fail(404, "Date not found.");
    if (!agreed(date)) fail(409, "Both partners need to agree before adding this date to a calendar.");
    const [connection] = await tx.select().from(calendarConnectionsTable).where(eq(calendarConnectionsTable.userId, userId));
    if (!connection?.enabled || connection.needsConsent) fail(409, "Connect or reconnect your Google Calendar first.");
    const plan = { ...date, timezone: date.timezone || res.locals.couple.timezone };
    const key = createHash("sha256").update(`${userId}:${res.locals.couple.id}:${id}`).digest("hex");
    const [copy] = await tx.select().from(calendarCopiesTable)
      .where(and(eq(calendarCopiesTable.userId, userId), eq(calendarCopiesTable.dateId, id)));
    const eventId = copy?.eventId || `cd${key}`;
    const payload = { ...eventPayload(plan), status: "confirmed", extendedProperties: { private: { coupleDatesKey: key } } };
    let response = await googleCalendarRequest(userId, "calendars/primary/events?sendUpdates=none", {
      method: "POST", body: { id: eventId, ...payload },
    }, [409]);
    if (response.status === 409) {
      // Only ever update an event that this app created for this exact signed-in user/date.
      const existing = await googleCalendarRequest(userId, eventPath(eventId));
      const known = await existing.json() as { extendedProperties?: { private?: { coupleDatesKey?: string } } };
      if (known.extendedProperties?.private?.coupleDatesKey !== key) fail(409, "Google couldn't verify this saved calendar copy. No existing event was changed.");
      response = await googleCalendarRequest(userId, `${eventPath(eventId)}?sendUpdates=none`, { method: "PATCH", body: payload });
    }
    const event = await response.json() as { htmlLink?: string };
    let eventUrl: string | null = null;
    try {
      const url = new URL(event.htmlLink || "");
      if (url.protocol === "https:" && ["www.google.com", "calendar.google.com"].includes(url.hostname)) eventUrl = url.toString();
    } catch { /* Calendar writes can succeed without a browser link. */ }
    await tx.insert(calendarCopiesTable).values({
      userId, dateId: id, eventId, eventUrl, snapshotHash: planSnapshot(plan),
    }).onConflictDoUpdate({
      target: [calendarCopiesTable.userId, calendarCopiesTable.dateId],
      set: { eventId, eventUrl, snapshotHash: planSnapshot(plan), savedAt: new Date() },
    });
    return { saved: true, stale: false, eventUrl, notice: copyNotice };
  });
  res.json(SaveDateToCalendarResponse.parse(result));
});
router.delete("/dates/:id/calendar", async (req, res): Promise<void> => {
  const { id } = RemoveDateFromCalendarParams.parse(req.params);
  await db.transaction(async tx => {
    const [date] = await tx.select().from(datesTable)
      .where(and(eq(datesTable.id, id), eq(datesTable.coupleId, res.locals.couple.id))).for("update");
    if (!date) fail(404, "Date not found.");
    const [copy] = await tx.select().from(calendarCopiesTable)
      .where(and(eq(calendarCopiesTable.dateId, id), eq(calendarCopiesTable.userId, res.locals.userId)));
    if (!copy) return;
    const [connection] = await tx.select().from(calendarConnectionsTable).where(eq(calendarConnectionsTable.userId, res.locals.userId));
    if (!connection?.enabled) fail(409, "Reconnect your Google Calendar to remove this copy, or remove it directly in Google.");
    await googleCalendarRequest(res.locals.userId, `${eventPath(copy.eventId)}?sendUpdates=none`, { method: "DELETE" }, [404, 410]);
    await tx.delete(calendarCopiesTable).where(eq(calendarCopiesTable.id, copy.id));
  });
  res.sendStatus(204);
});
export default router;
