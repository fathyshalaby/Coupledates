import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key() {
  if (!process.env.SESSION_SECRET) throw new Error("A stable session secret is required for billing webhook verification.");
  return createHash("sha256").update(process.env.SESSION_SECRET).digest();
}
// Provider signing secrets are encrypted at rest, never configuration/plaintext source.
export function encryptWebhookSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(v => v.toString("base64")).join(".");
}
export function decryptWebhookSecret(value: string) {
  const [iv, tag, data] = value.split(".").map(v => Buffer.from(v, "base64"));
  if (!iv || !tag || !data) throw new Error("Invalid webhook secret storage.");
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
