import { Router, type IRouter } from "express";
import { and, eq, desc } from "drizzle-orm";
import { db, datesTable, reminderPreferencesTable, remindersTable } from "@workspace/db";
import {
  GetReminderPreferencesResponse, SaveReminderPreferencesBody, SaveReminderPreferencesResponse,
  ListRemindersResponse, DismissReminderParams,
} from "@workspace/api-zod";
import { requireUser, requireCouple, fail } from "../lib/couple";
import { validTimezone } from "../lib/calendar-time";
import { reminderSchedule } from "../lib/reminder-time";

const router: IRouter = Router();
router.use(["/reminders", "/reminder-preferences"], requireUser, requireCouple);
router.get("/reminder-preferences", async (_req, res): Promise<void> => {
  const [row] = await db.select().from(reminderPreferencesTable).where(eq(reminderPreferencesTable.userId, res.locals.userId));
  res.json(GetReminderPreferencesResponse.parse(row ?? {
    timezone: res.locals.couple.timezone, dateEnabled: false, photoEnabled: false, leadMinutes: 60,
  }));
});
router.put("/reminder-preferences", async (req, res): Promise<void> => {
  const data = SaveReminderPreferencesBody.parse(req.body);
  validTimezone(data.timezone);
  const [row] = await db.insert(reminderPreferencesTable).values({ ...data, userId: res.locals.userId })
    .onConflictDoUpdate({ target: reminderPreferencesTable.userId, set: data }).returning();
  res.json(SaveReminderPreferencesResponse.parse(row));
});

router.get("/reminders", async (_req, res): Promise<void> => {
  const userId = res.locals.userId;
  const now = Date.now();
  // Delivery happens on foreground polling, not via push or background location.
  // Lock plans before preferences so edits/counters cannot race stale deliveries.
  const result = await db.transaction(async tx => {
    const plans = await tx.select().from(datesTable).where(eq(datesTable.coupleId, res.locals.couple.id))
      .orderBy(datesTable.id).for("update");
    const [prefs] = await tx.select().from(reminderPreferencesTable).where(eq(reminderPreferencesTable.userId, userId)).for("update");
    if (!prefs) return [];
    const eligible = new Map<string, { plan: typeof plans[number]; dueAt: Date }>();
    for (const plan of plans) {
      for (const schedule of reminderSchedule(plan, prefs, res.locals.couple.timezone)) {
        if (schedule.dueAt.getTime() > now || schedule.expiresAt <= now) continue;
        eligible.set(`${plan.id}:${schedule.kind}`, { plan, dueAt: schedule.dueAt });
        await tx.insert(remindersTable).values({
          dateId: plan.id, userId, kind: schedule.kind, dueAt: schedule.dueAt,
        }).onConflictDoNothing();
      }
    }
    const rows = await tx.select().from(remindersTable)
      .where(and(eq(remindersTable.userId, userId), eq(remindersTable.dismissed, false))).orderBy(desc(remindersTable.dueAt));
    return rows.flatMap(row => {
      const current = eligible.get(`${row.dateId}:${row.kind}`);
      return current ? [{
        id: row.id, dateId: row.dateId, title: current.plan.title, kind: row.kind,
        dueAt: current.dueAt.toISOString(), timezone: prefs.timezone,
        href: `/dates/${row.dateId}${row.kind === "photo" ? "?album=1" : ""}`,
      }] : [];
    });
  });
  res.json(ListRemindersResponse.parse(result));
});
router.delete("/reminders/:id", async (req, res): Promise<void> => {
  const { id } = DismissReminderParams.parse(req.params);
  const [row] = await db.update(remindersTable).set({ dismissed: true })
    .where(and(eq(remindersTable.id, id), eq(remindersTable.userId, res.locals.userId))).returning();
  if (!row) fail(404, "Reminder not found.");
  res.sendStatus(204);
});
export default router;
