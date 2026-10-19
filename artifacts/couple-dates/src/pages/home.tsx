import { useMemo } from 'react';
import { Link } from 'wouter';
import { ArrowUpRight, Clock, MapPin, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryChip, ErrorState, Photo } from '@/components/bits';
import { useCouple } from '@/lib/couple-context';
import { fmtDate, todayISO, useDatesQ, useMemoriesQ, useSummaryQ } from '@/lib/data';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomePage() {
  const couple = useCouple();
  const summary = useSummaryQ();
  const memories = useMemoriesQ();
  const dates = useDatesQ();

  const nextDate = useMemo(() => {
    const t = todayISO();
    return (dates.data ?? []).filter((d) => d.status === 'planned' && d.date >= t).sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))[0];
  }, [dates.data]);
  const recent = useMemo(() => [...(memories.data ?? [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3), [memories.data]);
  const s = summary.data;

  return (
    <div>
      <section className="rise">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">{greeting()}, {couple.yourName}</p>
        <h1 className="font-display mt-2 text-[2.8rem] leading-[0.95]" data-testid="text-couple-names">
          {couple.yourName} <em className="text-primary">&amp;</em> {couple.partnerName}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Together since {fmtDate(couple.anniversary, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
      </section>

      {summary.isError ? (
        <div className="mt-6"><ErrorState error={summary.error} onRetry={() => summary.refetch()} label="Your overview" /></div>
      ) : (
        <section className="mt-6 grid grid-cols-2 gap-3">
          <div className="rise col-span-2 flex items-end justify-between rounded-[28px] bg-foreground p-5 text-background">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest opacity-60">Days together</p>
              {s ? <p data-testid="text-days-together" className="font-display text-6xl leading-none">{s.daysTogether.toLocaleString()}</p> : <Skeleton className="mt-2 h-14 w-32 bg-background/15" />}
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-widest opacity-60">Streak</p>
              {s ? <p data-testid="text-current-streak" className="font-display text-3xl text-accent">{s.currentStreak}<span className="text-base opacity-70"> day{s.currentStreak === 1 ? '' : 's'}</span></p> : <Skeleton className="mt-2 h-8 w-16 bg-background/15" />}
            </div>
          </div>
          <Stat label="Memories" value={s?.memoryCount} testid="text-memory-count" href="/memories" />
          <Stat label="Dates done" value={s?.completedDates} testid="text-completed-dates" href="/dates" />
          {s && !s.checkedInToday && (
            <Link href="/streaks" data-testid="link-checkin-prompt" className="rise col-span-2 flex items-center justify-between rounded-[28px] border-2 border-dashed border-primary/50 bg-primary/5 px-5 py-4">
              <div><p className="font-medium">No check-in yet today</p><p className="text-sm text-muted-foreground">Keep the {s.currentStreak > 0 ? `${s.currentStreak}-day streak` : 'streak'} going.</p></div>
              <ArrowUpRight className="h-5 w-5 text-primary" />
            </Link>
          )}
        </section>
      )}

      <section className="mt-8">
        <SectionTitle title="Next up" href="/dates" />
        {dates.isLoading ? <Skeleton className="h-28 rounded-[28px]" /> : dates.isError ? (
          <ErrorState error={dates.error} onRetry={() => dates.refetch()} label="Dates" />
        ) : nextDate ? (
          <Link href="/dates" data-testid="card-next-date" className="stub block rounded-[28px] bg-accent p-5 text-accent-foreground transition active:scale-[.99]">
            <p className="font-mono text-[10px] uppercase tracking-widest">{fmtDate(nextDate.date, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
            <p className="font-display mt-1 text-2xl">{nextDate.title}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              {nextDate.time && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{nextDate.time}</span>}
              {nextDate.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{nextDate.location}</span>}
            </div>
          </Link>
        ) : (
          <Link href="/dates" data-testid="link-plan-date" className="flex items-center justify-between rounded-[28px] border border-foreground/10 bg-card px-5 py-5">
            <span><span className="font-display block text-xl">Nothing on the calendar.</span><span className="text-sm text-muted-foreground">Plan something small for this week.</span></span>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground"><Plus className="h-5 w-5" /></span>
          </Link>
        )}
      </section>

      <section className="mt-8">
        <SectionTitle title="Lately" href="/memories" />
        {memories.isLoading ? <Skeleton className="h-40 rounded-[28px]" /> : memories.isError ? (
          <ErrorState error={memories.error} onRetry={() => memories.refetch()} label="Memories" />
        ) : recent.length === 0 ? (
          <Link href="/memories" data-testid="link-first-memory" className="block rounded-[28px] border border-dashed border-foreground/20 px-5 py-8 text-center">
            <p className="font-display text-xl">Your first page is blank.</p>
            <p className="mt-1 text-sm text-muted-foreground">Write down something from today, however small.</p>
          </Link>
        ) : (
          <div className="space-y-3">
            {recent.map((m, i) => (
              <Link key={m.id} href="/memories" data-testid={`card-recent-memory-${m.id}`} className="rise flex gap-3 rounded-[24px] bg-card p-3 shadow-[0_1px_0_hsl(var(--border))]" style={{ animationDelay: `${i * 60}ms` }}>
                {m.photoPath ? <Photo path={m.photoPath} alt={m.title} className="h-16 w-16 shrink-0 rounded-2xl" /> : <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-secondary font-display text-2xl italic">{m.title.charAt(0)}</div>}
                <div className="min-w-0 py-1">
                  <p className="truncate font-medium">{m.title}</p>
                  <div className="mt-1.5 flex items-center gap-2"><CategoryChip category={m.category} /><span className="font-mono text-[10px] text-muted-foreground">{fmtDate(m.date)}</span></div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, testid, href }: { label: string; value?: number; testid: string; href: string }) {
  return (
    <Link href={href} className="rise rounded-[24px] bg-card p-4 shadow-[0_1px_0_hsl(var(--border))] transition active:scale-[.98]">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      {value === undefined ? <Skeleton className="mt-2 h-9 w-12" /> : <p data-testid={testid} className="font-display text-4xl">{value}</p>}
    </Link>
  );
}

function SectionTitle({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="font-display text-2xl">{title}</h2>
      <Link href={href} className="font-mono text-[11px] uppercase tracking-widest text-primary">See all</Link>
    </div>
  );
}
