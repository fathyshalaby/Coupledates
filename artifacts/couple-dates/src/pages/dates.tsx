import { useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { ChevronRight, Clock, Lightbulb, MapPin, Plus, Video } from 'lucide-react';
import type { DatePlan } from '@workspace/api-client-react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { CategoryChip, EmptyState, ErrorState, ListSkeleton, PageHeader, StatusBadge } from '@/components/bits';
import { DateForm } from '@/components/date-form';
import { useCouple } from '@/lib/couple-context';
import { fmtTime, parseISO, todayISO, useDatesQ } from '@/lib/data';
import { cn } from '@/lib/utils';

type Tab = 'inbox' | 'upcoming' | 'past' | 'declined';
const TABS: { key: Tab; label: string }[] = [
  { key: 'inbox', label: 'Inbox' }, { key: 'upcoming', label: 'Upcoming' }, { key: 'past', label: 'Past' }, { key: 'declined', label: 'Declined' },
];
const byWhen = (a: DatePlan, b: DatePlan) => (a.date.slice(0, 10) + (a.time ?? '')).localeCompare(b.date.slice(0, 10) + (b.time ?? ''));

export function whoOwes(d: DatePlan, solo: boolean, partnerName: string): { text: string; urgent: boolean } | null {
  if (d.status !== 'proposed') return null;
  if (d.canRespond) return { text: 'Your turn to answer', urgent: true };
  if (solo) return { text: 'Invite your partner to respond', urgent: false };
  return { text: `Waiting on ${partnerName}`, urgent: false };
}

export default function DatesPage() {
  const q = useDatesQ();
  const couple = useCouple();
  const [, navigate] = useLocation();
  const solo = couple.memberCount < 2;
  const [tab, setTab] = useState<Tab | null>(null);
  const [creating, setCreating] = useState(false);

  const buckets = useMemo(() => {
    const all = q.data ?? [];
    return {
      inbox: all.filter((d) => d.status === 'proposed').sort((a, b) => Number(b.canRespond) - Number(a.canRespond) || byWhen(a, b)),
      upcoming: all.filter((d) => d.status === 'planned' || d.status === 'active').sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || byWhen(a, b)),
      past: all.filter((d) => d.status === 'completed').sort((a, b) => byWhen(b, a)),
      declined: all.filter((d) => d.status === 'declined').sort((a, b) => byWhen(b, a)),
    };
  }, [q.data]);
  const needsYou = buckets.inbox.filter((d) => d.canRespond).length;
  const current: Tab = tab ?? (needsYou > 0 ? 'inbox' : buckets.upcoming.length ? 'upcoming' : buckets.inbox.length ? 'inbox' : 'upcoming');
  const list = buckets[current];

  return (
    <div>
      <PageHeader kicker="Plans & keepsakes" title={<>Date <em className="text-primary">night</em></>}>
        <button data-testid="button-new-date" onClick={() => setCreating(true)} aria-label="Propose a date" className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_24px_-10px_hsl(12_76%_45%/.8)] transition active:scale-90"><Plus className="h-5 w-5" /></button>
      </PageHeader>

      <div role="tablist" aria-label="Date lists" className="grid grid-cols-4 rounded-full bg-foreground/[0.06] p-1">
        {TABS.map((t) => (
          <button role="tab" aria-selected={current === t.key} key={t.key} data-testid={`tab-${t.key}`} onClick={() => setTab(t.key)} className="relative rounded-full py-2.5 text-[13px] font-medium">
            {current === t.key && <motion.span layoutId="datetab" className="absolute inset-0 rounded-full bg-card shadow-sm" />}
            <span className="relative">{t.label}</span>
            {t.key === 'inbox' && needsYou > 0 ? (
              <span data-testid="badge-inbox-count" className="absolute -right-0.5 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 font-mono text-[10px] text-primary-foreground">{needsYou}</span>
            ) : <span className="relative ml-1 font-mono text-[10px] opacity-40">{buckets[t.key].length}</span>}
          </button>
        ))}
      </div>

      <Link href="/assistant" data-testid="link-dates-assistant" className="mt-4 flex items-center gap-3 rounded-[22px] border border-dashed border-primary/40 px-4 py-3 text-sm transition active:scale-[.99]">
        <Lightbulb className="h-4 w-4 text-primary" /><span className="flex-1">Stuck? Ask the date concierge for ideas.</span><ChevronRight className="h-4 w-4 opacity-50" />
      </Link>

      <div className="mt-5">
        {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} label="Dates" /> : list.length === 0 ? (
          current === 'inbox' ? <EmptyState title="Inbox zero." body="No proposals waiting. Suggest something — a walk after dinner counts." action={<button data-testid="button-empty-new-date" onClick={() => setCreating(true)} className="rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground">Propose a date</button>} />
            : current === 'upcoming' ? <EmptyState title="The calendar is open." body="Accepted proposals land here. Propose one and wait for the yes." action={<button data-testid="button-empty-upcoming" onClick={() => setCreating(true)} className="rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground">Propose a date</button>} />
            : current === 'past' ? <EmptyState title="No finished dates yet." body="Start a planned date on the day, then mark it complete to rate it together." />
            : <EmptyState title="Nothing declined." body="Turned-down proposals rest here, in case you want to try again." />
        ) : (
          <div className="space-y-4">
            {list.map((d, i) => <DateCard key={d.id} d={d} i={i} solo={solo} partnerName="your partner" />)}
          </div>
        )}
      </div>

      <Drawer open={creating} onOpenChange={setCreating}>
        <DrawerContent className="max-h-[94dvh] bg-background">
          {creating && <DateForm plan={null} onDone={() => setCreating(false)} onCreated={(d) => navigate(`/dates/${d.id}`)} />}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function DateCard({ d, i, solo, partnerName }: { d: DatePlan; i: number; solo: boolean; partnerName: string }) {
  const dt = parseISO(d.date);
  const owe = whoOwes(d, solo, partnerName);
  const overdue = d.status === 'planned' && d.date.slice(0, 10) < todayISO();
  const warm = d.status === 'proposed' && d.canRespond;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
      <Link href={`/dates/${d.id}`} data-testid={`card-date-${d.id}`}
        className={cn('block overflow-hidden rounded-[26px] transition active:scale-[.99]',
          d.status === 'active' ? 'bg-primary text-primary-foreground' : warm ? 'bg-accent text-accent-foreground' : d.status === 'declined' ? 'bg-card/60 opacity-75' : 'bg-card shadow-[0_1px_0_hsl(var(--border))]')}>
        <div className="flex">
          <div className="flex w-20 shrink-0 flex-col items-center justify-center border-r-2 border-dashed border-current/15 py-4" style={{ borderColor: 'color-mix(in srgb, currentColor 18%, transparent)' }}>
            <span className="font-mono text-[10px] uppercase tracking-widest">{dt.toLocaleDateString(undefined, { month: 'short' })}</span>
            <span className="font-display text-4xl leading-none">{dt.getDate()}</span>
            <span className="font-mono text-[10px] opacity-60">{dt.toLocaleDateString(undefined, { weekday: 'short' })}</span>
          </div>
          <div className="min-w-0 flex-1 p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge status={d.status} className={d.status === 'active' ? 'bg-background/20 text-current' : undefined} />
              <CategoryChip category={d.category} className="bg-foreground/10 text-current" />
              {overdue && <span className="font-mono text-[10px] uppercase text-destructive">Day passed</span>}
            </div>
            <h3 className="font-display mt-1.5 text-xl leading-tight">{d.title}</h3>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs opacity-75">
              {d.time && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtTime(d.time)}</span>}
              {d.mode === 'remote' ? <span className="flex items-center gap-1"><Video className="h-3 w-3" />Remote{d.location ? ` · ${d.location}` : ''}</span>
                : d.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{d.location}</span>}
            </div>
            {owe && <p data-testid={`text-owes-${d.id}`} className={cn('mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', owe.urgent ? 'bg-foreground text-background' : 'bg-foreground/[0.07]')}>{owe.urgent && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}{owe.text}</p>}
            {d.status === 'completed' && d.rating != null && <p className="mt-2 font-mono text-xs">{d.rating.toFixed(1)} / 5 together</p>}
          </div>
          <ChevronRight className="m-4 h-5 w-5 shrink-0 self-center opacity-40" />
        </div>
      </Link>
    </motion.div>
  );
}
