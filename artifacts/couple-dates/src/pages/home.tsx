import { useMemo } from 'react';
import { Link } from 'wouter';
import { ArrowUpRight, CalendarClock, Camera, ClipboardList, Clock, Inbox, Lightbulb, MapPin, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
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

  const you = prefs.data?.find(p => p.isYou)?.displayName;

  return (
    <div>
      <section className="rise">
        <p className="eyebrow">{greeting()}{you ? `, ${you}` : ''}</p>
        <h1 className="font-display mt-1.5 text-[2.25rem] font-medium leading-[1.02] break-words sm:text-[2.75rem]" data-testid="text-couple-names">
          {couple.yourName} <span className="font-normal italic text-primary">&amp;</span> {couple.partnerName}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Together since {fmtDate(couple.anniversary, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
      </section>

      {(active || inbox.length > 0 || needsProfile) && (
        <section className="mt-6 space-y-2.5" aria-label="Needs you">
          {active && (
            <Link href={`/dates/${active.id}`} data-testid="card-action-active" className="rise flex items-center gap-4 rounded-[20px] bg-primary p-4 text-primary-foreground transition active:scale-[.99]">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-background/15"><Camera className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="block text-xs font-medium opacity-85">Happening now</span><span className="font-display block truncate text-lg">{active.title}</span><span className="block text-sm opacity-85">Snap a photo for the album.</span></span>
              <ArrowUpRight className="h-5 w-5 shrink-0 opacity-80" />
            </Link>
          )}
          {inbox.length > 0 && (
            <Link href={inbox.length === 1 ? `/dates/${inbox[0].id}` : '/dates'} data-testid="card-action-inbox" className="rise surface surface-link flex items-center gap-4 border-[hsl(38_60%_75%)] bg-[hsl(41_78%_94%)] p-4">
              <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[hsl(38_70%_85%)] text-[hsl(28_55%_28%)]"><Inbox className="h-5 w-5" /><span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-[hsl(41_78%_94%)] bg-primary px-1 text-[10px] font-semibold text-primary-foreground tnum">{inbox.length}</span></span>
              <span className="min-w-0 flex-1"><span className="block font-medium">{inbox.length === 1 ? 'Your partner asked you out' : `${inbox.length} proposals need you`}</span><span className="block truncate text-sm text-muted-foreground">{inbox.length === 1 ? inbox[0].title : 'Accept, decline or suggest another time.'}</span></span>
              <ArrowUpRight className="h-5 w-5 shrink-0 text-primary" />
            </Link>
          )}
          {needsProfile && (
            <Link href="/preferences" data-testid="card-action-profile" className="rise surface surface-link flex items-center gap-4 p-4">
              <span className="icon-tile h-11 w-11"><ClipboardList className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="block font-medium">What do you love doing?</span><span className="block text-sm text-muted-foreground">Four quick steps so date ideas fit you both. Skip anytime.</span></span>
              <ArrowUpRight className="h-5 w-5 shrink-0 text-primary" />
            </Link>
          )}
        </section>
      )}

      {summary.isError ? (
        <div className="mt-6"><ErrorState error={summary.error} onRetry={() => summary.refetch()} label="Your overview" /></div>
      ) : (
        <section className="rise surface mt-6 overflow-hidden" aria-label="Overview">
          <div className="grid grid-cols-2 sm:grid-cols-4">
            <div className="p-4">
              <p className="eyebrow">Days together</p>
              {s ? <p data-testid="text-days-together" className="font-display mt-1 text-[2rem] leading-none tnum">{s.daysTogether.toLocaleString()}</p> : <Skeleton className="mt-2 h-8 w-20" />}
            </div>
            <div className="border-l border-border p-4">
              <p className="eyebrow">Streak</p>
              {s ? <p data-testid="text-current-streak" className="font-display mt-1 text-[2rem] leading-none tnum">{s.currentStreak}<span className="ml-1 font-sans text-sm text-muted-foreground">day{s.currentStreak === 1 ? '' : 's'}</span></p> : <Skeleton className="mt-2 h-8 w-14" />}
            </div>
            <Stat label="Memories" value={s?.memoryCount} testid="text-memory-count" href="/memories" className="sm:border-l" />
            <Stat label="Dates done" value={s?.completedDates} testid="text-completed-dates" href="/dates" className="border-l" />
          </div>
          {s && !s.checkedInToday && (
            <Link href="/streaks" data-testid="link-checkin-prompt" className="flex min-h-[52px] items-center justify-between gap-3 border-t border-border bg-secondary/50 px-4 py-3 transition-colors hover:bg-secondary">
              <span className="flex min-w-0 items-center gap-3"><span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden /><span className="min-w-0"><span className="block text-sm font-medium">No check-in yet today</span><span className="block text-xs text-muted-foreground">Keep the {s.currentStreak > 0 ? `${s.currentStreak}-day streak` : 'streak'} going.</span></span></span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-primary" />
            </Link>
          )}
        </section>
      )}

      <section className="mt-9">
        <SectionTitle title="Next up" href="/dates" />
        {dates.isLoading ? <Skeleton className="h-28 rounded-[20px]" /> : dates.isError ? (
          <ErrorState error={dates.error} onRetry={() => dates.refetch()} label="Dates" />
        ) : nextDate ? (
          <Link href={`/dates/${nextDate.id}`} data-testid="card-next-date" className="surface surface-link flex items-stretch overflow-hidden">
            <span className="flex w-[72px] shrink-0 flex-col items-center justify-center border-r border-border bg-secondary/40 py-4 text-center">
              <span className="text-[11px] font-medium uppercase tracking-wide text-primary">{fmtDate(nextDate.date, { month: 'short' })}</span>
              <span className="font-display text-[1.9rem] leading-none tnum">{fmtDate(nextDate.date, { day: 'numeric' })}</span>
              <span className="mt-0.5 text-[11px] text-muted-foreground">{fmtDate(nextDate.date, { weekday: 'short' })}</span>
            </span>
            <span className="min-w-0 flex-1 p-4">
              <span className="flex items-start justify-between gap-2"><span className="font-display block text-xl leading-tight break-words">{nextDate.title}</span><StatusBadge status={nextDate.status} className="shrink-0" /></span>
              <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
                {nextDate.time && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{fmtTime(nextDate.time)}</span>}
                {nextDate.location && <span className="flex min-w-0 items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{nextDate.location}</span></span>}
              </span>
            </span>
          </Link>
        ) : (
          <Link href="/dates" data-testid="link-plan-date" className="surface surface-link flex items-center justify-between gap-4 p-5">
            <span><span className="font-display block text-xl">Nothing on the calendar.</span><span className="text-sm text-muted-foreground">Propose something small for this week.</span></span>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Plus className="h-5 w-5" /></span>
          </Link>
        )}
        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
          <Link href="/assistant" data-testid="card-action-assistant" className="surface surface-link flex items-center gap-3 p-3.5">
            <span className="icon-tile"><Lightbulb className="h-[18px] w-[18px]" /></span>
            <span className="min-w-0 flex-1 text-sm"><span className="block font-medium">Need an idea?</span><span className="block text-muted-foreground">Ask the concierge. It knows your tastes.</span></span>
          </Link>
          <Link href="/calendar" data-testid="card-action-calendar" className="surface surface-link flex items-center gap-3 p-3.5">
            <span className="icon-tile"><CalendarClock className="h-[18px] w-[18px]" /></span>
            <span className="min-w-0 flex-1 text-sm"><span className="block font-medium">When are we both free?</span><span className="block text-muted-foreground">Compare Google Calendar free/busy.</span></span>
          </Link>
        </div>
      </section>

      <section className="mt-9">
        <SectionTitle title="Lately" href="/memories" />
        {memories.isLoading ? <Skeleton className="h-40 rounded-[20px]" /> : memories.isError ? (
          <ErrorState error={memories.error} onRetry={() => memories.refetch()} label="Memories" />
        ) : recent.length === 0 ? (
          <Link href="/memories" data-testid="link-first-memory" className="surface surface-link block px-5 py-8 text-center">
            <p className="font-display text-xl">Your first page is blank.</p>
            <p className="mt-1 text-sm text-muted-foreground">Write down something from today, however small.</p>
          </Link>
        ) : (
          <div className="surface divide-y divide-border overflow-hidden">
            {recent.map((m) => (
              <Link key={m.id} href="/memories" data-testid={`card-recent-memory-${m.id}`} className="flex items-center gap-3 p-3 transition-colors hover:bg-foreground/[0.03]">
                {m.photoPath ? <Photo path={m.photoPath} alt={m.title} className="h-14 w-14 shrink-0 rounded-xl" /> : <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-secondary font-display text-xl italic text-primary">{m.title.charAt(0)}</div>}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.title}</p>
                  <div className="mt-1 flex items-center gap-2"><CategoryChip category={m.category} /><span className="text-xs text-muted-foreground">{fmtDate(m.date)}</span></div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, testid, href, className }: { label: string; value?: number; testid: string; href: string; className?: string }) {
  return (
    <Link href={href} className={cn('border-t border-border p-4 transition-colors hover:bg-foreground/[0.03] sm:border-t-0', className)}>
      <p className="eyebrow">{label}</p>
      {value === undefined ? <Skeleton className="mt-2 h-8 w-12" /> : <p data-testid={testid} className="font-display mt-1 text-[2rem] leading-none tnum">{value}</p>}
    </Link>
  );
}

function SectionTitle({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="font-display text-[1.4rem] font-medium">{title}</h2>
      <Link href={href} className="rounded-md px-1 py-1 text-sm font-medium text-primary hover:underline">See all</Link>
    </div>
  );
}
