import { useMemo, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  useCreateDate, useDeleteDate, useUpdateDate,
  type DateInput, type DateInputCategory, type DateInputStatus, type DatePlan,
} from '@workspace/api-client-react';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CategoryChip, EmptyState, ErrorState, ListSkeleton, PageHeader, Stars } from '@/components/bits';
import { useToast } from '@/hooks/use-toast';
import { CATEGORIES, errMsg, fmtDate, parseISO, todayISO, useDatesQ, useInvalidate } from '@/lib/data';
import { cn } from '@/lib/utils';

const AFFECTED = ['dates', 'summary', 'recap'] as const;

function toInput(d: DatePlan, patch: Partial<DateInput> = {}): DateInput {
  return { title: d.title, date: d.date.slice(0, 10), time: d.time || undefined, location: d.location, category: d.category, notes: d.notes, status: d.status, rating: d.rating ?? null, ...patch };
}

export default function DatesPage() {
  const q = useDatesQ();
  const invalidate = useInvalidate();
  const { toast } = useToast();
  const [tab, setTab] = useState<DateInputStatus>('planned');
  const [editing, setEditing] = useState<DatePlan | 'new' | null>(null);
  const [deleting, setDeleting] = useState<DatePlan | null>(null);
  const [completing, setCompleting] = useState<DatePlan | null>(null);
  const [rating, setRating] = useState(0);

  const update = useUpdateDate({ mutation: { onSuccess: () => invalidate([...AFFECTED]), onError: (e) => toast({ title: 'Could not update', description: errMsg(e), variant: 'destructive' }) } });
  const del = useDeleteDate({ mutation: {
    onSuccess: () => { invalidate([...AFFECTED]); setDeleting(null); toast({ title: 'Date removed' }); },
    onError: (e) => toast({ title: 'Could not delete', description: errMsg(e), variant: 'destructive' }),
  } });

  const list = useMemo(() => {
    const all = (q.data ?? []).filter((d) => d.status === tab);
    return tab === 'planned'
      ? all.sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))
      : all.sort((a, b) => b.date.localeCompare(a.date));
  }, [q.data, tab]);
  const counts = useMemo(() => ({ planned: (q.data ?? []).filter((d) => d.status === 'planned').length, completed: (q.data ?? []).filter((d) => d.status === 'completed').length }), [q.data]);
  const today = todayISO();

  const finishComplete = () => {
    if (!completing) return;
    update.mutate({ id: completing.id, data: toInput(completing, { status: 'completed', rating: rating || null }) }, {
      onSuccess: () => { toast({ title: 'Marked as done', description: rating ? `Rated ${rating} of 5.` : undefined }); setCompleting(null); setTab('completed'); },
    });
  };

  return (
    <div>
      <PageHeader kicker="Plans & keepsakes" title={<>Date <em className="text-primary">night</em></>}>
        <button data-testid="button-new-date" onClick={() => setEditing('new')} aria-label="Plan a date" className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_24px_-10px_hsl(12_76%_45%/.8)] transition active:scale-90"><Plus className="h-5 w-5" /></button>
      </PageHeader>

      <div className="grid grid-cols-2 rounded-full bg-foreground/[0.06] p-1">
        {(['planned', 'completed'] as const).map((t) => (
          <button key={t} data-testid={`tab-${t}`} onClick={() => setTab(t)} className="relative rounded-full py-2.5 text-sm font-medium">
            {tab === t && <motion.span layoutId="datetab" className="absolute inset-0 rounded-full bg-card shadow-sm" />}
            <span className="relative capitalize">{t} <span className="font-mono text-xs opacity-50">{counts[t]}</span></span>
          </button>
        ))}
      </div>

      <div className="mt-5">
        {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} label="Dates" /> : list.length === 0 ? (
          tab === 'planned'
            ? <EmptyState title="The calendar is open." body="A walk after dinner counts. So does a new recipe together." action={<button data-testid="button-empty-new-date" onClick={() => setEditing('new')} className="rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground">Plan a date</button>} />
            : <EmptyState title="No finished dates yet." body="When a planned date happens, mark it done and give it a rating." />
        ) : (
          <div className="space-y-4">
            {list.map((d, i) => {
              const past = d.status === 'planned' && d.date < today;
              const dt = parseISO(d.date);
              return (
                <motion.article key={d.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} data-testid={`card-date-${d.id}`}
                  className={cn('overflow-hidden rounded-[26px]', d.status === 'planned' ? 'bg-accent text-accent-foreground' : 'bg-card shadow-[0_1px_0_hsl(var(--border))]')}>
                  <div className="flex">
                    <div className="flex w-20 shrink-0 flex-col items-center justify-center border-r-2 border-dashed border-foreground/15 py-4">
                      <span className="font-mono text-[10px] uppercase tracking-widest">{dt.toLocaleDateString(undefined, { month: 'short' })}</span>
                      <span className="font-display text-4xl leading-none">{dt.getDate()}</span>
                      <span className="font-mono text-[10px] opacity-60">{dt.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                    </div>
                    <div className="min-w-0 flex-1 p-4">
                      <div className="flex items-center gap-2"><CategoryChip category={d.category} className={d.status === 'planned' ? 'bg-foreground/10 text-foreground' : undefined} />{past && <span className="font-mono text-[10px] uppercase text-destructive">Past due</span>}</div>
                      <h3 className="font-display mt-1.5 text-xl leading-tight">{d.title}</h3>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs opacity-75">
                        {d.time && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{d.time}</span>}
                        {d.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{d.location}</span>}
                      </div>
                      {d.notes && <p className="mt-2 line-clamp-3 text-sm opacity-80">{d.notes}</p>}
                      {d.status === 'completed' && (
                        <div className="mt-3"><Stars testid={`rating-${d.id}`} value={d.rating} onChange={(v) => update.mutate({ id: d.id, data: toInput(d, { rating: v }) })} /></div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-1 border-t border-foreground/10 px-3 py-2">
                    {d.status === 'planned' ? (
                      <button data-testid={`button-complete-${d.id}`} onClick={() => { setRating(0); setCompleting(d); }} className="mr-auto flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-medium text-background active:scale-95 transition-transform"><CheckCircle2 className="h-3.5 w-3.5" /> We did it</button>
                    ) : (
                      <button data-testid={`button-reopen-${d.id}`} onClick={() => update.mutate({ id: d.id, data: toInput(d, { status: 'planned', rating: null }) })} className="mr-auto rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:bg-foreground/5">Move back to planned</button>
                    )}
                    <button data-testid={`button-edit-date-${d.id}`} onClick={() => setEditing(d)} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs hover:bg-foreground/5"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                    <button data-testid={`button-delete-date-${d.id}`} onClick={() => setDeleting(d)} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-destructive hover:bg-destructive/5"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>

      <Drawer open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DrawerContent className="max-h-[94dvh] bg-background">
          {editing !== null && <DateForm key={editing === 'new' ? 'new' : editing.id} plan={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
        </DrawerContent>
      </Drawer>

      <Drawer open={!!completing} onOpenChange={(o) => !o && setCompleting(null)}>
        <DrawerContent className="bg-background">
          <div className="mx-auto w-full max-w-md px-5 pb-8 pt-2 text-center">
            <DrawerTitle className="font-display text-3xl">How was it?</DrawerTitle>
            <DrawerDescription className="mt-1 text-sm text-muted-foreground">{completing?.title}</DrawerDescription>
            <div className="mt-6 flex justify-center"><Stars testid="rating-complete" value={rating} onChange={setRating} /></div>
            <p className="mt-2 font-mono text-xs text-muted-foreground">{rating ? `${rating} of 5` : 'Tap to rate, or skip'}</p>
            <button data-testid="button-confirm-complete" disabled={update.isPending} onClick={finishComplete} className="mt-6 w-full rounded-full bg-primary py-4 font-medium text-primary-foreground transition active:scale-[.98] disabled:opacity-50">{update.isPending ? 'Saving...' : 'Mark as done'}</button>
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="rounded-[28px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl">Remove this date?</AlertDialogTitle>
            <AlertDialogDescription>"{deleting?.title}" will be removed for both of you.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-date" className="rounded-full">Keep it</AlertDialogCancel>
            <AlertDialogAction data-testid="button-confirm-delete-date" disabled={del.isPending} onClick={(e) => { e.preventDefault(); if (deleting) del.mutate({ id: deleting.id }); }} className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">{del.isPending ? 'Removing...' : 'Remove'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DateForm({ plan, onDone }: { plan: DatePlan | null; onDone: () => void }) {
  const invalidate = useInvalidate();
  const { toast } = useToast();
  const [title, setTitle] = useState(plan?.title ?? '');
  const [date, setDate] = useState(plan?.date.slice(0, 10) ?? todayISO());
  const [time, setTime] = useState(plan?.time ?? '');
  const [location, setLocation] = useState(plan?.location ?? '');
  const [category, setCategory] = useState<DateInputCategory>(plan?.category ?? 'Everyday');
  const [notes, setNotes] = useState(plan?.notes ?? '');
  const [status, setStatus] = useState<DateInputStatus>(plan?.status ?? 'planned');
  const [rating, setRating] = useState<number | null>(plan?.rating ?? null);
  const [error, setError] = useState<string | null>(null);
  const opts = { mutation: { onSuccess: () => { invalidate([...AFFECTED]); toast({ title: plan ? 'Date updated' : 'Date planned' }); onDone(); }, onError: (e: unknown) => setError(errMsg(e)) } };
  const create = useCreateDate(opts);
  const update = useUpdateDate(opts);
  const pending = create.isPending || update.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const data: DateInput = { title: title.trim(), date, time: time || undefined, location: location.trim(), category, notes, status, rating: status === 'completed' ? rating : null };
    if (plan) update.mutate({ id: plan.id, data }); else create.mutate({ data });
  };

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-xl overflow-y-auto px-5 pb-8 pt-2">
      <DrawerTitle className="font-display text-3xl">{plan ? 'Edit date' : 'Plan a date'}</DrawerTitle>
      <DrawerDescription className="text-sm text-muted-foreground">Your partner sees it right away.</DrawerDescription>
      <div className="mt-5 space-y-4">
        <Input data-testid="input-date-title" required maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's the plan?" className="font-display h-14 rounded-2xl text-xl" />
        <div className="grid grid-cols-2 gap-3">
          <Input data-testid="input-date-date" required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-12 rounded-2xl" />
          <Input data-testid="input-date-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-12 rounded-2xl" />
        </div>
        <Input data-testid="input-date-location" maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where" className="h-12 rounded-2xl" />
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button type="button" key={c} data-testid={`option-date-category-${c.toLowerCase()}`} onClick={() => setCategory(c)} className={cn('rounded-full px-3.5 py-2 text-sm transition', category === c ? 'bg-foreground text-background' : 'bg-card')}>{c}</button>
          ))}
        </div>
        <Textarea data-testid="input-date-notes" maxLength={5000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes, reservations, things to bring" className="min-h-24 rounded-2xl" />
        <div className="grid grid-cols-2 rounded-full bg-foreground/[0.06] p-1">
          {(['planned', 'completed'] as const).map((s) => (
            <button type="button" key={s} data-testid={`option-status-${s}`} onClick={() => setStatus(s)} className={cn('rounded-full py-2 text-sm capitalize transition', status === s && 'bg-card shadow-sm')}>{s}</button>
          ))}
        </div>
        {status === 'completed' && <div className="flex items-center justify-between rounded-2xl bg-card px-4 py-3"><span className="text-sm">Rating</span><Stars testid="rating-form" value={rating} onChange={setRating} /></div>}
      </div>
      {error && <p data-testid="text-date-error" className="mt-4 rounded-2xl bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>}
      <button data-testid="button-save-date" disabled={pending} className="mt-6 w-full rounded-full bg-primary py-4 font-medium text-primary-foreground transition active:scale-[.98] disabled:opacity-50">{pending ? 'Saving...' : plan ? 'Save changes' : 'Add to our plans'}</button>
    </form>
  );
}
