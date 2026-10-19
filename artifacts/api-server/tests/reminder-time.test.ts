import test from "node:test";
import assert from "node:assert/strict";
import { reminderSchedule } from "../src/lib/reminder-time";

const plan = {
  date: "2026-10-25", time: "19:00", timezone: "Europe/London",
  durationMinutes: 90, status: "planned",
};
const prefs = { timezone: "America/New_York", leadMinutes: 60, dateEnabled: true, photoEnabled: true };

test("both reminder types are opt-in", () => {
  assert.deepEqual(reminderSchedule(plan, { ...prefs, dateEnabled: false, photoEnabled: false }, "UTC"), []);
  assert.deepEqual(reminderSchedule(plan, { ...prefs, dateEnabled: false }, "UTC").map(r => r.kind), ["photo"]);
  assert.deepEqual(reminderSchedule(plan, { ...prefs, photoEnabled: false }, "UTC").map(r => r.kind), ["date"]);
});
test("partners in different zones share the same agreed instant for timed plans", () => {
  const us = reminderSchedule(plan, prefs, "UTC");
  const jp = reminderSchedule(plan, { ...prefs, timezone: "Asia/Tokyo" }, "UTC");
  assert.equal(us[0].dueAt.toISOString(), "2026-10-25T18:00:00.000Z");
  assert.deepEqual(us, jp);
  assert.equal(us[1].dueAt.toISOString(), "2026-10-25T21:30:00.000Z");
});
test("lead times are personal and calculated across midnight", () => {
  const rows = reminderSchedule(plan, { ...prefs, leadMinutes: 1440 }, "UTC");
  assert.equal(rows[0].dueAt.toISOString(), "2026-10-24T19:00:00.000Z");
});
test("untimed dates use each person's local morning, including DST changes", () => {
  const untimed = { ...plan, date: "2026-10-31", time: "" };
  const us = reminderSchedule(untimed, prefs, "UTC");
  assert.equal(us[0].dueAt.toISOString(), "2026-10-31T12:00:00.000Z");
  assert.equal(us[1].dueAt.toISOString(), "2026-11-01T14:00:00.000Z");
  const jp = reminderSchedule(untimed, { ...prefs, timezone: "Asia/Tokyo" }, "UTC");
  assert.equal(jp[0].dueAt.toISOString(), "2026-10-30T23:00:00.000Z");
  assert.equal(jp[1].dueAt.toISOString(), "2026-11-01T00:00:00.000Z");
});
test("proposed, countered, declined plans do not schedule reminders", () => {
  for (const status of ["proposed", "countered", "declined"]) {
    assert.deepEqual(reminderSchedule({ ...plan, status }, prefs, "UTC"), []);
  }
});
test("starting or completing a date revokes pre-date reminders, but retains the album nudge", () => {
  for (const status of ["active", "completed"]) {
    assert.deepEqual(reminderSchedule({ ...plan, status }, prefs, "UTC").map(r => r.kind), ["photo"]);
  }
});
test("legacy dates fall back to the couple timezone, never the viewer zone", () => {
  assert.equal(reminderSchedule({ ...plan, timezone: "" }, prefs, "Europe/London")[0].dueAt.toISOString(), "2026-10-25T18:00:00.000Z");
});
test("ambiguous and missing DST times fail instead of silently shifting", () => {
  assert.throws(() => reminderSchedule({ ...plan, time: "01:30" }, prefs, "UTC"), /daylight-saving/);
  assert.throws(() => reminderSchedule({ ...plan, date: "2026-03-29", time: "01:30" }, prefs, "UTC"), /daylight-saving/);
});
test("stale date reminders expire at the date start; photos after 48 hours", () => {
  const rows = reminderSchedule(plan, prefs, "UTC");
  assert.equal(new Date(rows[0].expiresAt).toISOString(), "2026-10-25T19:00:00.000Z");
  assert.equal(rows[1].expiresAt - rows[1].dueAt.getTime(), 48 * 3600_000);
});
