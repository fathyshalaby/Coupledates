/**
 * Couple space cleanup / repair helper.
 *
 * Default is dry-run (report only). Never merges spaces by guessing emails or
 * names. Cross-named solos are printed as suggested --move-user commands only.
 *
 * Usage:
 *   pnpm --filter @workspace/api-server run cleanup:couple-spaces
 *   pnpm --filter @workspace/api-server run cleanup:couple-spaces -- --apply-orphans
 *   pnpm --filter @workspace/api-server run cleanup:couple-spaces -- --apply-empty-solos
 *   pnpm --filter @workspace/api-server run cleanup:couple-spaces -- --move-user user_xxx --invite INVITECODE
 */
import { pool } from "@workspace/db";
import {
  applyEmptySoloReleases,
  applyOrphanCoupleCleanup,
  listCoupleSpaceCandidates,
  moveUserIntoInvite,
} from "../src/lib/couple-space-cleanup";
import { planCoupleSpaceCleanup } from "../src/lib/couple-space-cleanup-plan";

function arg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
function has(flag: string) {
  return process.argv.includes(flag);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be set.");

  const moveUser = arg("--move-user");
  const invite = arg("--invite");
  if ((moveUser && !invite) || (!moveUser && invite)) {
    throw new Error("Use --move-user and --invite together.");
  }

  if (moveUser && invite) {
    const couple = await moveUserIntoInvite(moveUser, invite);
    console.log(JSON.stringify({
      action: "move-user",
      userId: moveUser,
      inviteCode: invite,
      coupleId: couple.id,
      names: `${couple.yourName} & ${couple.partnerName}`,
    }, null, 2));
    return;
  }

  const candidates = await listCoupleSpaceCandidates();
  const plan = planCoupleSpaceCleanup(candidates);
  const applyOrphans = has("--apply-orphans");
  const applyEmptySolos = has("--apply-empty-solos");

  const orphanResults = await applyOrphanCoupleCleanup(plan.orphans, applyOrphans);
  const emptyResults = await applyEmptySoloReleases(plan.emptySolos, applyEmptySolos);

  console.log(JSON.stringify({
    mode: {
      orphans: applyOrphans ? "apply" : "dry-run",
      emptySolos: applyEmptySolos ? "apply" : "dry-run",
    },
    summary: {
      couples: candidates.length,
      orphans: plan.orphans.length,
      emptySolos: plan.emptySolos.length,
      soloWithContent: plan.soloWithContent.length,
      suggestedMoves: plan.suggestedMoves.length,
    },
    orphans: orphanResults,
    emptySolos: emptyResults,
    soloWithContent: plan.soloWithContent.map(c => ({
      coupleId: c.coupleId,
      inviteCode: c.inviteCode,
      names: `${c.yourName} & ${c.partnerName}`,
      memberUserIds: c.memberUserIds,
      dates: c.dates,
      memories: c.memories,
      hasSubscription: c.hasSubscription,
      hasAccountLink: c.hasAccountLink,
    })),
    suggestedMoves: plan.suggestedMoves.map(s => ({
      ...s,
      command: `pnpm --filter @workspace/api-server run cleanup:couple-spaces -- --move-user ${s.userId} --invite ${s.intoInviteCode}`,
    })),
    note: "Name-based suggestions are never auto-applied. Use --move-user/--invite explicitly. Empty-solo release returns people to onboarding so they can join the real invite.",
  }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
