import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAssistantHistoryQueryKey,
  getGetCoupleQueryKey,
  getGetDateDetailQueryKey,
  getGetPreferencesQueryKey,
  getGetRecapQueryKey,
  getGetSummaryQueryKey,
  getListRemindersQueryKey,
  getListDatesQueryKey,
  getListMemoriesQueryKey,
  useGetAssistantHistory,
  useGetDateDetail,
  useGetPreferences,
  useGetRecap,
  useGetSummary,
  useListDates,
  useListMemories,
} from '@workspace/api-client-react';

export const REFRESH = { refetchInterval: 30_000, refetchIntervalInBackground: false, staleTime: 10_000 } as const;

export const CATEGORIES = ['Everyday', 'Adventure', 'Food', 'Travel', 'Milestone'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_TONE: Record<string, string> = {
  Everyday: 'bg-secondary text-[hsl(335_30%_30%)]',
  Adventure: 'bg-[hsl(165_28%_90%)] text-[hsl(170_40%_22%)]',
  Food: 'bg-[hsl(38_70%_89%)] text-[hsl(28_55%_28%)]',
  Travel: 'bg-[hsl(208_40%_91%)] text-[hsl(210_45%_26%)]',
  Milestone: 'bg-[hsl(11_60%_92%)] text-[hsl(11_60%_34%)]',
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
export function useRecapQ(year: number, enabled = true) {
  return useGetRecap({ year }, { query: { queryKey: getGetRecapQueryKey({ year }), enabled, ...REFRESH } });
}

export function usePreferencesQ() {
  return useGetPreferences({ query: { queryKey: getGetPreferencesQueryKey(), ...REFRESH } });
}
export function useAssistantQ() {
  return useGetAssistantHistory({ query: { queryKey: getGetAssistantHistoryQueryKey(), ...REFRESH } });
}
export function useDateDetailQ(id: number) {
  return useGetDateDetail(id, { query: { queryKey: getGetDateDetailQueryKey(id), enabled: Number.isFinite(id) && id > 0, ...REFRESH } });
}

export type InvalidateKey = 'couple' | 'memories' | 'dates' | 'summary' | 'recap' | 'detail' | 'preferences' | 'assistant';

export function useInvalidate() {
  const qc = useQueryClient();
  return (what: InvalidateKey[]) => {
    for (const w of what) {
      if (w === 'couple') qc.invalidateQueries({ queryKey: getGetCoupleQueryKey() });
      if (w === 'memories') qc.invalidateQueries({ queryKey: getListMemoriesQueryKey() });
      if (w === 'dates') {
        qc.invalidateQueries({ queryKey: getListDatesQueryKey() });
        qc.invalidateQueries({ queryKey: getListRemindersQueryKey() });
      }
      if (w === 'summary') qc.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
      if (w === 'preferences') qc.invalidateQueries({ queryKey: getGetPreferencesQueryKey() });
      if (w === 'assistant') qc.invalidateQueries({ queryKey: getGetAssistantHistoryQueryKey() });
      if (w === 'detail') qc.invalidateQueries({ predicate: (q) => { const k = String(q.queryKey[0]); return k.startsWith('/api/dates/') && k.endsWith('/detail'); } });
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

export function errStatus(e: unknown): number | undefined {
  const s = (e as { status?: unknown } | null)?.status;
  return typeof s === 'number' ? s : undefined;
}

export function safeHttpUrl(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch { return null; }
}

/** Haversine distance in metres. */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function geoErrorText(e: GeolocationPositionError | { code: number }): string {
  if (e.code === 1) return 'Location permission was declined. Everything else still works — you can start and save photos without it.';
  if (e.code === 3) return 'Finding your location took too long. Try again outdoors, or skip it.';
  return "We couldn't read your location right now. It's optional — carry on without it.";
}

export function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) { reject({ code: 2 }); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });
}

export const STATUS_META: Record<string, { label: string; tone: string }> = {
  proposed: { label: 'Proposed', tone: 'bg-[hsl(38_70%_89%)] text-[hsl(28_55%_28%)]' },
  planned: { label: 'Planned', tone: 'bg-[hsl(165_28%_90%)] text-[hsl(170_40%_22%)]' },
  active: { label: 'Happening now', tone: 'bg-primary text-primary-foreground' },
  completed: { label: 'Done', tone: 'bg-muted text-foreground' },
  declined: { label: 'Declined', tone: 'bg-muted text-muted-foreground' },
};

export function fmtTime(t?: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h)) return t;
  const d = new Date(); d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
