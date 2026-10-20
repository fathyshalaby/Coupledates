import test from "node:test";
import assert from "node:assert/strict";
import { googleOwnership, issueRecovery, verifyRecovery } from "../src/lib/recovery-policy";

const key = "test-only-shared-signing-key-for-recovery";
const now = Date.parse("2026-10-20T12:00:00Z");
const account = (externalId: string, status = "verified", provider = "oauth_google") => ({ provider, externalId, verification: { status } });
const owner = googleOwnership([account("google-original")], key);
const other = googleOwnership([account("google-someone-else")], key);
const proof = () => issueRecovery("user_original", 1, owner, key, now);

test("matching Google subject proves ownership across environments without using email or names", () => {
  const { code } = proof();
  assert.equal(verifyRecovery(code, googleOwnership([account("google-original", "verified", "google")], key), key, now).memberId, "user_original");
  assert.equal(verifyRecovery(code, owner, key, now).spaceId, 1);
  assert.ok(!code.includes("google-original"));
});
test("a different Google identity is rejected even if an attacker claims matching names or email", () => {
  assert.throws(() => verifyRecovery(proof().code, other, key, now), /same verified Google/);
  assert.throws(() => verifyRecovery(proof().code, [], key, now), /same verified Google/);
});
test("unverified and non-Google accounts never establish Google ownership", () => {
  assert.deepEqual(googleOwnership([account("id", "unverified"), account("id", "verified", "oauth_github"), { ...account("id"), verification: null }], key), []);
});
test("modified claims and forged or malformed signatures cannot select a space", () => {
  const { code } = proof();
  const [body, sig] = code.split(".");
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  payload.spaceId = 9000;
  assert.throws(() => verifyRecovery(`${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${sig}`, owner, key, now));
  for (const bad of ["", "abc", body + ".fake", code + ".extra", "x".repeat(5000)]) assert.throws(() => verifyRecovery(bad, owner, key, now));
});
test("expired, future-dated and cross-project proofs fail closed", () => {
  assert.throws(() => verifyRecovery(proof().code, owner, key, now + 15 * 60_000));
  assert.throws(() => verifyRecovery(proof().code, owner, key, now - 31_000));
  assert.throws(() => verifyRecovery(proof().code, owner, "different-project-key", now));
});
test("codes are short lived, independently randomized and valid only until the expiry boundary", () => {
  const p = proof();
  assert.notEqual(p.code, proof().code);
  assert.equal(p.expiresAt, new Date(now + 15 * 60_000).toISOString());
  assert.doesNotThrow(() => verifyRecovery(p.code, owner, key, now + 15 * 60_000 - 1));
});
