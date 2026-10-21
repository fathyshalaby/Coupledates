import { useState } from 'react';
import { Link } from 'wouter';
import { CalendarCheck2, CalendarPlus, ExternalLink, Loader2, RefreshCw, Trash2, TriangleAlert } from 'lucide-react';
import {
  getExportDateCalendarUrl, getGetCalendarStatusQueryKey, getGetDateCalendarQueryKey,
  useGetCalendarStatus, useGetDateCalendar, useRemoveDateFromCalendar, useSaveDateToCalendar,
  type DatePlan,
} from '@workspace/api-client-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { MANUAL_COPY_NOTE, calendarErrorText, useInvalidateCalendar } from '@/lib/calendar';
import { errStatus, safeHttpUrl } from '@/lib/data';

export function DateCalendarPanel({ plan, agreed }: { plan: DatePlan; agreed: boolean }) {
  const { toast } = useToast();
  const invalidateCal = useInvalidateCalendar();
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const status = useGetCalendarStatus({ query: { queryKey: getGetCalendarStatusQueryKey(), staleTime: 60_000 } });
  const copy = useGetDateCalendar(plan.id, { query: { queryKey: [...getGetDateCalendarQueryKey(plan.id), plan.version], staleTime: 60_000 } });
  const onErr = (e: unknown) => {
    if (errStatus(e) === 401 || errStatus(e) === 403) invalidateCal();
    setErr(calendarErrorText(e, 'Google didn’t accept that just now.'));
  };
  const save = useSaveDateToCalendar({ mutation: { onSuccess: (s) => { setErr(null); invalidateCal(); toast({ title: s.stale ? 'Copy updated' : 'Saved to your Google Calendar' }); }, onError: onErr } });
  const remove = useRemoveDateFromCalendar({ mutation: { onSuccess: () => { setErr(null); setConfirm(false); invalidateCal(); toast({ title: 'Removed from your Google Calendar' }); }, onError: (e) => { setConfirm(false); onErr(e); } } });

  const st = status.data;
  const live = !!st?.connected && !st.needsConsent;
  const c = copy.data;
  const eventUrl = safeHttpUrl(c?.eventUrl);
  const ics = getExportDateCalendarUrl(plan.id);
  if (!agreed && !copy.data?.saved) return null;

  return (
    <section data-testid="panel-date-calendar" className="mt-5 rounded-[26px] border border-foreground/10 bg-card/80 p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-primary">{c?.saved ? <CalendarCheck2 className="h-4 w-4" /> : <CalendarPlus className="h-4 w-4" />}</span>
        <div className="flex-1">
          <p className="font-medium">Add this date to a calendar</p>
          <p data-testid="text-calendar-copy-state" className="text-xs text-muted-foreground">
            {copy.isLoading || status.isLoading ? 'Checking your Google copy…' : c?.saved ? (c.stale ? 'Your Google copy is out of date. Update it below.' : 'A separate copy is saved in your Google Calendar.') : 'No Google copy saved.'}
          </p>
        </div>
        {c?.saved && c.stale && <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-[10px] uppercase">Out of date</span>}
      </div>

      {agreed && (
        <div className="mt-3 rounded-[22px] bg-primary/5 p-3">
          <a href={ics} download data-testid="link-download-ics" className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 font-medium text-primary-foreground transition active:scale-[.98]">
            <CalendarPlus className="h-4 w-4" /> Add to device calendar <span className="font-mono text-[10px] opacity-80">.ics</span>
          </a>
          <p data-testid="text-device-calendar-help" className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
            Works with iPhone, Android, Apple Calendar, Google Calendar, and other calendar apps. If it downloads as a file, open it and choose your calendar app.
          </p>
        </div>
      )}

      <div className="mt-4 rounded-[22px] border border-foreground/10 bg-background/70 p-3">
        <p className="text-sm font-medium">Google Calendar <span className="font-normal text-muted-foreground">· optional</span></p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Connect Google to check shared free time or save a separate copy there. This does not sync automatically.</p>
        {(copy.isLoading || status.isLoading) ? <Skeleton className="mt-3 h-11 rounded-full" /> : (
          <div className="mt-3 flex flex-wrap gap-2">
            {!agreed ? (
              <p className="w-full text-xs text-muted-foreground">This plan isn’t agreed right now, so your saved Google copy can’t be updated — remove it if it no longer applies.</p>
            ) : !live ? (
              <Link href="/calendar" data-testid="link-connect-calendar" className="flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2.5 text-xs font-medium text-background">
                {st?.needsConsent ? <><RefreshCw className="h-3.5 w-3.5" /> Reconnect Google Calendar</> : <><CalendarPlus className="h-3.5 w-3.5" /> Connect Google Calendar</>}
              </Link>
            ) : (
              <button data-testid="button-save-calendar-copy" disabled={save.isPending} onClick={() => save.mutate({ id: plan.id })} className="flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2.5 text-xs font-medium text-background transition active:scale-95 disabled:opacity-50">
                {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : c?.saved ? <RefreshCw className="h-3.5 w-3.5" /> : <CalendarPlus className="h-3.5 w-3.5" />}
                {c?.saved ? 'Update Google copy' : 'Save a Google copy'}
              </button>
            )}
            {eventUrl && <a href={eventUrl} target="_blank" rel="noopener noreferrer" data-testid="link-calendar-event" className="flex items-center gap-1.5 rounded-full bg-foreground/[0.07] px-4 py-2.5 text-xs font-medium">Open in Google <ExternalLink className="h-3 w-3" /></a>}
            {c?.saved && <button data-testid="button-remove-calendar-copy" onClick={() => setConfirm(true)} className="flex items-center gap-1.5 rounded-full px-3 py-2.5 text-xs text-destructive hover:bg-destructive/5"><Trash2 className="h-3.5 w-3.5" /> Remove Google copy</button>}
          </div>
        )}
      </div>

      {err && <p role="alert" data-testid="text-calendar-copy-error" className="mt-3 rounded-2xl bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}
      {copy.isError && <p className="mt-3 text-xs text-destructive">Couldn’t load your copy status. <button className="underline" onClick={() => copy.refetch()}>Retry</button></p>}
      {c?.notice && <p className="mt-3 text-xs text-muted-foreground">{c.notice}</p>}
      <p className="mt-3 flex gap-1.5 text-[11px] leading-snug text-muted-foreground"><TriangleAlert className="mt-px h-3 w-3 shrink-0" />{MANUAL_COPY_NOTE} The .ics file is a one-time copy, not a live feed. Deleting this plan won’t remove calendar entries already added.</p>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent className="rounded-[28px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl">Remove your calendar copy?</AlertDialogTitle>
            <AlertDialogDescription>Deletes “{plan.title}” from your Google Calendar only. The plan stays in Couple Dates, and your partner’s copy (if any) is untouched.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Keep it</AlertDialogCancel>
            <AlertDialogAction data-testid="button-confirm-remove-copy" disabled={remove.isPending} onClick={(e) => { e.preventDefault(); remove.mutate({ id: plan.id }); }} className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">{remove.isPending ? 'Removing…' : 'Remove copy'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
