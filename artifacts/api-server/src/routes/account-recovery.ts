import { Router, type IRouter } from "express";
import { clerkClient } from "@clerk/express";
import { and, eq, or, sql } from "drizzle-orm";
import { db, accountLinksTable, calendarConnectionsTable } from "@workspace/db";
import { GetAccountRecoveryResponse, CheckAccountRecoveryBody, ConfirmAccountRecoveryBody, IssueAccountRecoveryResponse, SelectAccountSpaceBody, CheckAccountRecoveryResponse } from "@workspace/api-zod";
import { requireUser, requireCouple, findCouple, fail } from "../lib/couple";
import { googleOwnership, issueRecovery, verifyRecovery } from "../lib/recovery-policy";

const router: IRouter = Router();
type VerifiedExternalAccount = { provider: string; externalId: string; verification: { status: string | null } | null };
let googleAccountLoader = async (userId: string): Promise<VerifiedExternalAccount[]> => (await clerkClient.users.getUser(userId)).externalAccounts;
export function setGoogleAccountLoaderForIsolatedTests(loader: typeof googleAccountLoader) {
  if (process.env.BILLING_CONTRACT_TEST !== "isolated") throw new Error("Google recovery fixtures are only available in the isolated contract runner.");
  googleAccountLoader = loader;
}
const production = () => process.env.NODE_ENV === "production";
function key() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) fail(503, "Account recovery is not configured.");
  return value!;
}
async function google(userId: string) {
  let accounts: VerifiedExternalAccount[];
  try {
    accounts = await googleAccountLoader(userId);
  } catch {
    fail(503, "Google account ownership could not be checked. Please try again.");
  }
  const owned = googleOwnership(accounts!, key());
  if (!owned.length) fail(403, "Sign in with the verified Google account that owns your space before using recovery.");
  return owned;
}
async function status(authId: string) {
  const [link] = await db.select().from(accountLinksTable).where(eq(accountLinksTable.authUserId, authId));
  const [original, current] = await Promise.all([link ? findCouple(link.memberUserId) : null, findCouple(authId)]);
  const name = (c: Awaited<ReturnType<typeof findCouple>> | null) => c ? `${c.yourName} & ${c.partnerName}` : null;
  return GetAccountRecoveryResponse.parse({
    environment: production() ? "production" : "preview", linked: !!link, usingRecovered: !!link?.active,
    effectiveUserId: link?.active ? link.memberUserId : authId,
    recoveredSpaceName: name(original), currentSpaceName: name(current),
  });
}
async function inspect(code: string, authId: string) {
  if (!production()) fail(409, "Paste the code in the published app, not the preview.");
  const claim = verifyRecovery(code, await google(authId), key());
  const space = await findCouple(claim.memberId);
  if (!space || space.id !== claim.spaceId) fail(404, "The original membership was not found in this app. Nothing has been changed.");
  const links = await db.select().from(accountLinksTable).where(or(eq(accountLinksTable.authUserId, authId), eq(accountLinksTable.memberUserId, claim.memberId)));
  if (links.some(l => l.authUserId !== authId || l.memberUserId !== claim.memberId)) fail(409, "An account is already linked to a different recovery. No existing link has been replaced.");
  return { claim, space, alreadyLinked: links.some(l => l.authUserId === authId && l.active) };
}

router.use("/account/recovery", requireUser);
router.use("/account/recovery", (req, _res, next) => {
  if (req.method !== "GET" && (!process.env.BILLING_APP_ORIGIN || req.get("origin") !== process.env.BILLING_APP_ORIGIN)) fail(403, "Open recovery in this app before continuing.");
  next();
});
router.get("/account/recovery", async (_req, res) => { res.json(await status(res.locals.clerkUserId)); });
router.post("/account/recovery/proof", requireCouple, async (_req, res) => {
  if (production()) fail(409, "Generate a recovery code in the preview where your original Google login still opens the original space.");
  if (res.locals.userId !== res.locals.clerkUserId) fail(409, "A recovered login cannot create another recovery link.");
  res.json(IssueAccountRecoveryResponse.parse(issueRecovery(res.locals.userId, res.locals.couple.id, await google(res.locals.clerkUserId), key())));
});
router.post("/account/recovery/check", async (req, res) => {
  const { code } = CheckAccountRecoveryBody.parse(req.body);
  const checked = await inspect(code.trim(), res.locals.clerkUserId);
  res.json(CheckAccountRecoveryResponse.parse({ spaceName: `${checked.space.yourName} & ${checked.space.partnerName}`, alreadyLinked: checked.alreadyLinked }));
});
router.post("/account/recovery/confirm", async (req, res) => {
  const { code } = ConfirmAccountRecoveryBody.parse(req.body);
  const authId = res.locals.clerkUserId as string;
  const checked = await inspect(code.trim(), authId);
  await db.transaction(async tx => {
    // Also serialize with membership creation/join and competing recovery claims.
    for (const id of [...new Set([authId, checked.claim.memberId])].sort()) await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${id}))`);
    const links = await tx.select().from(accountLinksTable).where(or(eq(accountLinksTable.authUserId, authId), eq(accountLinksTable.memberUserId, checked.claim.memberId)));
    if (links.some(l => l.authUserId !== authId || l.memberUserId !== checked.claim.memberId)) fail(409, "This recovery conflicts with an existing account link.");
    const existing = links[0];
    if (existing) await tx.update(accountLinksTable).set({ active: true }).where(eq(accountLinksTable.authUserId, authId));
    else {
      await tx.insert(accountLinksTable).values({ authUserId: authId, memberUserId: checked.claim.memberId });
      // A new production Google session has not consented to calendar access yet.
      await tx.update(calendarConnectionsTable).set({ enabled: false, shareAvailability: false, needsConsent: true })
        .where(and(eq(calendarConnectionsTable.userId, checked.claim.memberId), eq(calendarConnectionsTable.coupleId, checked.space.id)));
    }
  });
  res.json(await status(authId));
});
router.post("/account/recovery/select", async (req, res) => {
  const { useRecovered } = SelectAccountSpaceBody.parse(req.body);
  const authId = res.locals.clerkUserId as string;
  if (!useRecovered && !await findCouple(authId)) fail(409, "There is no newer space to switch to. Your recovered space is unchanged.");
  const rows = await db.update(accountLinksTable).set({ active: useRecovered }).where(eq(accountLinksTable.authUserId, authId)).returning();
  if (!rows.length) fail(409, "This account has no verified recovered space.");
  res.json(await status(authId));
});
export default router;
