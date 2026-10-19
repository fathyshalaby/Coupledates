import { useQueryClient } from '@tanstack/react-query';
import {
  getGetCoupleQueryKey,
  getGetRecapQueryKey,
  getGetSummaryQueryKey,
  getListDatesQueryKey,
  getListMemoriesQueryKey,
  useGetRecap,
  useGetSummary,
  useListDates,
  useListMemories,
} from '@workspace/api-client-react';

export const REFRESH = { refetchInterval: 30_000, refetchIntervalInBackground: false, staleTime: 10_000 } as const;

export const CATEGORIES = ['Everyday', 'Adventure', 'Food', 'Travel', 'Milestone'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_TONE: Record<string, string> = {
  Everyday: 'bg-secondary text-secondary-foreground',
  Adventure: 'bg-[hsl(170_30%_86%)] text-[hsl(170_40%_20%)]',
  Food: 'bg-accent text-accent-foreground',
  Travel: 'bg-[hsl(205_45%_88%)] text-[hsl(210_45%_24%)]',
  Milestone: 'bg-primary text-primary-foreground',
};

export function useMemoriesQ() {
  return useListMemories({ query: { queryKey: getListMemoriesQueryKey(), ...REFRESH } });
}
export function useDatesQ() {
  return useListDates({ query: { queryKey: getListDatesQueryKey(), ...REFRESH } });
}
export function useSummaryQ() {
  return useGetSummary({ query: { queryKey: getGetSummaryQueryKey(), ...REFRESH } });
}
export function useRecapQ(year: number) {
  return useGetRecap({ year }, { query: { queryKey: getGetRecapQueryKey({ year }), ...REFRESH } });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (what: Array<'couple' | 'memories' | 'dates' | 'summary' | 'recap'>) => {
    for (const w of what) {
      if (w === 'couple') qc.invalidateQueries({ queryKey: getGetCoupleQueryKey() });
      if (w === 'memories') qc.invalidateQueries({ queryKey: getListMemoriesQueryKey() });
      if (w === 'dates') qc.invalidateQueries({ queryKey: getListDatesQueryKey() });
      if (w === 'summary') qc.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
      if (w === 'recap') qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('/api/recap') });
    }
  };
}

export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message.replace(/^HTTP \d+[^:]*:\s*/, '') || 'Something went wrong.';
  return 'Something went wrong.';
}

export function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function fmtDate(s: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) {
  return parseISO(s).toLocaleDateString(undefined, opts);
}

export function photoUrl(path?: string | null): string | null {
  if (!path) return null;
  return `/api/storage${path.startsWith('/') ? path : `/${path}`}`;
}

export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const;
export const MAX_BYTES = 10 * 1024 * 1024;
