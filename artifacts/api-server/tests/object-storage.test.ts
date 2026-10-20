import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

// Throwaway key: v4 signing happens locally, so no bucket or network is needed.
const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const key = { client_email: "photos@example-project.iam.gserviceaccount.com", private_key: privateKey, project_id: "example-project" };
process.env.GCS_CREDENTIALS_JSON = JSON.stringify(key);
process.env.PRIVATE_OBJECT_DIR = "/example-bucket/.private";

// Loaded after the environment is set: the module reads its credentials once.
const { ObjectStorageService, readServiceAccountKey } = await import("../src/lib/objectStorage");

test("upload URLs are v4-signed for the private bucket and expire within 15 minutes", async () => {
  const url = new URL(await new ObjectStorageService().getObjectEntityUploadURL());
  assert.equal(url.origin, "https://storage.googleapis.com");
  assert.match(url.pathname, /^\/example-bucket\/\.private\/uploads\/[a-f0-9-]{36}$/);
  assert.equal(url.searchParams.get("X-Goog-Algorithm"), "GOOG4-RSA-SHA256");
  assert.match(url.searchParams.get("X-Goog-Credential") ?? "", /^photos@example-project\.iam\.gserviceaccount\.com\//);
  assert.equal(url.searchParams.get("X-Goog-SignedHeaders"), "host");
  assert.ok(url.searchParams.get("X-Goog-Signature"));
  const ttl = Number(url.searchParams.get("X-Goog-Expires"));
  assert.ok(ttl > 0 && ttl <= 900, `unexpected expiry ${ttl}`);
});

test("a signed upload URL maps to the /objects/uploads/<uuid> path that photo reads require", async () => {
  const storage = new ObjectStorageService();
  const uploadURL = await storage.getObjectEntityUploadURL();
  assert.match(storage.normalizeObjectEntityPath(uploadURL), /^\/objects\/uploads\/[a-f0-9-]{36}$/);
});

test("each upload URL targets a fresh object", async () => {
  const storage = new ObjectStorageService();
  const [a, b] = await Promise.all([storage.getObjectEntityUploadURL(), storage.getObjectEntityUploadURL()]);
  assert.notEqual(new URL(a).pathname, new URL(b).pathname);
});

test("service-account keys are accepted as raw or base64 JSON, and bad input fails clearly", () => {
  assert.equal(readServiceAccountKey(undefined), null);
  assert.equal(readServiceAccountKey("  "), null);
  assert.equal(readServiceAccountKey(JSON.stringify(key))?.client_email, key.client_email);
  assert.equal(readServiceAccountKey(Buffer.from(JSON.stringify(key)).toString("base64"))?.client_email, key.client_email);
  assert.throws(() => readServiceAccountKey("not json"), /not valid JSON/);
  assert.throws(() => readServiceAccountKey(JSON.stringify({ client_email: "x@y" })), /client_email and private_key/);
});
