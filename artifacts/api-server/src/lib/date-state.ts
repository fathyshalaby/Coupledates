import { fail, validateDay } from "./validation";

export type DateAction = "accept" | "decline" | "counter" | "start" | "complete";
export function validateTime(time?: string) {
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) fail(400, "Choose a valid time.");
}

export function nextDateState(
  row: { status: string; proposedBy: string | null; version: number },
  userId: string,
  data: { action: DateAction; version: number; date?: string; time?: string },
) {
  if (row.version !== data.version) fail(409, "Your partner updated this date. Refresh it before responding.");
  if (["accept", "decline", "counter"].includes(data.action)) {
    if (row.status !== "proposed") fail(409, "This date is no longer waiting for a response.");
    if (!row.proposedBy || row.proposedBy === userId) fail(403, "Only your partner can respond to your proposal.");
    if (data.action === "counter") {
      if (!data.date) fail(400, "Choose a date for your suggestion.");
      validateDay(data.date);
      validateTime(data.time);
      return "proposed";
    }
    return data.action === "accept" ? "planned" : "declined";
  }
  if (data.action === "start") {
    if (row.status !== "planned") fail(409, "Both partners need to agree before starting this date.");
    return "active";
  }
  if (row.status !== "active") fail(409, "Start the date before completing it.");
  return "completed";
}

export function validateMeeting(data: {
  mode?: string; meetingUrl?: string; latitude?: number | null; longitude?: number | null;
}) {
  if (data.meetingUrl) {
    let url: URL;
    try { url = new URL(data.meetingUrl); } catch { fail(400, "Use a complete https:// or http:// meeting link."); }
    if (!["https:", "http:"].includes(url!.protocol)) fail(400, "Use a secure web meeting link.");
    if (url!.username || url!.password) fail(400, "Meeting links cannot contain account credentials.");
  }
  if ((data.latitude != null) !== (data.longitude != null)) fail(400, "Choose both meeting-point coordinates.");
  if (data.mode === "remote" && (data.latitude != null || data.longitude != null)) fail(400, "Remote dates do not need a physical meeting point.");
}
