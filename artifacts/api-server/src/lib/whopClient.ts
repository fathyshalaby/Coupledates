import { WhopClient } from "@whop/sdk";

let clientPromise: Promise<WhopClient> | null = null;
async function initWhopClient(): Promise<WhopClient> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const token = process.env.REPL_IDENTITY ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL ? "depl " + process.env.WEB_REPL_RENEWAL : null;
  if (!hostname || !token) throw new Error("Whop connection is unavailable.");
  const response = await fetch(`https://${hostname}/api/v2/connection?include_secrets=true&connector_names=whop`, {
    headers: { Accept: "application/json", X_REPLIT_TOKEN: token }, signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Whop connection unavailable (${response.status}).`);
  const data = await response.json() as { items?: Array<{ settings?: { api_key?: string } }> };
  const settings = data.items?.[0]?.settings;
  if (!settings?.api_key) throw new Error("Whop is not connected.");
  return new WhopClient({ token: settings.api_key, apiVersionDate: "2026-10-15-1", maxRetries: 1, timeoutInSeconds: 15 });
}
export function getWhopClient(): Promise<WhopClient> {
  if (!clientPromise) clientPromise = initWhopClient().catch(error => { clientPromise = null; throw error; });
  return clientPromise;
}
