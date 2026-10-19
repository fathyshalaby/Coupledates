import { Temporal } from "@js-temporal/polyfill";
import { createHash } from "node:crypto";
import { fail, validateDay } from "./validation";

export function validTimezone(zone: string) {
  try { new Intl.DateTimeFormat("en", { timeZone: zone }); }
  catch { fail(400, "Choose a valid IANA time zone, such as Europe/Vienna."); }
  return zone;
}
export function zonedInstant(day: string, time: string, zone: string) {
  validateDay(day); validTimezone(zone);
  try {
    return Temporal.PlainDateTime.from(`${day}T${time}`).toZonedDateTime(zone, { disambiguation: "reject" }).toInstant();
  } catch {
    fail(400, "That local time is missing or repeated during a daylight-saving change. Choose a different time.");
  }
}
export type CalendarPlan = {
  id: number; title: string; date: string; time: string; timezone: string; durationMinutes: number;
  location: string; notes: string; mode: string; meetingUrl: string; status: string;
};
export function agreed(plan: { status: string }) {
  return ["planned", "active", "completed"].includes(plan.status);
}
export function planSnapshot(plan: CalendarPlan) {
  return createHash("sha256").update(JSON.stringify([
    plan.title, plan.date, plan.time, plan.timezone, plan.durationMinutes,
    plan.location, plan.notes, plan.mode, plan.meetingUrl,
  ])).digest("hex");
}
export function eventPayload(plan: CalendarPlan) {
  const place = plan.mode === "remote" ? plan.meetingUrl || "Online date" : plan.location;
  let start: { date?: string; dateTime?: string }, end: { date?: string; dateTime?: string };
  if (plan.time) {
    const instant = zonedInstant(plan.date, plan.time, plan.timezone);
    start = { dateTime: instant.toString() };
    end = { dateTime: instant.add({ minutes: plan.durationMinutes }).toString() };
  } else {
    validateDay(plan.date);
    start = { date: plan.date };
    end = { date: Temporal.PlainDate.from(plan.date).add({ days: 1 }).toString() };
  }
  return {
    summary: plan.title, start, end, location: place, visibility: "private",
    description: [
      plan.mode === "remote" ? "Online date · Couple Dates" : "In-person date · Couple Dates",
      plan.notes, plan.mode === "remote" ? plan.meetingUrl : "",
      "A calendar copy. Changes in Couple Dates are not automatically synced.",
    ].filter(Boolean).join("\n\n"),
  };
}
export function sharedSlots(day: string, zone: string, durationMinutes: number, busy: Array<{ start: string; end: string }>, now = Date.now()) {
  validTimezone(zone); validateDay(day);
  const begin = zonedInstant(day, "09:00", zone).epochMilliseconds;
  const finish = zonedInstant(day, "22:00", zone).epochMilliseconds;
  const intervals = busy.map(b => ({ start: Date.parse(b.start), end: Date.parse(b.end) }));
  if (intervals.some(b => !Number.isFinite(b.start) || !Number.isFinite(b.end) || b.end <= b.start)) fail(502, "Google returned incomplete availability. Try again.");
  const slots: Array<{ start: string; end: string }> = [];
  for (let t = begin; t + durationMinutes * 60000 <= finish; t += 1800000) {
    const end = t + durationMinutes * 60000;
    if (t > now && !intervals.some(b => t < b.end && end > b.start)) {
      slots.push({ start: new Date(t).toISOString(), end: new Date(end).toISOString() });
    }
  }
  return slots;
}
const escapeText = (s: string) => s.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
export function foldIcsLine(line: string) {
  let result = "", current = "";
  for (const char of line) {
    if (Buffer.byteLength(current + char, "utf8") > 75) { result += current + "\r\n"; current = " "; }
    current += char;
  }
  return result + current;
}
export function calendarIcs(plan: CalendarPlan, stamp = new Date()) {
  const payload = eventPayload(plan);
  const compact = (s: string) => s.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Couple Dates//Private Dates//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:couple-dates-${plan.id}@couple-dates.invalid`, `DTSTAMP:${compact(stamp.toISOString())}`,
    payload.start.date ? `DTSTART;VALUE=DATE:${compact(payload.start.date)}` : `DTSTART:${compact(payload.start.dateTime!)}`,
    payload.end.date ? `DTEND;VALUE=DATE:${compact(payload.end.date)}` : `DTEND:${compact(payload.end.dateTime!)}`,
    `SUMMARY:${escapeText(plan.title)}`, `DESCRIPTION:${escapeText(payload.description)}`,
    `LOCATION:${escapeText(payload.location)}`, "CLASS:PRIVATE", "STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR",
  ];
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
