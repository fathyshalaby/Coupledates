import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearch } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, Camera, Check, CheckCircle2, Clock, ExternalLink, Heart, ImagePlus, Loader2, LocateFixed, MapPin, MessageSquareQuote,
  Pencil, Play, RefreshCw, Repeat2, Trash2, UserPlus, Video, X,
} from 'lucide-react';
import {
  useDeleteDate, useDeleteMemory, useRespondToDate, useReviewDate, useUpdateMemory,
  type DateDetail, type DatePlan, type DateResponseInputAction, type Memory, type MemoryInputCategory,
} from '@workspace/api-client-react';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { CategoryChip, EmptyState, ErrorState, Photo, Stars, StatusBadge } from '@/components/bits';
import { DATE_AFFECTED, DateForm } from '@/components/date-form';
import { MEMORY_AFFECTED, MemoryForm, memoryToInput } from '@/components/memory-form';
import { useToast } from '@/hooks/use-toast';
import { useCouple } from '@/lib/couple-context';
import { distanceMeters, errMsg, errStatus, fmtDate, fmtTime, geoErrorText, getPosition, safeHttpUrl, todayISO, useDateDetailQ, usePreferencesQ, useInvalidate } from '@/lib/data';
import { cn } from '@/lib/utils';
import { DateCalendarPanel } from '@/components/date-calendar-panel';
import { MODE_LABEL } from '@/components/date-form';
import { fmtDuration, fmtInstant, isValidTz, resolveLocal, tzShort } from '@/lib/calendar';
import { whoOwes } from '@/pages/dates';
import { ReminderPreferences } from '@/components/reminder-preferences';

const NEARBY_M = 300;
const MAX_ACCURACY_M = 150;

export default function DateDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const q = useDateDetailQ(id);

  if (!Number.isFinite(id) || id <= 0) return <EmptyState title="That date doesn't exist." body="The link might be broken." action={<Link href="/dates" className="rounded-full bg-foreground px-5 py-3 text-sm text-background">Back to dates</Link>} />;
  if (q.isLoading) return <DetailSkeleton />;
  if (q.isError) {
    if (errStatus(q.error) === 404) return <EmptyState title="This date is gone." body="It may have been removed. Any photos from it are still in Memories." action={<Link href="/dates" data-testid="link-back-dates" className="rounded-full bg-foreground px-5 py-3 text-sm text-background">Back to dates</Link>} />;
    return <ErrorState error={q.error} onRetry={() => q.refetch()} label="This date" />;
  }
  if (!q.data) return <DetailSkeleton />;
  return <Detail detail={q.data} onReload={() => q.refetch()} />;
}

function DetailSkeleton() {
  return (
    <div className="space-y-4" data-testid="state-loading">
      <Skeleton className="h-4 w-24" /><Skeleton className="h-12 w-3/4" /><Skeleton className="h-36 rounded-[28px]" /><Skeleton className="h-24 rounded-[28px]" />
      <div className="grid grid-cols-2 gap-3"><Skeleton className="aspect-square rounded-[20px]" /><Skeleton className="aspect-square rounded-[20px]" /></div>
    </div>
  );
}

