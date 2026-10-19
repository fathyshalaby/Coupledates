import test from "node:test";
import assert from "node:assert/strict";
import { nextDateState, validateMeeting, validateTime, type DateAction } from "../src/lib/date-state";
import { validateDay } from "../src/lib/validation";

const proposal = { status: "proposed", proposedBy: "partner-a", version: 2 };
const checkError = (run: () => unknown, status: number) => assert.throws(run, (e: unknown) => (e as { status?: number }).status === status);

test("only the recipient may accept, decline or counter a proposal", () => {
  for (const action of ["accept", "decline", "counter"] as DateAction[]) {
    checkError(() => nextDateState(proposal, "partner-a", { action, version: 2, date: "2026-10-20" }), 403);
  }
  assert.equal(nextDateState(proposal, "partner-b", { action: "accept", version: 2 }), "planned");
  assert.equal(nextDateState(proposal, "partner-b", { action: "decline", version: 2 }), "declined");
  assert.equal(nextDateState(proposal, "partner-b", { action: "counter", version: 2, date: "2026-10-21", time: "18:00" }), "proposed");
});
test("stale approvals cannot overwrite a newer plan", () => {
  checkError(() => nextDateState(proposal, "partner-b", { action: "accept", version: 1 }), 409);
});
test("each lifecycle step is explicit, and terminal dates cannot be reaccepted", () => {
  checkError(() => nextDateState(proposal, "partner-b", { action: "start", version: 2 }), 409);
  checkError(() => nextDateState(proposal, "partner-b", { action: "complete", version: 2 }), 409);
  assert.equal(nextDateState({ ...proposal, status: "planned" }, "partner-a", { action: "start", version: 2 }), "active");
  assert.equal(nextDateState({ ...proposal, status: "active" }, "partner-b", { action: "complete", version: 2 }), "completed");
  for (const status of ["planned", "active", "completed", "declined"]) {
    checkError(() => nextDateState({ ...proposal, status }, "partner-b", { action: "accept", version: 2 }), 409);
  }
});
test("a legacy plan without a proposer cannot get a self approval", () => {
  checkError(() => nextDateState({ ...proposal, proposedBy: null }, "partner-b", { action: "accept", version: 2 }), 403);
});
test("counter dates and clocks must be valid", () => {
  checkError(() => nextDateState(proposal, "partner-b", { action: "counter", version: 2 }), 400);
  checkError(() => nextDateState(proposal, "partner-b", { action: "counter", version: 2, date: "2026-02-30" }), 400);
  checkError(() => validateTime("25:80"), 400);
  validateTime("");
  validateDay("2028-02-29");
  checkError(() => validateDay("2026-02-29"), 400);
  checkError(() => validateDay("not-a-date"), 400);
});
test("meeting URLs reject script schemes and embedded credentials", () => {
  validateMeeting({ mode: "remote", meetingUrl: "https://example.com/room" });
  validateMeeting({ meetingUrl: "" });
  checkError(() => validateMeeting({ meetingUrl: "javascript:alert(1)" }), 400);
  checkError(() => validateMeeting({ meetingUrl: "https://name:password@example.com" }), 400);
});
test("meeting points are optional, paired, and not saved for remote dates", () => {
  validateMeeting({ mode: "in_person", latitude: 0, longitude: 0 });
  validateMeeting({ mode: "remote", latitude: null, longitude: null });
  checkError(() => validateMeeting({ latitude: 48 }), 400);
  checkError(() => validateMeeting({ mode: "remote", latitude: 48, longitude: 16 }), 400);
});
