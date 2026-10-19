import { useMemo } from 'react';
import { Link } from 'wouter';
import { ArrowUpRight, CalendarClock, Camera, ClipboardList, Clock, Inbox, Lightbulb, MapPin, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryChip, ErrorState, Photo, StatusBadge } from '@/components/bits';
import { useCouple } from '@/lib/couple-context';
import { fmtDate, fmtTime, todayISO, useDatesQ, useMemoriesQ, usePreferencesQ, useSummaryQ } from '@/lib/data';

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
  const prefs = usePreferencesQ();
  const needsProfile = prefs.isSuccess && !prefs.data.some((p) => p.isYou);
  const inbox = useMemo(() => (dates.data ?? []).filter((d) => d.status === 'proposed' && d.canRespond), [dates.data]);
  const active = useMemo(() => (dates.data ?? []).find((d) => d.status === 'active'), [dates.data]);

  const nextDate = useMemo(() => {
    const t = todayISO();
    return (dates.data ?? []).filter((d) => d.status === 'active' || (d.status === 'planned' && d.date.slice(0, 10) >= t)).sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))[0];
  }, [dates.data]);
  const recent = useMemo(() => [...(memories.data ?? [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3), [memories.data]);
  const s = summary.data;

  return (
    <div>
      <section className="rise">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">{greeting()}, {prefs.data?.find(p => p.isYou)?.displayName ?? 'you two'}</p>
        <h1 className="font-display mt-2 text-[2.8rem] leading-[0.95]" data-testid="text-couple-names">
          {couple.yourName} <em className="text-primary">&amp;</em> {couple.partnerName}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Together since {fmtDate(couple.anniversary, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
      </section>

      <section className="mt-6 space-y-3" aria-label="Next actions">
        {active && (
          <Link href={`/dates/${active.id}`} data-testid="card-action-active" className="rise flex items-center gap-4 rounded-[28px] bg-primary p-5 text-primary-foreground shadow-[0_18px_36px_-20px_hsl(12_76%_40%/.9)]">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-background/20"><Camera className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><span className="font-mono block text-[10px] uppercase tracking-widest opacity-80">Happening now</span><span className="font-display block truncate text-xl">{active.title}</span><span className="text-sm opacity-80">Snap a photo for the album.</span></span>
          </Link>
        )}
        {inbox.length > 0 && (
          <Link href={inbox.length === 1 ? `/dates/${inbox[0].id}` : '/dates'} data-testid="card-action-inbox" className="rise flex items-center gap-4 rounded-[28px] bg-accent p-5 text-accent-foreground">
            <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-foreground text-background"><Inbox className="h-5 w-5" /><span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 font-mono text-[10px] text-primary-foreground">{inbox.length}</span></span>
            <span className="min-w-0 flex-1"><span className="font-display block text-xl">{inbox.length === 1 ? 'Your partner asked you out' : `${inbox.length} proposals need you`}</span><span className="block truncate text-sm opacity-80">{inbox.length === 1 ? inbox[0].title : 'Accept, decline or suggest another time.'}</span></span>
            <ArrowUpRight className="h-5 w-5" />
          </Link>
        )}
        {needsProfile && (
          <Link href="/preferences" data-testid="card-action-profile" className="rise flex items-center gap-4 rounded-[28px] border-2 border-dashed border-primary/50 bg-card p-5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-secondary text-primary"><ClipboardList className="h-5 w-5" /></span>
            <span className="flex-1"><span className="font-display block text-xl">What do you love doing?</span><span className="text-sm text-muted-foreground">Four quick steps so date ideas fit you both. Skip anytime.</span></span>
          </Link>
        )}
        <Link href="/assistant" data-testid="card-action-assistant" className="rise flex items-center gap-4 rounded-[28px] bg-card p-4 shadow-[0_1px_0_hsl(var(--border))]">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-foreground text-background"><Lightbulb className="h-4 w-4" /></span>
          <span className="flex-1 text-sm"><span className="block font-medium">Need an idea?</span><span className="text-muted-foreground">Ask the concierge — it knows your tastes.</span></span>
          <ArrowUpRight className="h-4 w-4 text-primary" />
        </Link>
        <Link href="/calendar" data-testid="card-action-calendar" className="rise flex items-center gap-4 rounded-[28px] bg-card p-4 shadow-[0_1px_0_hsl(var(--border))]">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-primary"><CalendarClock className="h-4 w-4" /></span>
          <span className="flex-1 text-sm"><span className="block font-medium">When are we both free?</span><span className="text-muted-foreground">Connect Google Calendar to compare free/busy.</span></span>
          <ArrowUpRight className="h-4 w-4 text-primary" />
        </Link>
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
          <Link href={`/dates/${nextDate.id}`} data-testid="card-next-date" className="stub block rounded-[28px] bg-accent p-5 text-accent-foreground transition active:scale-[.99]">
            <div className="flex items-center justify-between gap-2"><p className="font-mono text-[10px] uppercase tracking-widest">{fmtDate(nextDate.date, { weekday: 'long', month: 'short', day: 'numeric' })}</p><StatusBadge status={nextDate.status} /></div>
            <p className="font-display mt-1 text-2xl">{nextDate.title}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              {nextDate.time && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtTime(nextDate.time)}</span>}
              {nextDate.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{nextDate.location}</span>}
            </div>
          </Link>
        ) : (
          <Link href="/dates" data-testid="link-plan-date" className="flex items-center justify-between rounded-[28px] border border-foreground/10 bg-card px-5 py-5">
            <span><span className="font-display block text-xl">Nothing on the calendar.</span><span className="text-sm text-muted-foreground">Propose something small for this week.</span></span>
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