function Detail({ detail, onReload }: { detail: DateDetail; onReload: () => void }) {
  const d = detail.date;
  const couple = useCouple();
  const solo = couple.memberCount < 2;
  const invalidate = useInvalidate();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [note, setNote] = useState('');
  const [conflict, setConflict] = useState(false);
  const [lastAction, setLastAction] = useState<DateResponseInputAction | null>(null);
  const [countering, setCountering] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [capture, setCapture] = useState<{ file: File | null; memory: Memory | null } | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const search = useSearch();
  const albumRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (new URLSearchParams(search).get('album') === '1') albumRef.current?.scrollIntoView({ block: 'start' });
  }, [search, d.id]);

  const respond = useRespondToDate({ mutation: {
    onSuccess: (_r, v) => {
      invalidate([...DATE_AFFECTED]);
      setNote(''); setConflict(false); setCountering(false); setCompleting(false);
      const msg: Record<string, string> = { accept: "It's a date.", decline: 'Proposal declined.', counter: 'Counter-proposal sent.', start: 'Date started — have fun.', complete: 'Marked complete. Leave your review below.' };
      toast({ title: msg[v.data.action] });
    },
    onError: (e) => {
      if (errStatus(e) === 409) { setConflict(true); invalidate(['dates', 'detail']); }
      else toast({ title: 'That didn’t go through', description: errMsg(e), variant: 'destructive' });
    },
  } });
  const act = (action: DateResponseInputAction, extra: { note?: string; date?: string; time?: string } = {}) => {
    setLastAction(action);
    respond.mutate({ id: d.id, data: { version: d.version, action, ...extra } });
  };
  const busy = (a: DateResponseInputAction) => respond.isPending && lastAction === a;

  const del = useDeleteDate({ mutation: {
    onSuccess: () => { invalidate([...DATE_AFFECTED, 'memories']); toast({ title: 'Date removed', description: 'Its photos stay in Memories.' }); navigate('/dates'); },
    onError: (e) => toast({ title: 'Could not delete', description: errMsg(e), variant: 'destructive' }),
  } });

  const owe = whoOwes(d, solo, 'your partner');
  const url = safeHttpUrl(d.meetingUrl);
  const canEdit = d.status === 'proposed' || d.status === 'planned' || d.status === 'declined';
  const hasPoint = d.mode === 'in_person' && d.latitude != null && d.longitude != null;
  const albumOpen = d.status !== 'declined';
  const isToday = d.date.slice(0, 10) === todayISO();
  const online = d.mode === 'remote';
  const zone = d.timezone || couple.timezone;
  const prefsQ = usePreferencesQ();
  const resolved = d.time ? resolveLocal(d.date.slice(0, 10), d.time, zone) : null;
  const elsewhere = resolved?.kind === 'ok' ? (prefsQ.data ?? []).filter((p) => p.timezone && isValidTz(p.timezone) && p.timezone !== zone)
    .map((p) => ({ who: p.isYou ? 'you' : p.displayName || 'partner', text: `${fmtInstant(resolved.ms, p.timezone, { weekday: 'short', hour: 'numeric', minute: '2-digit' })} ${tzShort(p.timezone, resolved.ms)}` })) : [];
  const accepted = d.status === 'planned' || d.status === 'active' || d.status === 'completed';

  const pickFile = (f: File | undefined) => { if (f) setCapture({ file: f, memory: null }); if (camRef.current) camRef.current.value = ''; if (fileRef.current) fileRef.current.value = ''; };

  return (
    <div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Take a photo" data-testid="input-detail-camera" onChange={(e) => pickFile(e.target.files?.[0])} />
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" className="hidden" aria-label="Upload a photo" data-testid="input-detail-upload" onChange={(e) => pickFile(e.target.files?.[0])} />

      <Link href="/dates" data-testid="link-back-dates" className="mb-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground"><ArrowLeft className="h-3.5 w-3.5" /> All dates</Link>

      <header className="rise">
        <div className="flex flex-wrap items-center gap-1.5"><StatusBadge status={d.status} /><CategoryChip category={d.category} /></div>
        <h1 data-testid="text-date-title" className="font-display mt-2 text-[2.4rem] font-medium leading-[1]">{d.title}</h1>
      </header>

      <AnimatePresence>
        {conflict && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" data-testid="notice-conflict" className="mt-4 flex items-start gap-3 rounded-[22px] bg-destructive/10 p-4 text-sm">
            <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="flex-1"><p className="font-medium">Your partner changed this a moment ago.</p><p className="text-muted-foreground">We loaded the latest version — check it, then try again.</p></div>
            <button data-testid="button-conflict-reload" onClick={() => { setConflict(false); onReload(); }} className="rounded-full bg-foreground px-3 py-1.5 text-xs text-background">Reload</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ticket */}
      <section className="stub rise mt-5 rounded-[28px] bg-card p-5 shadow-[0_1px_0_hsl(var(--border))]">
        <div className="grid grid-cols-2 gap-4">
          <div><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">When</p>
            <p data-testid="text-date-when" className="font-display mt-1 text-xl leading-tight">{fmtDate(d.date, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
            <p className="mt-0.5 flex items-center gap-1 text-sm"><Clock className="h-3.5 w-3.5" />{d.time ? fmtTime(d.time) : 'Any time'}</p>
            <p data-testid="text-date-timezone" className="mt-0.5 font-mono text-[10px] text-muted-foreground">{zone} · {fmtDuration(d.durationMinutes)}</p>
            {elsewhere.map((e) => <p key={e.who} className="font-mono text-[10px] text-muted-foreground">{e.text} for {e.who}</p>)}
            {resolved && resolved.kind !== 'ok' && <p className="font-mono text-[10px] text-destructive">Daylight-saving change at this time — consider another.</p>}</div>
          <div><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Where</p>
            <p className="mt-1 flex items-start gap-1 text-sm">{d.mode === 'remote' ? <Video className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />}<span data-testid="text-date-location">{d.location || (online ? MODE_LABEL.remote : 'Not set yet')}</span></p>
            {hasPoint && <p className="mt-1 font-mono text-[10px] text-muted-foreground">Meeting point pinned</p>}</div>
        </div>
        {d.notes && <><div className="perf my-4" /><p data-testid="text-date-notes" className="whitespace-pre-line text-[15px] leading-relaxed text-foreground/80">{d.notes}</p></>}
        {online && (
          <div data-testid="section-online" className="mt-4 rounded-[22px] bg-[hsl(330_32%_15%)] p-4 text-[hsl(38_60%_96%)]">
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest opacity-70"><Video className="h-3 w-3" /> Online date</p>
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer" data-testid="link-meeting-url" className="mt-2 flex items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground transition active:scale-[.98]">Join the call <ExternalLink className="h-3.5 w-3.5" /></a>
            ) : (
              <p className="mt-2 text-sm opacity-80">{d.meetingUrl ? `Link isn’t a web address: ${d.meetingUrl}` : canEdit ? 'No call link yet — add one by editing the plan.' : 'No call link was added.'}</p>
            )}
            <p className="mt-3 text-xs leading-relaxed opacity-75">Before you start: same playlist or film queued, snacks within reach, chargers plugged in. No camera needed for the album — screenshots and notes count.</p>
          </div>
        )}
        {d.responseNote && (
          <div className="mt-4 flex gap-2 rounded-2xl bg-secondary/70 p-3 text-sm"><MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p data-testid="text-response-note" className="italic">“{d.responseNote}”</p></div>
        )}
      </section>

      {/* Actions */}
      <section className="mt-5 space-y-3">
        {owe && <p data-testid="text-owes" className={cn('rounded-full px-4 py-2 text-center text-sm font-medium', owe.urgent ? 'bg-foreground text-background' : 'bg-foreground/[0.06]')}>{owe.text}</p>}

        {d.status === 'proposed' && d.canRespond && (
          <div className="rise rounded-[26px] bg-accent p-4 text-accent-foreground">
            <Label htmlFor="respond-note" className="font-mono text-[10px] uppercase tracking-widest">A note back · optional</Label>
            <Textarea id="respond-note" data-testid="input-respond-note" maxLength={1500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Can’t wait. I’ll bring the blanket." className="mt-1.5 min-h-16 rounded-2xl border-foreground/10 bg-background/70" />
            <div className="mt-3 grid grid-cols-3 gap-2">
              <ActionBtn testid="button-accept" onClick={() => act('accept', { note })} busy={busy('accept')} disabled={respond.isPending} icon={Check} label="Accept" primary />
              <ActionBtn testid="button-counter" onClick={() => setCountering(true)} disabled={respond.isPending} icon={Repeat2} label="Counter" />
              <ActionBtn testid="button-decline" onClick={() => act('decline', { note })} busy={busy('decline')} disabled={respond.isPending} icon={X} label="Decline" />
            </div>
          </div>
        )}
        {d.status === 'proposed' && !d.canRespond && solo && (
          <Link href="/settings" data-testid="link-invite-partner" className="flex items-center gap-3 rounded-[22px] border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-sm"><UserPlus className="h-5 w-5 text-primary" /><span className="flex-1">Your partner hasn’t joined yet. Share the invite code so they can say yes.</span></Link>
        )}
        {d.status === 'planned' && (
          <button data-testid="button-start-date" disabled={respond.isPending} onClick={() => act('start')} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 font-medium text-primary-foreground shadow-[0_14px_30px_-14px_hsl(12_76%_45%/.9)] transition active:scale-[.98] disabled:opacity-50">
            {busy('start') ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />} {isToday ? 'We’re on — start the date' : 'Start the date'}
          </button>
        )}
        {d.status === 'active' && (
          <div className="grid grid-cols-2 gap-2">
            <button data-testid="button-capture-active" onClick={() => camRef.current?.click()} className="flex items-center justify-center gap-2 rounded-full bg-foreground py-4 font-medium text-background transition active:scale-[.98]"><Camera className="h-4 w-4" /> Snap a photo</button>
            <button data-testid="button-complete-date" disabled={respond.isPending} onClick={() => setCompleting(true)} className="flex items-center justify-center gap-2 rounded-full bg-primary py-4 font-medium text-primary-foreground transition active:scale-[.98] disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /> We’re done</button>
          </div>
        )}
        {(d.status === 'planned' || d.status === 'active') && d.mode === 'in_person' && (
          <HereCheck plan={d} onCapture={() => camRef.current?.click()} />
        )}
        <div className="flex flex-wrap justify-end gap-1">
          {canEdit && <button data-testid="button-edit-date" onClick={() => setEditing(true)} className="flex items-center gap-1 rounded-full px-3 py-2 text-xs hover:bg-foreground/5"><Pencil className="h-3.5 w-3.5" /> {d.status === 'declined' ? 'Edit & propose again' : 'Edit'}</button>}
          {!canEdit && <span className="mr-auto self-center text-xs text-muted-foreground">{d.status === 'active' ? 'Plans are locked while the date is happening.' : 'Finished dates are locked — reviews and photos stay open.'}</span>}
          <button data-testid="button-delete-date" onClick={() => setDeleting(true)} className="flex items-center gap-1 rounded-full px-3 py-2 text-xs text-destructive hover:bg-destructive/5"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
        </div>
      </section>

      <DateCalendarPanel plan={d} agreed={accepted} />
      {accepted && <ReminderPreferences />}

      {d.status === 'completed' && <Reviews plan={d} reviews={detail.reviews} />}

      {/* Album */}
      <section ref={albumRef} id="date-album" tabIndex={-1} className="mt-8 scroll-mt-4">
        <div className="mb-3 flex items-end justify-between">
          <div><p className="font-mono text-[10px] uppercase tracking-widest text-primary">Shared album</p><h2 className="font-display text-2xl">{detail.memories.length ? `${detail.memories.length} kept` : 'Our pages'}</h2></div>
          {albumOpen && <div className="flex gap-2">
            <button data-testid="button-album-camera" onClick={() => camRef.current?.click()} aria-label="Take a photo" className="grid h-11 w-11 place-items-center rounded-full bg-foreground text-background transition active:scale-90"><Camera className="h-4 w-4" /></button>
            <button data-testid="button-album-upload" onClick={() => fileRef.current?.click()} aria-label="Upload a photo" className="grid h-11 w-11 place-items-center rounded-full bg-card shadow-[0_1px_0_hsl(var(--border))] transition active:scale-90"><ImagePlus className="h-4 w-4" /></button>
            <button data-testid="button-album-note" onClick={() => setCapture({ file: null, memory: null })} aria-label="Add a memory without a photo" className="grid h-11 w-11 place-items-center rounded-full bg-card shadow-[0_1px_0_hsl(var(--border))] transition active:scale-90"><Pencil className="h-4 w-4" /></button>
          </div>}
        </div>
        {detail.memories.length === 0 ? (
          <div data-testid="state-album-empty" className="rounded-[26px] border border-dashed border-foreground/20 px-6 py-8 text-center">
            <p className="font-display text-xl">{albumOpen ? 'Nothing pinned yet.' : 'No album for declined dates.'}</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">{albumOpen ? (online ? 'Apart tonight? Upload screenshots of the call or jot a note — no camera needed.' : 'Each photo becomes its own memory, with a note — both of you can add as many as you like.') : 'Propose it again to start collecting photos.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-5">
            {detail.memories.map((m, i) => <AlbumCard key={m.id} m={m} i={i} onEdit={() => setCapture({ file: null, memory: m })} />)}
          </div>
        )}
      </section>

      {/* Drawers */}
      <Drawer open={!!capture} onOpenChange={(o) => !o && setCapture(null)}>
        <DrawerContent className="max-h-[94dvh] bg-background">
          {capture && <MemoryForm key={capture.memory?.id ?? 'new'} memory={capture.memory} initialFile={capture.file}
            defaults={{ dateId: d.id, date: d.date.slice(0, 10) <= todayISO() ? d.date.slice(0, 10) : todayISO(), category: d.category as MemoryInputCategory, title: d.title, dateTitle: d.title }}
            onDone={() => setCapture(null)} />}
        </DrawerContent>
      </Drawer>

      <Drawer open={editing} onOpenChange={setEditing}>
        <DrawerContent className="max-h-[94dvh] bg-background">{editing && <DateForm plan={d} onDone={() => setEditing(false)} />}</DrawerContent>
      </Drawer>

      <Drawer open={countering} onOpenChange={setCountering}>
        <DrawerContent className="bg-background">{countering && <CounterForm plan={d} zone={zone} pending={respond.isPending} onSubmit={(x) => act('counter', x)} />}</DrawerContent>
      </Drawer>

      <Drawer open={completing} onOpenChange={setCompleting}>
        <DrawerContent className="bg-background">
          <div className="mx-auto w-full max-w-md px-5 pb-8 pt-2 text-center">
            <DrawerTitle className="font-display text-3xl">That’s a wrap?</DrawerTitle>
            <DrawerDescription className="mt-1 text-sm text-muted-foreground">Marks “{d.title}” complete for both of you. You can each rate it afterwards, and keep adding photos.</DrawerDescription>
            <button data-testid="button-confirm-complete" disabled={respond.isPending} onClick={() => act('complete')} className="mt-6 w-full rounded-full bg-primary py-4 font-medium text-primary-foreground transition active:scale-[.98] disabled:opacity-50">{busy('complete') ? 'Saving...' : 'Mark complete'}</button>
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent className="rounded-[28px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl">Remove this date?</AlertDialogTitle>
            <AlertDialogDescription>“{d.title}” will be removed for both of you, along with its reviews.{detail.memories.length > 0 && ` The ${detail.memories.length} album ${detail.memories.length === 1 ? 'memory stays' : 'memories stay'} safe in Memories — just unpinned from this date.`}</AlertDialogDescription>
            <p data-testid="text-delete-calendar-warning" className="rounded-2xl bg-accent/60 px-3 py-2 text-left text-xs">Saved Google Calendar copies are not deleted automatically — they’re independent snapshots that stay in Google. Remove your copy from this date’s calendar panel first if you don’t want it.</p>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-date" className="rounded-full">Keep it</AlertDialogCancel>
            <AlertDialogAction data-testid="button-confirm-delete-date" disabled={del.isPending} onClick={(e) => { e.preventDefault(); del.mutate({ id: d.id }); }} className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">{del.isPending ? 'Removing...' : 'Remove'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ActionBtn({ testid, onClick, busy, disabled, icon: Icon, label, primary }: { testid: string; onClick: () => void; busy?: boolean; disabled?: boolean; icon: typeof Check; label: string; primary?: boolean }) {
  return (
    <button data-testid={testid} onClick={onClick} disabled={disabled} className={cn('flex flex-col items-center gap-1 rounded-[18px] py-3 text-sm font-medium transition active:scale-95 disabled:opacity-50', primary ? 'bg-foreground text-background' : 'bg-background/70')}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}{label}
    </button>
  );
}

