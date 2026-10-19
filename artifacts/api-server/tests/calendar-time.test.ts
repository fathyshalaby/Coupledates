import test from "node:test";
import assert from "node:assert/strict";
import { zonedInstant, sharedSlots, eventPayload, calendarIcs, planSnapshot, foldIcsLine, agreed } from "../src/lib/calendar-time";

const plan = {
  id: 42, title: "Online cook-along", date: "2026-10-20", time: "19:00", timezone: "Europe/Vienna",
  durationMinutes: 90, location: "Video call", notes: "Bring pasta", mode: "remote",
  meetingUrl: "https://example.com/private-room", status: "planned",
};
const badRequest = (fn: () => unknown) => assert.throws(fn, (e: unknown) => (e as { status?: number }).status === 400);

test("calendar times use the date's zone, including winter and summer offsets", () => {
  assert.equal(zonedInstant("2026-10-20", "19:00", "Europe/Vienna").toString(), "2026-10-20T17:00:00Z");
  assert.equal(zonedInstant("2026-12-20", "19:00", "Europe/Vienna").toString(), "2026-12-20T18:00:00Z");
  assert.equal(zonedInstant("2026-10-20", "19:00", "Europe/London").toString(), "2026-10-20T18:00:00Z");
});
test("DST missing and repeated local times require a different chosen time", () => {
  badRequest(() => zonedInstant("2026-03-29", "02:30", "Europe/Vienna"));
  badRequest(() => zonedInstant("2026-10-25", "02:30", "Europe/Vienna"));
  badRequest(() => zonedInstant("2026-10-20", "19:00", "Not/A_Zone"));
});
test("online event copies keep the call link and cross-midnight duration", () => {
  const result = eventPayload({ ...plan, time: "23:30", durationMinutes: 120 });
  assert.equal(result.start.dateTime, "2026-10-20T21:30:00Z");
  assert.equal(result.end.dateTime, "2026-10-20T23:30:00Z");
  assert.equal(result.location, plan.meetingUrl);
  assert.equal(result.visibility, "private");
});
test("dates without a chosen time export as exclusive-end all-day entries", () => {
  const result = eventPayload({ ...plan, date: "2026-12-31", time: "" });
  assert.deepEqual(result.start, { date: "2026-12-31" });
  assert.deepEqual(result.end, { date: "2027-01-01" });
});
test("free slots respect both partners' busy intervals and treat ends as exclusive", () => {
  const slots = sharedSlots(plan.date, plan.timezone, 60, [
    { start: "2026-10-20T07:00:00Z", end: "2026-10-20T08:00:00Z" },
    { start: "2026-10-20T08:30:00Z", end: "2026-10-20T09:00:00Z" },
  ], 0);
  assert.equal(slots[0].start, "2026-10-20T09:00:00.000Z");
  assert.equal(slots.at(-1)?.end, "2026-10-20T20:00:00.000Z");
  assert.ok(slots.every(s => Object.keys(s).sort().join(",") === "end,start"));
  assert.deepEqual(sharedSlots(plan.date, plan.timezone, 60, [
    { start: "2026-10-20T00:00:00Z", end: "2026-10-21T00:00:00Z" },
  ], 0), []);
  assert.throws(() => sharedSlots(plan.date, plan.timezone, 60, [{ start: "broken", end: "broken" }], 0),
    (e: unknown) => (e as { status?: number }).status === 502);
});
test("free slots never include times already passed", () => {
  const slots = sharedSlots(plan.date, plan.timezone, 60, [], Date.parse("2026-10-20T18:00:00Z"));
  assert.ok(slots.every(s => Date.parse(s.start) > Date.parse("2026-10-20T18:00:00Z")));
});
test("calendar snapshots change for plan edits, not lifecycle actions", () => {
  assert.equal(planSnapshot(plan), planSnapshot({ ...plan, status: "completed" }));
  assert.notEqual(planSnapshot(plan), planSnapshot({ ...plan, timezone: "Europe/London" }));
  assert.notEqual(planSnapshot(plan), planSnapshot({ ...plan, meetingUrl: "" }));
});
test("only agreed date lifecycle states permit calendar writes", () => {
  for (const status of ["planned", "active", "completed"]) assert.equal(agreed({ status }), true);
  for (const status of ["proposed", "declined"]) assert.equal(agreed({ status }), false);
});
test("ICS is CRLF delimited, escapes event injection, and folds unicode safely", () => {
  const text = calendarIcs({ ...plan, title: "Dinner,\nBEGIN:VEVENT;fake", notes: "❤️".repeat(100) }, new Date("2026-10-19T12:30:00Z"));
  assert.equal((text.match(/(?:^|\r\n)BEGIN:VEVENT\r\n/g) || []).length, 1);
  assert.ok(text.includes("SUMMARY:Dinner\\,\\nBEGIN:VEVENT\\;fake"));
  assert.ok(text.includes("DTSTART:20261020T170000Z"));
  assert.ok(text.includes("DTEND:20261020T183000Z"));
  assert.ok(text.includes("DTSTAMP:20261019T123000Z"));
  assert.ok(text.split("\r\n").every(l => Buffer.byteLength(l, "utf8") <= 75));
  assert.ok(!text.includes("�"));
  assert.equal(foldIcsLine("x".repeat(80)).replace(/\r\n /g, ""), "x".repeat(80));
});
