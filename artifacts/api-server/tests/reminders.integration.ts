// Explicitly run with `pnpm --filter @workspace/api-server run test:reminders-db`.
// Uses disposable synthetic members and cleans up; never touches existing spaces.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Temporal } from "@js-temporal/polyfill";
import { eq } from "drizzle-orm";
import { db, pool, couplesTable, membersTable, datesTable, reminderPreferencesTable, remindersTable } from "@workspace/db";
import remindersRouter from "../src/routes/reminders";
import datesRouter from "../src/routes/dates";
import actionsRouter from "../src/routes/date-actions";

async function main() {
  const a = `reminder-test-${randomUUID()}`, b = `reminder-test-${randomUUID()}`, outsider = `reminder-test-${randomUUID()}`;
  const [couple] = await db.insert(couplesTable).values({
    yourName: "Test A", partnerName: "Test B", anniversary: "2020-01-01", timezone: "UTC", inviteCode: randomUUID(),
  }).returning();
  const [other] = await db.insert(couplesTable).values({
    yourName: "Test C", partnerName: "Test D", anniversary: "2020-01-01", timezone: "UTC", inviteCode: randomUUID(),
  }).returning();
  const call = async (router: any, method: string, path: string, userId = a, body = {}, params = {}) => {
    const layer = router.stack.find((s: any) => s.route?.path === path && s.route.methods[method]);
    assert.ok(layer, `${method} ${path} is registered`);
    const result: { status: number; body?: any } = { status: 200 };
    const res = {
      locals: { userId, couple: userId === outsider ? other : couple },
      json(value: any) { result.body = value; },
      status(value: number) { result.status = value; return res; },
      sendStatus(value: number) { result.status = value; },
    };
    await layer.route.stack.at(-1).handle({ body, params }, res);
    return result;
  };
  try {
    await db.insert(membersTable).values([{ userId: a, coupleId: couple.id }, { userId: b, coupleId: couple.id }, { userId: outsider, coupleId: other.id }]);
    const when = Temporal.Now.instant().add({ minutes: 30 }).toZonedDateTimeISO("UTC");
    const [date] = await db.insert(datesTable).values({
      coupleId: couple.id, proposedBy: a, title: "Synthetic reminder test", date: when.toPlainDate().toString(),
      time: `${String(when.hour).padStart(2, "0")}:${String(when.minute).padStart(2, "0")}`,
      timezone: "UTC", durationMinutes: 90, location: "", category: "Everyday", notes: "", status: "planned",
    }).returning();
    const preferences = { timezone: "UTC", dateEnabled: true, photoEnabled: true, leadMinutes: 60 };
    assert.equal((await call(remindersRouter, "get", "/reminder-preferences")).body.dateEnabled, false);
    assert.deepEqual((await call(remindersRouter, "get", "/reminders")).body, []);
    await call(remindersRouter, "put", "/reminder-preferences", a, preferences);
    await call(remindersRouter, "put", "/reminder-preferences", b, { ...preferences, timezone: "Asia/Tokyo" });
    await call(remindersRouter, "put", "/reminder-preferences", outsider, preferences);
    const [first, second] = await Promise.all([call(remindersRouter, "get", "/reminders"), call(remindersRouter, "get", "/reminders")]);
    assert.equal(first.body.length, 1);
    assert.equal(first.body[0].id, second.body[0].id, "concurrent polling creates one delivery");
    const mine = first.body[0];
    const theirs = (await call(remindersRouter, "get", "/reminders", b)).body[0];
    assert.notEqual(mine.id, theirs.id);
    assert.equal(theirs.timezone, "Asia/Tokyo");
    assert.deepEqual((await call(remindersRouter, "get", "/reminders", outsider)).body, []);
    await assert.rejects(call(remindersRouter, "delete", "/reminders/:id", b, {}, { id: mine.id }), /not found/);
    await call(remindersRouter, "delete", "/reminders/:id", a, {}, { id: mine.id });
    assert.deepEqual((await call(remindersRouter, "get", "/reminders")).body, [], "dismissal survives another poll");
    assert.equal((await call(remindersRouter, "get", "/reminders", b)).body.length, 1, "dismissal is per person");
    await call(remindersRouter, "put", "/reminder-preferences", b, { ...preferences, dateEnabled: false });
    assert.deepEqual((await call(remindersRouter, "get", "/reminders", b)).body, []);
    await call(remindersRouter, "put", "/reminder-preferences", b, preferences);

    const input = { ...date, expectedVersion: date.version };
    await call(datesRouter, "patch", "/dates/:id", a, input, { id: date.id });
    assert.equal((await db.select().from(remindersTable).where(eq(remindersTable.dateId, date.id))).length, 0, "editing revokes both partners' deliveries");
    assert.deepEqual((await call(remindersRouter, "get", "/reminders", b)).body, [], "edited plan must be agreed again");
    await call(actionsRouter, "post", "/dates/:id/respond", b, { action: "accept", version: 1 }, { id: date.id });
    assert.equal((await call(remindersRouter, "get", "/reminders", b)).body.length, 1);
    await call(datesRouter, "patch", "/dates/:id", a, { ...input, expectedVersion: 2, status: "planned" }, { id: date.id });
    await call(actionsRouter, "post", "/dates/:id/respond", b, { action: "counter", version: 3, date: date.date, time: date.time, note: "Another time" }, { id: date.id });
    assert.deepEqual((await call(remindersRouter, "get", "/reminders")).body, []);
    await call(actionsRouter, "post", "/dates/:id/respond", a, { action: "decline", version: 4 }, { id: date.id });
    assert.deepEqual((await call(remindersRouter, "get", "/reminders", b)).body, []);

    const photoTime = Temporal.Now.instant().subtract({ hours: 3 }).toZonedDateTimeISO("UTC");
    await db.update(datesTable).set({
      date: photoTime.toPlainDate().toString(),
      time: `${String(photoTime.hour).padStart(2, "0")}:${String(photoTime.minute).padStart(2, "0")}`, status: "completed",
    }).where(eq(datesTable.id, date.id));
    const photo = (await call(remindersRouter, "get", "/reminders")).body[0];
    assert.equal(photo.kind, "photo");
    assert.equal(photo.href, `/dates/${date.id}?album=1`, "photo goes to the exact private date album");
    await call(datesRouter, "delete", "/dates/:id", a, {}, { id: date.id });
    assert.deepEqual((await call(remindersRouter, "get", "/reminders")).body, []);
    assert.equal((await db.select().from(remindersTable).where(eq(remindersTable.dateId, date.id))).length, 0, "deleting cascades the delivery ledger");
    process.stdout.write("Reminder database integration checks passed: opt-in, two partners, isolation, concurrent deduplication, dismissal, preferences, edit/reaccept/counter/decline/delete, album links.\n");
  } finally {
    await db.delete(datesTable).where(eq(datesTable.coupleId, couple.id));
    for (const userId of [a, b, outsider]) {
      await db.delete(remindersTable).where(eq(remindersTable.userId, userId));
      await db.delete(reminderPreferencesTable).where(eq(reminderPreferencesTable.userId, userId));
      await db.delete(membersTable).where(eq(membersTable.userId, userId));
    }
    await db.delete(couplesTable).where(eq(couplesTable.id, couple.id));
    await db.delete(couplesTable).where(eq(couplesTable.id, other.id));
    await pool.end();
  }
}
main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
