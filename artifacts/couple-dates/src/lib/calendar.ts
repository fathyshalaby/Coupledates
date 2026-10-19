import { useQueryClient } from '@tanstack/react-query';
import { getGetCalendarStatusQueryKey } from '@workspace/api-client-react';
import { errMsg, errStatus } from '@/lib/data';

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/calendar.events.owned',
];

export const CALENDAR_REDIRECT = () => `${window.location.origin}${import.meta.env.BASE_URL}calendar`;

export const MANUAL_COPY_NOTE = 'Changes in Couple Dates are not automatically updated in Google. Update/remove your copy here.';

export function hasCalendarScopes(approved?: string | null): boolean {
  const set = new Set((approved ?? '').split(/\s+/).filter(Boolean));
  return GOOGLE_SCOPES.every((s) => set.has(s));
}

export function useInvalidateCalendar() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: getGetCalendarStatusQueryKey() });
    qc.invalidateQueries({ predicate: (q) => { const k = String(q.queryKey[0]); return k.startsWith('/api/calendar/availability') || (k.startsWith('/api/dates/') && k.endsWith('/calendar')); } });
  };
}

export function browserTz(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

export function isValidTz(tz: string): boolean {
  if (!tz.trim()) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

export function commonTimezones(extra: string[] = []): string[] {
  let list: string[] = [];
  try { list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? []; } catch { list = []; }
  return Array.from(new Set([...extra.filter(Boolean), ...list]));
}

type Parts = { y: number; mo: number; d: number; h: number; mi: number };
function wallParts(ms: number, tz: string): Parts {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const o: Record<string, number> = {};
  for (const p of f.formatToParts(new Date(ms))) if (p.type !== 'literal') o[p.type] = Number(p.value);
  return { y: o.year, mo: o.month, d: o.day, h: o.hour % 24, mi: o.minute };
}
function offsetAt(ms: number, tz: string): number {
  const p = wallParts(ms, tz);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) - Math.floor(ms / 60000) * 60000;
}

export type Resolved = { kind: 'ok'; ms: number } | { kind: 'gap' } | { kind: 'ambiguous' } | { kind: 'invalid' };

/** Resolve a wall-clock date+time in an IANA zone to an instant, detecting DST gaps/overlaps. */
export function resolveLocal(date: string, time: string, tz: string): Resolved {
  if (!isValidTz(tz)) return { kind: 'invalid' };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date); const t = /^(\d{2}):(\d{2})/.exec(time);
  if (!m || !t) return { kind: 'invalid' };
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +t[1], +t[2]);
  const hits = new Set<number>();
  for (const probe of [naive - 864e5 / 2, naive + 864e5 / 2]) {
    const cand = naive - offsetAt(probe, tz);
    const p = wallParts(cand, tz);
    if (Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) === naive) hits.add(cand);
  }
  if (hits.size === 0) return { kind: 'gap' };
  if (hits.size > 1) return { kind: 'ambiguous' };
  return { kind: 'ok', ms: [...hits][0] };
}

export function wallDateTime(iso: string | number, tz: string): { date: string; time: string } {
  const p = wallParts(typeof iso === 'number' ? iso : Date.parse(iso), tz);
  const z = (n: number) => String(n).padStart(2, '0');
  return { date: `${p.y}-${z(p.mo)}-${z(p.d)}`, time: `${z(p.h)}:${z(p.mi)}` };
}

export function fmtInstant(ms: number | string, tz: string, opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }): string {
  try { return new Intl.DateTimeFormat(undefined, { ...opts, timeZone: tz }).format(new Date(ms)); } catch { return ''; }
}

export function tzShort(tz: string, at: number = Date.now()): string {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date(at)).find((p) => p.type === 'timeZoneName')?.value ?? tz;
  } catch { return tz; }
}

export function fmtDuration(min?: number | null): string {
  const m = min ?? 90;
  const h = Math.floor(m / 60); const r = m % 60;
  return h ? `${h} h${r ? ` ${r} min` : ''}` : `${r} min`;
}

export const DURATIONS = [30, 60, 90, 120, 150, 180, 240];

export function calendarErrorText(e: unknown, fallback: string): string {
  const status = errStatus(e);
  const msg = errMsg(e);
  if (status === 401 || status === 403 || /scope|consent|permission|insufficient/i.test(msg))
    return 'Google didn’t grant calendar access. Reconnect and approve both calendar permissions. If this keeps happening, the app’s Google sign-in may need to be enabled with calendar scopes.';
  if (status === 409) return msg || 'This needs a fresh look — reload and try again.';
  if (status === 422 || status === 400) return msg || fallback;
  return msg || fallback;
}

export function clerkErrorText(e: unknown): string {
  const errs = (e as { errors?: { longMessage?: string; message?: string; code?: string }[] })?.errors;
  const first = errs?.[0];
  const base = first?.longMessage || first?.message || (e as Error)?.message || 'Google didn’t respond.';
  return `${base} Google sign-in for this app may need to be enabled with the calendar permissions — ask whoever manages the app to check its Google provider configuration.`;
}
