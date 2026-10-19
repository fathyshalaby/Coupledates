import { useState, type FormEvent } from 'react';
import { Crosshair, Info, Link2, Loader2, MapPin, Users, Video, X } from 'lucide-react';
import {
  useCreateDate, useUpdateDate,
  type DateInput, type DateInputCategory, type DateInputMode, type DatePlan,
} from '@workspace/api-client-react';
import { DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { CATEGORIES, errMsg, errStatus, geoErrorText, getPosition, safeHttpUrl, todayISO, useInvalidate } from '@/lib/data';
import { cn } from '@/lib/utils';

export type DatePrefill = { title?: string; category?: DateInputCategory; mode?: DateInputMode; location?: string; notes?: string };

export const DATE_AFFECTED = ['dates', 'detail', 'summary', 'recap'] as const;

const lbl = 'font-mono text-[11px] uppercase tracking-widest text-muted-foreground';

export function DateForm({ plan, prefill, requireTime, onDone, onCreated }: {
  plan: DatePlan | null; prefill?: DatePrefill; requireTime?: boolean; onDone: () => void; onCreated?: (d: DatePlan) => void;
}) {
  const invalidate = useInvalidate();
  const { toast } = useToast();
  const [title, setTitle] = useState(plan?.title ?? prefill?.title ?? '');
  const [date, setDate] = useState(plan?.date.slice(0, 10) ?? '');
  const [time, setTime] = useState(plan?.time ?? '');
  const [mode, setMode] = useState<DateInputMode>(plan?.mode ?? prefill?.mode ?? 'in_person');
  const [location, setLocation] = useState(plan?.location ?? prefill?.location ?? '');
  const [meetingUrl, setMeetingUrl] = useState(plan?.meetingUrl ?? '');
  const [category, setCategory] = useState<DateInputCategory>(plan?.category ?? prefill?.category ?? 'Everyday');
  const [notes, setNotes] = useState(plan?.notes ?? prefill?.notes ?? '');
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(plan?.latitude != null && plan?.longitude != null ? { lat: plan.latitude, lng: plan.longitude } : null);
  const [locating, setLocating] = useState(false);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetsApproval = !!plan && (plan.status === 'planned' || plan.status === 'proposed' || plan.status === 'declined');
  const opts = {
    mutation: {
      onSuccess: (d: DatePlan) => {
        invalidate([...DATE_AFFECTED]);
        toast({ title: plan ? (resetsApproval ? 'Sent back for a yes' : 'Date updated') : 'Proposal sent', description: plan ? undefined : 'Your partner can accept, decline or suggest another time.' });
        if (!plan) onCreated?.(d);
        onDone();
      },
      onError: (e: unknown) => {
        if (errStatus(e) === 409) { invalidate(['dates', 'detail']); setError('This date changed while you were editing. Close and reopen to see the latest version.'); }
        else setError(errMsg(e));
      },
    },
  };
  const create = useCreateDate(opts);
  const update = useUpdateDate(opts);
  const pending = create.isPending || update.isPending;

  const usePoint = async () => {
    setGeoMsg(null); setLocating(true);
    try {
      const pos = await getPosition();
      setPoint({ lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) });
      setGeoMsg(`Pinned within about ${Math.round(pos.coords.accuracy)} m. Only this meeting point is saved — never your live location.`);
    } catch (e) {
      setGeoMsg(geoErrorText(e as GeolocationPositionError));
    } finally { setLocating(false); }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!date) { setError('Pick a day — the plan needs one.'); return; }
    if (requireTime && !time) { setError('Pick a time so your partner knows when.'); return; }
    if (mode === 'remote' && meetingUrl.trim() && !safeHttpUrl(meetingUrl)) { setError('The call link should start with http:// or https://'); return; }
    const data: DateInput & { expectedVersion?: number } = {
      title: title.trim(), date, time, location: location.trim(), category, notes,
      status: plan ? plan.status : 'proposed',
      rating: plan?.rating ?? null,
      mode,
      meetingUrl: mode === 'remote' ? meetingUrl.trim() : '',
      latitude: mode === 'in_person' && point ? point.lat : null,
      longitude: mode === 'in_person' && point ? point.lng : null,
      ...(plan ? { expectedVersion: plan.version } : {}),
    };
    if (plan) update.mutate({ id: plan.id, data }); else create.mutate({ data });
  };

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-xl overflow-y-auto px-5 pb-8 pt-2">
      <DrawerTitle className="font-display text-3xl">{plan ? 'Edit the plan' : 'Propose a date'}</DrawerTitle>
      <DrawerDescription className="text-sm text-muted-foreground">{plan ? 'Changes are shared with your partner.' : 'It lands in your partner’s inbox to accept, decline, or counter.'}</DrawerDescription>

      {resetsApproval && (
        <p data-testid="text-edit-resets" className="mt-4 flex gap-2 rounded-2xl bg-accent/60 px-4 py-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Saving turns this into a fresh proposal from you{plan?.status === 'planned' ? ' — your partner’s earlier yes is reset and they’ll need to accept again.' : '.'}
        </p>
      )}

      <div className="mt-5 space-y-4">
        <div><Label htmlFor="df-title" className="sr-only">Title</Label>
          <Input id="df-title" data-testid="input-date-title" required maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's the plan?" className="font-display h-14 rounded-2xl text-xl" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="df-date" className={lbl}>Day</Label>
            <Input id="df-date" data-testid="input-date-date" required type="date" min={plan ? undefined : todayISO()} value={date} onChange={(e) => setDate(e.target.value)} className="h-12 rounded-2xl" /></div>
          <div className="space-y-1.5"><Label htmlFor="df-time" className={lbl}>Time{requireTime ? '' : ' · optional'}</Label>
            <Input id="df-time" data-testid="input-date-time" required={requireTime} type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-12 rounded-2xl" /></div>
        </div>

        <div className="grid grid-cols-2 rounded-full bg-foreground/[0.06] p-1" role="radiogroup" aria-label="Together or remote">
          {([['in_person', 'In person', Users], ['remote', 'Remote', Video]] as const).map(([m, label, Icon]) => (
            <button type="button" role="radio" aria-checked={mode === m} key={m} data-testid={`option-mode-${m}`} onClick={() => setMode(m)} className={cn('flex items-center justify-center gap-1.5 rounded-full py-2.5 text-sm transition', mode === m && 'bg-card shadow-sm')}><Icon className="h-4 w-4" />{label}</button>
          ))}
        </div>

        <div className="space-y-1.5"><Label htmlFor="df-loc" className={lbl}>{mode === 'remote' ? 'Where (or what)' : 'Where'}</Label>
          <Input id="df-loc" data-testid="input-date-location" maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} placeholder={mode === 'remote' ? 'Video call, same playlist' : 'Neighbourhood, venue name'} className="h-12 rounded-2xl" /></div>

        {mode === 'remote' ? (
          <div className="space-y-1.5"><Label htmlFor="df-url" className={lbl}>Call link · optional</Label>
            <div className="relative"><Link2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="df-url" data-testid="input-date-meeting-url" type="url" inputMode="url" maxLength={1000} value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://" className="h-12 rounded-2xl pl-10" /></div></div>
        ) : (
          <div className="rounded-[22px] border border-dashed border-foreground/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Meeting point <span className="font-normal text-muted-foreground">· optional</span></p>
                <p className="mt-0.5 text-xs text-muted-foreground">{point ? `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}` : 'Lets you check "are we here?" on the day. Asks for location only when you tap.'}</p>
              </div>
              {point && <button type="button" data-testid="button-clear-meeting-point" onClick={() => { setPoint(null); setGeoMsg(null); }} aria-label="Clear meeting point" className="rounded-full p-1.5 hover:bg-foreground/5"><X className="h-4 w-4" /></button>}
            </div>
            <button type="button" data-testid="button-set-meeting-point" disabled={locating} onClick={usePoint} className="mt-3 flex items-center gap-1.5 rounded-full bg-foreground/[0.07] px-3.5 py-2 text-xs font-medium active:scale-95 transition-transform disabled:opacity-60">
              {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : point ? <MapPin className="h-3.5 w-3.5" /> : <Crosshair className="h-3.5 w-3.5" />}
              {locating ? 'Finding you…' : point ? 'Re-pin to where I am now' : 'Use where I am now'}
            </button>
            {geoMsg && <p data-testid="text-geo-message" className="mt-2 text-xs text-muted-foreground">{geoMsg}</p>}
          </div>
        )}

        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Category">
          {CATEGORIES.map((c) => (
            <button type="button" role="radio" aria-checked={category === c} key={c} data-testid={`option-date-category-${c.toLowerCase()}`} onClick={() => setCategory(c)} className={cn('rounded-full px-3.5 py-2 text-sm transition', category === c ? 'bg-foreground text-background' : 'bg-card')}>{c}</button>
          ))}
        </div>
        <div><Label htmlFor="df-notes" className="sr-only">Notes</Label>
          <Textarea id="df-notes" data-testid="input-date-notes" maxLength={5000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes, things to bring, the vibe" className="min-h-28 rounded-2xl" /></div>
      </div>
      {error && <p role="alert" data-testid="text-date-error" className="mt-4 rounded-2xl bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>}
      <button data-testid="button-save-date" disabled={pending} className="mt-6 w-full rounded-full bg-primary py-4 font-medium text-primary-foreground transition active:scale-[.98] disabled:opacity-50">
        {pending ? 'Saving...' : plan ? (resetsApproval ? 'Save & re-propose' : 'Save changes') : 'Send proposal'}
      </button>
    </form>
  );
}
