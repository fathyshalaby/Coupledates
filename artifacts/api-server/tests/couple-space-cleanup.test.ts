import test from "node:test";
import assert from "node:assert/strict";
import { planCoupleSpaceCleanup, type SpaceCleanupCandidate } from "../src/lib/couple-space-cleanup-plan";

function candidate(partial: Partial<SpaceCleanupCandidate> & Pick<SpaceCleanupCandidate, "coupleId" | "kind" | "memberUserIds">): SpaceCleanupCandidate {
  return {
    inviteCode: `code-${partial.coupleId}`,
    yourName: "A",
    partnerName: "B",
    memberCount: partial.memberUserIds.length,
    dates: 0,
    memories: 0,
    checkIns: 0,
    uploads: 0,
    assistantTurns: 0,
    hasSubscription: false,
    hasAccountLink: false,
    ...partial,
  };
}

test("cleanup plan separates orphans and empty solos without auto-applying cross-named moves", () => {
  const plan = planCoupleSpaceCleanup([
    candidate({ coupleId: 1, kind: "orphan", memberUserIds: [] }),
    candidate({ coupleId: 2, kind: "empty_solo", memberUserIds: ["user_solo"], yourName: "Alex", partnerName: "Sam" }),
    candidate({ coupleId: 3, kind: "solo_with_content", memberUserIds: ["user_keep"], yourName: "Sam", partnerName: "Alex", dates: 2 }),
    candidate({ coupleId: 4, kind: "full", memberUserIds: ["a", "b"] }),
  ]);

  assert.equal(plan.orphans.length, 1);
  assert.equal(plan.emptySolos.length, 1);
  assert.equal(plan.soloWithContent.length, 1);
  assert.equal(plan.suggestedMoves.length, 1);
  assert.equal(plan.suggestedMoves[0]?.userId, "user_solo");
  assert.equal(plan.suggestedMoves[0]?.intoCoupleId, 3);
  assert.equal(plan.suggestedMoves[0]?.intoInviteCode, "code-3");
});

test("cleanup plan skips cross-named suggestions when the mover has recovery or billing protections", () => {
  const plan = planCoupleSpaceCleanup([
    candidate({ coupleId: 2, kind: "empty_solo", memberUserIds: ["user_solo"], yourName: "Alex", partnerName: "Sam", hasAccountLink: true }),
    candidate({ coupleId: 3, kind: "solo_with_content", memberUserIds: ["user_keep"], yourName: "Sam", partnerName: "Alex", dates: 2 }),
  ]);
  assert.equal(plan.suggestedMoves.length, 0);
});
