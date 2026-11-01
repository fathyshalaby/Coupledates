export type SpaceCleanupCandidate = {
  coupleId: number;
  inviteCode: string;
  yourName: string;
  partnerName: string;
  memberCount: number;
  memberUserIds: string[];
  dates: number;
  memories: number;
  checkIns: number;
  uploads: number;
  assistantTurns: number;
  hasSubscription: boolean;
  hasAccountLink: boolean;
  kind: "orphan" | "empty_solo" | "solo_with_content" | "full";
};

export function classifyCoupleSpace(row: Omit<SpaceCleanupCandidate, "kind">): SpaceCleanupCandidate["kind"] {
  if (row.memberCount === 0) return "orphan";
  if (row.memberCount >= 2) return "full";
  const empty = row.dates + row.memories + row.checkIns + row.uploads + row.assistantTurns === 0;
  if (empty && !row.hasSubscription && !row.hasAccountLink) return "empty_solo";
  return "solo_with_content";
}

export type CleanupPlan = {
  orphans: SpaceCleanupCandidate[];
  emptySolos: SpaceCleanupCandidate[];
  soloWithContent: SpaceCleanupCandidate[];
  suggestedMoves: { userId: string; fromCoupleId: number; intoInviteCode: string; intoCoupleId: number; reason: string }[];
};

/**
 * Build a cleanup plan. Cross-name suggestions are advisory only — they are never
 * applied unless an operator explicitly runs --move-user with that invite.
 */
export function planCoupleSpaceCleanup(candidates: SpaceCleanupCandidate[]): CleanupPlan {
  const orphans = candidates.filter(c => c.kind === "orphan");
  const emptySolos = candidates.filter(c => c.kind === "empty_solo");
  const soloWithContent = candidates.filter(c => c.kind === "solo_with_content");
  const openSeats = candidates.filter(c => c.memberCount === 1);
  const suggestedMoves: CleanupPlan["suggestedMoves"] = [];

  for (const left of openSeats) {
    for (const right of openSeats) {
      if (left.coupleId >= right.coupleId) continue;
      const crossed =
        normalizeName(left.yourName) === normalizeName(right.partnerName)
        && normalizeName(left.partnerName) === normalizeName(right.yourName);
      if (!crossed) continue;
      const leftScore = left.dates + left.memories + left.checkIns;
      const rightScore = right.dates + right.memories + right.checkIns;
      const keep = leftScore >= rightScore ? left : right;
      const move = keep.coupleId === left.coupleId ? right : left;
      if (move.hasSubscription || move.hasAccountLink) continue;
      if (keep.memberCount >= 2) continue;
      suggestedMoves.push({
        userId: move.memberUserIds[0]!,
        fromCoupleId: move.coupleId,
        intoInviteCode: keep.inviteCode,
        intoCoupleId: keep.coupleId,
        reason: `Cross-named solo spaces "${left.yourName} & ${left.partnerName}" / "${right.yourName} & ${right.partnerName}"`,
      });
    }
  }

  return { orphans, emptySolos, soloWithContent, suggestedMoves };
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
