import { clerkClient } from "@clerk/express";
import { db, calendarConnectionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { fail } from "./validation";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/calendar.events.owned",
];
async function consentRequired(userId: string): Promise<never> {
  await db.update(calendarConnectionsTable).set({ needsConsent: true }).where(eq(calendarConnectionsTable.userId, userId));
  fail(409, "Reconnect Google Calendar and approve calendar permissions. Your couple's data is unchanged.");
}
async function tokenFor(userId: string) {
  let tokens;
  try { tokens = await clerkClient.users.getUserOauthAccessToken(userId, "google"); }
  catch (e) {
    const status = (e as { status?: number }).status;
    if (status && status >= 500 || status === 429) fail(503, "Google authorization is temporarily unavailable. Please try again.");
    return consentRequired(userId);
  }
  const token = tokens.data.find(t => GOOGLE_CALENDAR_SCOPES.every(scope => t.scopes?.includes(scope)));
  if (!token) return consentRequired(userId);
  return token.token;
}
export async function googleCalendarRequest(userId: string, path: string, init: { method?: string; body?: unknown } = {}, allowedStatuses: number[] = []) {
  const accessToken = await tokenFor(userId);
  let response: Response;
  try {
    response = await fetch(`https://www.googleapis.com/calendar/v3/${path}`, {
      method: init.method ?? "GET", signal: AbortSignal.timeout(12000),
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
  } catch { fail(503, "Google Calendar didn't respond. Please try again; no availability has been assumed."); }
  if (response!.ok || allowedStatuses.includes(response!.status)) return response!;
  if (response!.status === 401) return consentRequired(userId);
  if (response!.status === 403) {
    const error = await response!.json().catch(() => null) as { error?: { errors?: Array<{ reason?: string }> } } | null;
    const reason = error?.error?.errors?.[0]?.reason;
    if (["insufficientPermissions", "authError"].includes(reason ?? "")) return consentRequired(userId);
    if (["accessNotConfigured", "SERVICE_DISABLED"].includes(reason ?? "")) fail(503, "Google Calendar API access is not enabled for this Google authorization app. Use the calendar download meanwhile.");
    fail(503, "Google Calendar denied this request. Check permissions or try again later.");
  }
  fail(503, "Google Calendar couldn't complete this request. Please try again.");
}
export async function primaryBusy(userId: string, start: string, end: string) {
  const response = await googleCalendarRequest(userId, "freeBusy", {
    method: "POST", body: { timeMin: start, timeMax: end, items: [{ id: "primary" }] },
  });
  const data = await response.json() as { calendars?: Record<string, { busy?: Array<{ start: string; end: string }>; errors?: unknown[] }> };
  const primary = data.calendars?.primary;
  if (!primary || primary.errors?.length || !Array.isArray(primary.busy)) fail(503, "Your primary calendar couldn't provide availability. No free times have been assumed.");
  return primary.busy!;
}
