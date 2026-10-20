import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { fail } from "./validation";

const lifetime = 15 * 60 * 1000;
const scope = "couple-dates:preview-owner:v1";
const claimsSchema = z.object({
  scope: z.literal(scope), memberId: z.string().regex(/^user_[a-zA-Z0-9]+$/),
  spaceId: z.number().int().positive(), google: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1).max(5),
  issued: z.number().int(), expires: z.number().int(), nonce: z.string().uuid(),
}).strict();
type GoogleAccount = { provider: string; externalId: string; verification: { status: string | null } | null };

export function googleOwnership(accounts: GoogleAccount[], key: string) {
  return [...new Set(accounts.filter(a => ["google", "oauth_google"].includes(a.provider) && a.verification?.status === "verified" && a.externalId)
    .map(a => createHmac("sha256", key).update(`google-owner:${a.externalId}`).digest("hex")))].slice(0, 5);
}
export function issueRecovery(memberId: string, spaceId: number, google: string[], key: string, now = Date.now()) {
  const claims = claimsSchema.parse({ scope, memberId, spaceId, google, issued: now, expires: now + lifetime, nonce: randomUUID() });
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return { code: `${body}.${createHmac("sha256", key).update(body).digest("base64url")}`, expiresAt: new Date(claims.expires).toISOString() };
}
export function verifyRecovery(code: string, ownedGoogle: string[], key: string, now = Date.now()) {
  const invalid = () => fail(403, "This recovery code is invalid or expired. Generate a fresh code in the preview.");
  if (code.length > 4000 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(code)) return invalid();
  const [body, signature] = code.split(".");
  const expected = createHmac("sha256", key).update(body).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return invalid();
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { return invalid(); }
  const checked = claimsSchema.safeParse(parsed);
  if (!checked.success) return invalid();
  const c = checked.data;
  if (c.issued > now + 30_000 || c.expires <= now || c.expires - c.issued !== lifetime) return invalid();
  if (!c.google.some(id => ownedGoogle.includes(id))) fail(403, "Use the same verified Google account that owns the original space. An email address or matching names are not enough.");
  return c;
}