function CounterForm({ plan, zone, pending, onSubmit }: { plan: DatePlan; zone: string; pending: boolean; onSubmit: (x: { date: string; time: string; note: string }) => void }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const dst = date && time ? resolveLocal(date, time, zone).kind : 'ok';
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ date, time, note: note.trim() }); }} className="mx-auto w-full max-w-md px-5 pb-8 pt-2">
      <DrawerTitle className="font-display text-3xl">Suggest another time</DrawerTitle>
      <DrawerDescription className="text-sm text-muted-foreground">It becomes your proposal back — they’ll get to accept, decline or counter. Was {fmtDate(plan.date, { weekday: 'short', month: 'short', day: 'numeric' })}{plan.time ? ` at ${fmtTime(plan.time)}` : ''}.</DrawerDescription>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label htmlFor="c-date" className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">New day</Label><Input id="c-date" data-testid="input-counter-date" required type="date" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} className="h-12 rounded-2xl" /></div>
        <div className="space-y-1.5"><Label htmlFor="c-time" className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">New time</Label><Input id="c-time" data-testid="input-counter-time" required type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-12 rounded-2xl" /></div>
      </div>
      <p data-testid="text-counter-timezone" className="mt-2 font-mono text-[10px] text-muted-foreground">Times are in {zone} · length stays {fmtDuration(plan.durationMinutes)}</p>
      {dst !== 'ok' && <p className="mt-2 rounded-2xl bg-accent/60 px-3 py-2 text-xs">Daylight-saving change at this time in {zone} — it doesn’t exist or happens twice. Pick another time.</p>}
      <div className="mt-3 space-y-1.5"><Label htmlFor="c-note" className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Why this works better</Label>
        <Textarea id="c-note" data-testid="input-counter-note" required minLength={1} maxLength={1500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Saturday’s packed — Sunday brunch instead?" className="min-h-20 rounded-2xl" /></div>
      <button data-testid="button-send-counter" disabled={pending || !date || !time || !note.trim() || dst !== 'ok'} className="mt-5 w-full rounded-full bg-primary py-4 font-medium text-primary-foreground transition active:scale-[.98] disabled:opacity-50">{pending ? 'Sending...' : 'Send counter-proposal'}</button>
    </form>
  );
}

