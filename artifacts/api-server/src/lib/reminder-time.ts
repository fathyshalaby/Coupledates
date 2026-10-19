import { Temporal } from "@js-temporal/polyfill";
import { zonedInstant } from "./calendar-time";

type Plan = {
  date: string; time: string; timezone: string; durationMinutes: number; status: string;
};
type Preferences = { timezone: string; leadMinutes: number; dateEnabled: boolean; photoEnabled: boolean };

export function reminderSchedule(plan: Plan, prefs: Preferences, coupleZone: string) {
  if (!["planned", "active", "completed"].includes(plan.status)) return [];
  // A timed date is one shared instant. Untimed dates use each recipient's local 09:00.
  const start = zonedInstant(plan.date, plan.time || "09:00", plan.time ? plan.timezone || coupleZone : prefs.timezone).epochMilliseconds;
  const photoAt = plan.time
    ? start + (plan.durationMinutes + 60) * 60_000
    : zonedInstant(Temporal.PlainDate.from(plan.date).add({ days: 1 }).toString(), "09:00", prefs.timezone).epochMilliseconds;
  return [
    ...(prefs.dateEnabled && plan.status === "planned" ? [{ kind: "date", dueAt: new Date(start - prefs.leadMinutes * 60_000), expiresAt: start }] : []),
    ...(prefs.photoEnabled ? [{ kind: "photo", dueAt: new Date(photoAt), expiresAt: photoAt + 48 * 3600_000 }] : []),
  ];
}
