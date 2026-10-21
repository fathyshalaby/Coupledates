import { useMemo, useState, type FormEvent } from 'react';
import { useUser } from '@clerk/react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarCheck2, CalendarClock, CalendarX2, Check, Clock, Globe2, Loader2, RefreshCw, ShieldCheck, Unplug, Users } from 'lucide-react';
import {
  getGetCalendarAvailabilityQueryKey, getGetCalendarStatusQueryKey,
  useConnectCalendar, useDisconnectCalendar, useGetCalendarAvailability, useGetCalendarStatus, useSaveCalendarPreferences,
  type CalendarStatus, type GetCalendarAvailabilityParams,
} from '@workspace/api-client-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState, PageHeader } from '@/components/bits';
import { DateForm, type DatePrefill } from '@/components/date-form';
import { useToast } from '@/hooks/use-toast';
import { useCouple } from '@/lib/couple-context';
import { todayISO, usePreferencesQ } from '@/lib/data';
import {
  CALENDAR_REDIRECT, DURATIONS, GOOGLE_SCOPES, browserTz, calendarErrorText, clerkErrorText, commonTimezones, fmtDuration, fmtInstant,
  hasCalendarScopes, isValidTz, tzShort, useInvalidateCalendar, wallDateTime,
} from '@/lib/calendar';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';

const lbl = 'font-mono text-[11px] uppercase tracking-widest text-muted-foreground';

export default function CalendarPage() {
  const q = useGetCalendarStatus({ query: { queryKey: getGetCalendarStatusQueryKey(), staleTime: 60_000 } });
  return (
    <div>
      <PageHeader kicker="Google Calendar · Optional" title={<>When are we <em className="text-primary">both</em> free?</>} />
      {q.isLoading ? (
        <div className="space-y-3" data-testid="state-calendar-loading"><Skeleton className="h-56 rounded-[28px]" /><Skeleton className="h-40 rounded-[28px]" /></div>
      ) : q.isError || !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} label="Calendar status" />
      ) : (
        <>
          <ConnectionCard status={q.data} />
          <AvailabilityFinder status={q.data} />
          <p className="mt-8 px-1 text-xs leading-relaxed text-muted-foreground">
            Only busy/free blocks are read — never titles, guests or details of your other events, and nothing from your calendar is sent to your partner or the date concierge. Saving a date to Google is always a manual copy you control.
          </p>
        </>
      )}
    </div>
  );
}