function HereCheck({ plan, onCapture }: { plan: DatePlan; onCapture: () => void }) {
  const [state, setState] = useState<{ kind: 'idle' | 'checking' | 'here' | 'away' | 'fuzzy' | 'error'; text?: string }>({ kind: 'idle' });
  const hasPoint = plan.latitude != null && plan.longitude != null;
  const check = async () => {
    if (!hasPoint) return;
    setState({ kind: 'checking' });
    try {
      const pos = await getPosition();
      const dist = distanceMeters({ lat: pos.coords.latitude, lng: pos.coords.longitude }, { lat: plan.latitude as number, lng: plan.longitude as number });
      const acc = pos.coords.accuracy;
      if (acc > MAX_ACCURACY_M) setState({ kind: 'fuzzy', text: `Your phone’s fix is only accurate to about ${Math.round(acc)} m — too fuzzy to tell. Try again in a moment, or just start.` });
      else if (dist <= NEARBY_M) setState({ kind: 'here' });
      else setState({ kind: 'away', text: dist > 2000 ? `About ${(dist / 1000).toFixed(1)} km from the meeting point.` : `About ${Math.round(dist / 10) * 10} m from the meeting point.` });
    } catch (e) { setState({ kind: 'error', text: geoErrorText(e as GeolocationPositionError) }); }
  };
  if (!hasPoint) return <p className="px-1 text-xs text-muted-foreground">No meeting point pinned — that’s fine. Pin one when editing the proposal if you’d like a “we’re here” check.</p>;
  return (
    <div className="rounded-[22px] border border-foreground/10 bg-card/70 p-4">
      <AnimatePresence mode="wait">
        {state.kind === 'here' ? (
          <motion.div key="here" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3">
            <span className="stamp-in grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Heart className="h-5 w-5 fill-current" /></span>
            <div className="flex-1"><p className="font-display text-lg leading-tight">You’re here — save a photo?</p><p className="text-xs text-muted-foreground">Checked once, just now. Nothing about your position was stored.</p></div>
            <button data-testid="button-nudge-capture" onClick={onCapture} className="rounded-full bg-foreground px-3.5 py-2 text-xs text-background"><Camera className="h-4 w-4" /></button>
          </motion.div>
        ) : (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3">
            <LocateFixed className="h-5 w-5 shrink-0 text-primary" />
            <div className="flex-1 text-sm"><p className="font-medium">Check if we’re here</p><p data-testid="text-here-status" className="text-xs text-muted-foreground">{state.text ?? 'One-time location check against the pinned meeting point. No background tracking.'}</p></div>
            <button data-testid="button-check-here" disabled={state.kind === 'checking'} onClick={check} className="rounded-full bg-foreground/[0.07] px-3.5 py-2 text-xs font-medium disabled:opacity-60">{state.kind === 'checking' ? <Loader2 className="h-4 w-4 animate-spin" /> : state.kind === 'idle' ? 'Check' : 'Again'}</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AlbumCard({ m, i, onEdit }: { m: Memory; i: number; onEdit: () => void }) {
  const invalidate = useInvalidate();
  const { toast } = useToast();
  const [confirm, setConfirm] = useState(false);
  const fav = useUpdateMemory({ mutation: { onSuccess: () => invalidate([...MEMORY_AFFECTED]), onError: (e) => toast({ title: 'Could not update', description: errMsg(e), variant: 'destructive' }) } });
  const del = useDeleteMemory({ mutation: { onSuccess: () => { invalidate([...MEMORY_AFFECTED]); toast({ title: 'Removed from album' }); setConfirm(false); }, onError: (e) => toast({ title: 'Could not delete', description: errMsg(e), variant: 'destructive' }) } });
  return (
    <motion.figure initial={{ opacity: 0, y: 14, rotate: 0 }} animate={{ opacity: 1, y: 0, rotate: i % 2 ? 1.4 : -1.4 }} transition={{ delay: i * 0.05 }} data-testid={`card-album-${m.id}`} className="polaroid">
      {m.photoPath ? <Photo path={m.photoPath} alt={m.title} className="aspect-square w-full" /> : <div className="grid aspect-square w-full place-items-center bg-secondary p-3 text-center font-display text-lg italic leading-tight">{m.title}</div>}
      <figcaption className="mt-2 px-0.5 text-[hsl(330_32%_15%)]">
        <p className="truncate text-sm font-medium">{m.title}</p>
        {m.note && <p className="line-clamp-2 text-xs opacity-70">{m.note}</p>}
        <div className="mt-1.5 flex items-center justify-between">
          <button data-testid={`button-album-fav-${m.id}`} aria-label="Favorite" aria-pressed={m.favorite} onClick={() => fav.mutate({ id: m.id, data: memoryToInput(m, { favorite: !m.favorite }) })}><Heart className={cn('h-4 w-4 transition', m.favorite ? 'fill-primary text-primary' : 'opacity-30')} /></button>
          <div className="flex gap-1">
            <button data-testid={`button-album-edit-${m.id}`} aria-label="Edit memory" onClick={onEdit} className="rounded-full p-1 hover:bg-foreground/5"><Pencil className="h-3.5 w-3.5" /></button>
            <button data-testid={`button-album-delete-${m.id}`} aria-label="Delete memory" onClick={() => setConfirm(true)} className="rounded-full p-1 text-destructive hover:bg-destructive/5"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </figcaption>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent className="rounded-[28px]">
          <AlertDialogHeader><AlertDialogTitle className="font-display text-2xl">Remove this memory?</AlertDialogTitle><AlertDialogDescription>“{m.title}” will be gone for both of you, photo included.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Keep it</AlertDialogCancel>
            <AlertDialogAction data-testid={`button-confirm-album-delete-${m.id}`} disabled={del.isPending} onClick={(e) => { e.preventDefault(); del.mutate({ id: m.id }); }} className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">{del.isPending ? 'Removing...' : 'Remove'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.figure>
  );
}

function Reviews({ plan, reviews }: { plan: DatePlan; reviews: DateDetail['reviews'] }) {
  const invalidate = useInvalidate();
  const { toast } = useToast();
  const mine = reviews.find((r) => r.isYou);
  const theirs = reviews.filter((r) => !r.isYou);
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [note, setNote] = useState(mine?.note ?? '');
  const [editing, setEditing] = useState(!mine);
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
  const save = useReviewDate({ mutation: {
    onSuccess: () => { invalidate(['dates', 'detail', 'recap', 'summary']); setEditing(false); toast({ title: 'Review saved' }); },
    onError: (e) => toast({ title: 'Could not save review', description: errMsg(e), variant: 'destructive' }),
  } });
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-end justify-between">
        <div><p className="font-mono text-[10px] uppercase tracking-widest text-primary">Reviews</p><h2 className="font-display text-2xl">How was it?</h2></div>
        {avg != null && <div className="text-right"><p data-testid="text-average-rating" className="font-display text-4xl leading-none">{avg.toFixed(1)}</p><p className="font-mono text-[10px] text-muted-foreground">average of {reviews.length}</p></div>}
      </div>
      <div className="space-y-3">
        {editing ? (
          <form onSubmit={(e) => { e.preventDefault(); if (rating) save.mutate({ id: plan.id, data: { rating, note } }); }} className="rounded-[24px] bg-card p-4 shadow-[0_1px_0_hsl(var(--border))]">
            <p className="text-sm font-medium">Your review</p>
            <div className="mt-2"><Stars testid="rating-review" value={rating} onChange={setRating} /></div>
            <Label htmlFor="review-note" className="sr-only">Review note</Label>
            <Textarea id="review-note" data-testid="input-review-note" maxLength={1500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="The best part was…" className="mt-3 min-h-20 rounded-2xl" />
            <div className="mt-3 flex gap-2">
              {mine && <button type="button" onClick={() => setEditing(false)} className="rounded-full px-4 py-2.5 text-sm">Cancel</button>}
              <button data-testid="button-save-review" disabled={!rating || save.isPending} className="flex-1 rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">{save.isPending ? 'Saving...' : rating ? 'Save my review' : 'Pick a rating'}</button>
            </div>
          </form>
        ) : mine && <ReviewCard name="You" rating={mine.rating} note={mine.note} onEdit={() => setEditing(true)} testid="card-review-you" />}
        {theirs.map((r) => <ReviewCard key={r.id} name={r.displayName} rating={r.rating} note={r.note} testid={`card-review-${r.id}`} />)}
        {theirs.length === 0 && <p className="rounded-[20px] border border-dashed border-foreground/15 px-4 py-3 text-sm text-muted-foreground">Your partner hasn’t reviewed this one yet.</p>}
      </div>
    </section>
  );
}

function ReviewCard({ name, rating, note, onEdit, testid }: { name: string; rating: number; note: string; onEdit?: () => void; testid: string }) {
  return (
    <div data-testid={testid} className="rounded-[24px] bg-card p-4 shadow-[0_1px_0_hsl(var(--border))]">
      <div className="flex items-center justify-between"><p className="font-medium">{name}</p>{onEdit && <button data-testid="button-edit-review" onClick={onEdit} className="text-xs text-primary">Edit</button>}</div>
      <div className="mt-1.5"><Stars value={rating} size="sm" /></div>
      {note && <p className="mt-2 text-sm text-foreground/80">{note}</p>}
    </div>
  );
}
