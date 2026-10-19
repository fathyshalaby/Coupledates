import { useQueryClient } from '@tanstack/react-query';
import { getGetAssistantHistoryQueryKey, getGetBillingStatusQueryKey, useGetBillingStatus, type BillingStatus } from '@workspace/api-client-react';

/** Shared space-level billing status. Both partners read the same key; polled to stay fresh. */
export function useBillingStatusQ(fast = false) {
  return useGetBillingStatus({
    query: {
      queryKey: getGetBillingStatusQueryKey(),
      staleTime: fast ? 0 : 30_000,
      refetchInterval: fast ? 5_000 : 30_000,
      refetchIntervalInBackground: false,
    },
  });
}

/** Writes a fresh server status into the cache and invalidates gated data. */
export function useBillingSync() {
  const qc = useQueryClient();
  return (status?: BillingStatus) => {
    if (status) qc.setQueryData(getGetBillingStatusQueryKey(), status);
    else qc.invalidateQueries({ queryKey: getGetBillingStatusQueryKey() });
    qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('/api/recap') });
    qc.invalidateQueries({ queryKey: getGetAssistantHistoryQueryKey() });
  };
}

/** Only allow hosted Whop pages over HTTPS. */
export function safeWhopUrl(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const h = u.hostname.toLowerCase();
    if (u.protocol !== 'https:' || u.username || u.password) return null;
    return h === 'whop.com' || h.endsWith('.whop.com') ? u.toString() : null;
  } catch { return null; }
}

export function fmtPeriod(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

export function priceLine(s?: Pick<BillingStatus, 'price' | 'currency' | 'billingIntervalDays'> | null): string {
  const price = s?.price ?? 5;
  const cur = (s?.currency ?? 'usd').toUpperCase();
  const sym = cur === 'USD' ? 'US$' : `${cur} `;
  return `${sym}${price} per couple, billed every ${s?.billingIntervalDays ?? 30} days, plus applicable taxes`;
}

export type BillingPhase = 'verifying' | 'active' | 'ending' | 'past_due' | 'pending' | 'free';

export function billingPhase(s: BillingStatus): BillingPhase {
  if (s.verificationPending) return 'verifying';
  if (s.entitled && s.cancelAtPeriodEnd) return 'ending';
  if (s.entitled) return 'active';
  if (['past_due', 'unpaid', 'unresolved', 'drafted', 'active', 'trialing', 'canceling'].includes(s.providerStatus)) return 'past_due';
  if (s.checkoutPending) return 'pending';
  return 'free';
}