function ConnectionCard({ status }: { status: CalendarStatus }) {
  const { user, isLoaded } = useUser();
  const { toast } = useToast();
  const invalidateCal = useInvalidateCalendar();
  const [share, setShare] = useState(status.connected ? status.shareAvailability : false);
  const [redirecting, setRedirecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);

  const google = user?.externalAccounts.find((ea) => ea.provider === 'google');
  const scoped = hasCalendarScopes(google?.approvedScopes);

  const onOk = (title: string) => () => { invalidateCal(); setAuthError(null); toast({ title }); };
  const connect = useConnectCalendar({ mutation: { onSuccess: onOk('Calendar connected'), onError: (e) => setAuthError(calendarErrorText(e, 'Couldn’t confirm Google calendar access.')) } });
  const prefs = useSaveCalendarPreferences({ mutation: { onSuccess: onOk('Sharing updated'), onError: (e) => toast({ title: 'Couldn’t save', description: calendarErrorText(e, 'Try again.'), variant: 'destructive' }) } });
  const disconnect = useDisconnectCalendar({ mutation: { onSuccess: () => { setConfirmOff(false); setShare(false); onOk('Calendar access turned off')(); }, onError: (e) => toast({ title: 'Couldn’t disconnect', description: calendarErrorText(e, 'Try again.'), variant: 'destructive' }) } });

  const askGoogle = async () => {
    if (!user) return;
    setAuthError(null); setRedirecting(true);
    try {
      const redirectUrl = CALENDAR_REDIRECT();
      const res = google
        ? await google.reauthorize({ redirectUrl, additionalScopes: GOOGLE_SCOPES })
        : await user.createExternalAccount({ strategy: 'oauth_google', redirectUrl, additionalScopes: GOOGLE_SCOPES });
      const href = res.verification?.externalVerificationRedirectURL?.href;
      if (!href) throw new Error('Google didn’t return an approval page.');
      window.location.href = href;
    } catch (e) {
      setRedirecting(false);
      setAuthError(clerkErrorText(e));
    }
  };

  const finish = () => {
    if (!scoped) { askGoogle(); return; }
    connect.mutate({ data: { shareAvailability: share } });
  };

  const live = status.connected && !status.needsConsent;
  const tone = live ? 'bg-[hsl(170_30%_40%/.12)] text-[hsl(170_40%_25%)]' : status.needsConsent ? 'bg-accent text-accent-foreground' : 'bg-foreground/[0.06]';
  const label = live ? 'Connected' : status.needsConsent ? 'Needs your approval again' : 'Not connected';

  return (
    <section data-testid="card-calendar-connection" className="stub rise rounded-[28px] bg-card p-5 shadow-[0_1px_0_hsl(var(--border))]">
      <div className="flex items-start gap-3">
        <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-full', live ? 'bg-primary text-primary-foreground' : 'bg-secondary text-primary')}>
          {live ? <CalendarCheck2 className="h-5 w-5" /> : <CalendarClock className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xl leading-tight">Your Google Calendar</p>
          <span data-testid="status-calendar-connection" className={cn('mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider', tone)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', live ? 'bg-[hsl(170_40%_35%)]' : 'bg-current opacity-60')} />{label}
          </span>
        </div>
      </div>

      <div className="perf my-4" />

      <ul className="space-y-2 text-sm">
        <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-primary" />You: {live ? (status.shareAvailability ? 'sharing free/busy' : 'connected, not sharing free/busy') : 'not connected'}</li>
        <li data-testid="text-partner-sharing" className="flex items-center gap-2"><Users className="h-4 w-4 shrink-0 text-primary" />Your partner: {status.partnerSharing ? 'sharing free/busy' : 'not sharing yet'}</li>
      </ul>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-[20px] border border-dashed border-foreground/20 p-4">
        <input type="checkbox" data-testid="checkbox-share-availability" checked={share} onChange={(e) => setShare(e.target.checked)} className="mt-1 h-4 w-4 accent-[hsl(12_76%_52%)]" />
        <span className="text-sm"><span className="block font-medium">Share my free/busy with my partner</span>
          <span className="text-muted-foreground">Lets you both find overlapping free times. Only “busy” blocks — never event names. Off by default.</span></span>
      </label>

      <AnimatePresence>
        {authError && (
          <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" data-testid="text-calendar-auth-error" className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{authError}</motion.p>
        )}
      </AnimatePresence>

      <div className="mt-5 space-y-2">
        {live ? (
          <>
            <button data-testid="button-save-sharing" disabled={prefs.isPending || share === status.shareAvailability} onClick={() => prefs.mutate({ data: { shareAvailability: share } })} className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3.5 text-sm font-medium text-background transition active:scale-[.98] disabled:opacity-40">
              {prefs.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save sharing choice
            </button>
            <button data-testid="button-disconnect-calendar" onClick={() => setConfirmOff(true)} className="flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm text-destructive hover:bg-destructive/5"><Unplug className="h-4 w-4" /> Turn off calendar access</button>
          </>
        ) : !isLoaded ? <Skeleton className="h-12 rounded-full" /> : scoped ? (
          <button data-testid="button-finish-connecting" disabled={connect.isPending} onClick={finish} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 font-medium text-primary-foreground shadow-[0_14px_30px_-14px_hsl(12_76%_45%/.9)] transition active:scale-[.98] disabled:opacity-50">
            {connect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck2 className="h-4 w-4" />} Finish connecting
          </button>
        ) : (
          <button data-testid="button-connect-google" disabled={redirecting} onClick={askGoogle} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 font-medium text-primary-foreground shadow-[0_14px_30px_-14px_hsl(12_76%_45%/.9)] transition active:scale-[.98] disabled:opacity-50">
            {redirecting ? <Loader2 className="h-4 w-4 animate-spin" /> : status.needsConsent ? <RefreshCw className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
            {redirecting ? 'Opening Google…' : status.needsConsent ? 'Reconnect Google Calendar' : google ? 'Allow calendar access in Google' : 'Connect Google Calendar'}
          </button>
        )}
        {!live && <p className="px-1 text-center text-xs text-muted-foreground">{scoped ? 'Google already approved. Tap to confirm — your sharing choice above is applied exactly as set.' : 'Google will ask you to approve. You come back here to finish — nothing turns on by itself.'}</p>}
      </div>

      <AlertDialog open={confirmOff} onOpenChange={setConfirmOff}>
        <AlertDialogContent className="rounded-[28px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl">Turn off calendar access?</AlertDialogTitle>
            <AlertDialogDescription>Couple Dates stops reading your free/busy and stops sharing it with your partner. Your Google sign-in stays, and any date copies already saved in your Google Calendar stay there — remove them from each date first if you don’t want them.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Keep it on</AlertDialogCancel>
            <AlertDialogAction data-testid="button-confirm-disconnect" disabled={disconnect.isPending} onClick={(e) => { e.preventDefault(); disconnect.mutate(); }} className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">{disconnect.isPending ? 'Turning off…' : 'Turn off'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function AvailabilityFinder({ status }: { status: CalendarStatus }) {
  const couple = useCouple();
  const prefsQ = usePreferencesQ();
  const [, navigate] = useLocation();
  const [date, setDate] = useState(todayISO());
  const [duration, setDuration] = useState(90);
  const [tz, setTz] = useState(browserTz() || couple.timezone);
  const [submitted, setSubmitted] = useState<GetCalendarAvailabilityParams | null>(null);
  const [proposing, setProposing] = useState<DatePrefill | null>(null);
  const tzOptions = useMemo(() => commonTimezones([couple.timezone, browserTz()]), [couple.timezone]);

  const params = submitted ?? { date, durationMinutes: duration, timezone: tz };
  const q = useGetCalendarAvailability(params, { query: { queryKey: getGetCalendarAvailabilityQueryKey(params), enabled: !!submitted, staleTime: 60_000, retry: false } });

  const ready = status.connected && !status.needsConsent && status.shareAvailability && status.partnerSharing;
  const partner = prefsQ.data?.find((p) => !p.isYou);
  const me = prefsQ.data?.find((p) => p.isYou);
  const myTz = me?.timezone && isValidTz(me.timezone) ? me.timezone : browserTz();
  const partnerTz = partner?.timezone && isValidTz(partner.timezone) ? partner.timezone : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!isValidTz(tz)) return;
    const next = { date, durationMinutes: duration, timezone: tz.trim() };
    if (submitted && JSON.stringify(submitted) === JSON.stringify(next)) q.refetch(); else setSubmitted(next);
  };

  return (
    <section className="rise mt-6">
      <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Mutual free time</p>
      <h2 className="font-display text-2xl">Find a window</h2>

      {!ready && (
        <div data-testid="state-availability-not-ready" className="mt-3 rounded-[22px] bg-secondary/70 p-4 text-sm">
          <p className="font-medium">Both of you need to connect and share free/busy first.</p>
          <p className="mt-0.5 text-muted-foreground">
            {!status.connected || status.needsConsent ? 'Start with your connection above.' : !status.shareAvailability ? 'Tick “Share my free/busy” above and save.' : 'Waiting on your partner to turn on sharing from their Calendar page.'} Until then we can’t say when you’re both free.
          </p>
        </div>
      )}

      <form onSubmit={submit} className="mt-3 rounded-[26px] bg-card p-4 shadow-[0_1px_0_hsl(var(--border))]">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="av-date" className={lbl}>Day</Label>
            <Input id="av-date" data-testid="input-availability-date" type="date" required min={todayISO()} max={(() => { const x = new Date(); x.setDate(x.getDate() + 90); return x.toISOString().slice(0, 10); })()} value={date} onChange={(e) => setDate(e.target.value)} className="h-12 rounded-2xl" /></div>
          <div className="space-y-1.5"><Label htmlFor="av-dur" className={lbl}>Length</Label>
            <select id="av-dur" data-testid="select-availability-duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="h-12 w-full rounded-2xl border border-input bg-background px-3 text-sm">
              {DURATIONS.map((m) => <option key={m} value={m}>{fmtDuration(m)}</option>)}
            </select></div>
        </div>
        <div className="mt-3 space-y-1.5"><Label htmlFor="av-tz" className={lbl}>Timezone</Label>
          <div className="relative"><Globe2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="av-tz" data-testid="input-availability-timezone" list="av-tz-list" value={tz} onChange={(e) => setTz(e.target.value)} className={cn('h-12 rounded-2xl pl-10 font-mono text-sm', !isValidTz(tz) && 'border-destructive')} /></div>
          <datalist id="av-tz-list">{tzOptions.map((z) => <option key={z} value={z} />)}</datalist>
          {!isValidTz(tz) && <p className="text-xs text-destructive">Not a known timezone — try e.g. America/Chicago.</p>}
        </div>
        <button data-testid="button-check-availability" disabled={!ready || !isValidTz(tz) || q.isFetching} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 font-medium text-primary-foreground transition active:scale-[.98] disabled:opacity-40">
          {q.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />} Check availability
        </button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">Checks both primary calendars only, up to 90 days ahead, 9:00–22:00 in the timezone you pick, in 30-minute steps.</p>
      </form>

      <div className="mt-4">
        {!submitted ? null : q.isFetching && !q.data ? (
          <div className="grid grid-cols-2 gap-2" data-testid="state-availability-loading">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-[18px]" />)}</div>
        ) : q.isError ? (
          <div role="alert" data-testid="text-availability-error" className="rounded-[22px] bg-destructive/10 p-4 text-sm">
            <p className="text-destructive">{calendarErrorText(q.error, 'Couldn’t check calendars just now.')}</p>
            <button data-testid="button-retry-availability" onClick={() => q.refetch()} className="mt-2 rounded-full bg-foreground px-3 py-1.5 text-xs text-background">Try again</button>
          </div>
        ) : q.data && !q.data.complete ? (
          <div data-testid="state-availability-incomplete" className="flex gap-3 rounded-[22px] bg-accent/60 p-4 text-sm">
            <CalendarX2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div><p className="font-medium">We couldn’t check both calendars.</p><p className="text-foreground/75">{q.data.notice || 'So we’re not showing any times — we won’t guess that you’re both free.'}</p></div>
          </div>
        ) : q.data && q.data.slots.length === 0 ? (
          <div data-testid="state-availability-empty" className="rounded-[22px] border border-dashed border-foreground/20 p-6 text-center">
            <p className="font-display text-xl">No shared gap that day.</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a shorter length or another day.</p>
          </div>
        ) : q.data ? (
          <>
            <p className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>{q.data.slots.length} free windows · {q.data.timezone}</span>
              <span>checked {fmtInstant(q.data.checkedAt, q.data.timezone)}</span>
            </p>
            {q.data.notice && <p className="mb-2 text-xs text-muted-foreground">{q.data.notice}</p>}
            <div className="grid grid-cols-2 gap-2">
              {q.data.slots.map((s, i) => {
                const zone = q.data.timezone;
                const others = [myTz !== zone ? { who: 'you', z: myTz } : null, partnerTz && partnerTz !== zone ? { who: partner?.displayName || 'partner', z: partnerTz } : null].filter(Boolean) as { who: string; z: string }[];
                return (
                  <motion.button key={s.start} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.025 }}
                    data-testid={`button-slot-${i}`}
                    onClick={() => { const w = wallDateTime(s.start, zone); setProposing({ date: w.date, time: w.time, timezone: zone, durationMinutes: q.data.slots.length ? Math.round((Date.parse(s.end) - Date.parse(s.start)) / 60000) : duration }); }}
                    className="rounded-[18px] bg-card p-3 text-left shadow-[0_1px_0_hsl(var(--border))] transition hover:bg-secondary/60 active:scale-95">
                    <span className="flex items-center gap-1.5 font-display text-lg leading-none"><Clock className="h-3.5 w-3.5 text-primary" />{fmtInstant(s.start, zone)}</span>
                    <span className="mt-1 block font-mono text-[10px] text-muted-foreground">to {fmtInstant(s.end, zone)} {tzShort(zone, Date.parse(s.start))}</span>
                    {others.map((o) => <span key={o.who} className="block font-mono text-[10px] text-muted-foreground">{fmtInstant(s.start, o.z)} for {o.who}</span>)}
                  </motion.button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Tapping a time opens a proposal — nothing is booked until your partner says yes.</p>
          </>
        ) : null}
      </div>

      <Drawer open={!!proposing} onOpenChange={(o) => !o && setProposing(null)}>
        <DrawerContent className="max-h-[94dvh] bg-background sm:max-h-[88dvh]">
          {proposing && <DateForm plan={null} prefill={proposing} requireTime onDone={() => setProposing(null)} onCreated={(d) => navigate(`/dates/${d.id}`)} />}
        </DrawerContent>
      </Drawer>
    </section>
  );
}
