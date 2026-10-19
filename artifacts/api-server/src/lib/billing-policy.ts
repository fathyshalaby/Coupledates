import { fail } from "./validation";

export const PLUS_PRICE_USD = 5;
export const PLUS_PERIOD_DAYS = 30;
export function hasPaidAccess(row: { status: string; currentPeriodEnd: Date | null } | null | undefined, now = Date.now()) {
  return !!row && ["active", "trialing", "canceling"].includes(row.status)
    && !!row.currentPeriodEnd && row.currentPeriodEnd.getTime() > now;
}
export function trustedWhopUrl(value: string | null | undefined) {
  try {
    const url = new URL(value || "");
    if (url.protocol === "https:" && !url.username && !url.password && (url.hostname === "whop.com" || url.hostname.endsWith(".whop.com"))) return url.toString();
  } catch { /* An unverified provider redirect must never be used. */ }
  fail(502, "Whop didn't provide a valid checkout or billing link. Please try again.");
}
export function verifyMembershipBinding(
  membership: { id: string; account: { id: string }; product_id: string; plan_id: string; user_id: string | null; metadata: Record<string, unknown> },
  checkout: { id: string; planId: string | null },
  companyId: string, productId: string,
) {
  if (!membership.id.startsWith("mem_") || !membership.user_id
    || membership.account.id !== companyId || membership.product_id !== productId
    || membership.plan_id !== checkout.planId || membership.metadata.cd_checkout_id !== checkout.id) {
    fail(409, "This purchase couldn't be verified for this couple's space.");
  }
}
