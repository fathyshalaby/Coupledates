import { ArrowUpRight, Camera, Check, Lightbulb, Repeat2, UsersRound } from 'lucide-react';
import { Link } from 'wouter';
import type { DatePlan, Memory, PartnerPreferences } from '@workspace/api-client-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { Couple } from '@workspace/api-client-react';
import { todayISO } from '@/lib/data';

type FlywheelProps = {
  couple: Couple;
  dates?: DatePlan[];
  memories?: Memory[];
  preferences?: PartnerPreferences[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

type StageKey = 'idea' | 'agree' | 'do' | 'remember' | 'repeat';

const STAGES: { key: StageKey; label: string; icon: typeof Lightbulb }[] = [
  { key: 'idea', label: 'Idea', icon: Lightbulb },
  { key: 'agree', label: 'Agree', icon: Check },
  { key: 'do', label: 'Do', icon: UsersRound },
  { key: 'remember', label: 'Remember', icon: Camera },
  { key: 'repeat', label: 'Repeat', icon: Repeat2 },
];

export function CoupleFlywheel({ couple, dates = [], memories = [], preferences = [], isLoading, isError, onRetry }: FlywheelProps) {
  if (isLoading) {
    return (
      <section className="mt-6 rounded-[24px] border border-border bg-card p-4 sm:p-5" aria-label="Your shared rhythm" data-testid="couple-flywheel-loading">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-4 h-6 w-52" />
        <Skeleton className="mt-5 h-10 w-full rounded-xl" />
        <Skeleton className="mt-5 h-16 w-full rounded-2xl" />
      </section>
    );
  }

  if (isError) {
    return (
      <section className="mt-6 rounded-[24px] border border-border bg-card p-4 sm:p-5" aria-label="Your shared rhythm" data-testid="couple-flywheel-error">
        <p className="eyebrow">A small rhythm, just for two</p>
        <p className="mt-2 text-sm text-muted-foreground">Your shared plan could not load just now.</p>
        <button type="button" data-testid="button-retry-couple-flywheel" onClick={onRetry} className="mt-3 min-h-10 rounded-full border border-border px-4 text-sm font-medium hover:bg-foreground/[0.04]">Try again</button>
      </section>
    );
  }

  const today = todayISO();
  const pending = dates
    .filter((date) => date.status === 'proposed')
    .sort((a, b) => Number(b.canRespond) - Number(a.canRespond) || (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')));
  const needsResponse = pending.find((date) => date.canRespond);
  const nextPlanned = dates
    .filter((date) => date.status === 'planned' && date.date.slice(0, 10) >= today)
    .sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))[0];
  const active = dates.find((date) => date.status === 'active');
  const completedWithoutMemory = dates
    .filter((date) => date.status === 'completed' && !memories.some((memory) => memory.dateId != null && String(memory.dateId) === String(date.id)))
    .sort((a, b) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? '')))[0];
  const hasYourProfile = preferences.some((profile) => profile.isYou);
  const hasPartnerProfile = preferences.some((profile) => !profile.isYou);
  const nextMemory = memories.length > 0;

  let activeStage: StageKey = 'idea';
  if (couple.memberCount >= 2 && hasYourProfile && hasPartnerProfile) {
    if (nextMemory) activeStage = 'repeat';
    if (completedWithoutMemory) activeStage = 'remember';
    if (nextPlanned || active) activeStage = 'do';
    if (pending.length > 0) activeStage = 'agree';
  }

  let action: { href: string; title: string; detail: string; testId: string };
  if (couple.memberCount < 2) {
    action = {
      href: '/settings',
      title: 'Invite your person',
      detail: 'Bring them into this private space to start planning together.',
      testId: 'link-flywheel-invite',
    };
  } else if (!hasYourProfile || !hasPartnerProfile) {
    action = {
      href: '/preferences',
      title: 'Fill in your date preferences',
      detail: 'A little about what you both enjoy makes the ideas feel more like you.',
      testId: 'link-flywheel-preferences',
    };
  } else if (needsResponse) {
    action = {
      href: pending.length === 1 ? `/dates/${needsResponse.id}` : '/dates',
      title: 'Answer the date idea',
      detail: needsResponse.title,
      testId: 'link-flywheel-proposal',
    };
  } else if (pending.length > 0) {
    action = {
      href: '/dates',
      title: 'See the date idea',
      detail: 'Your partner has it now; there is nothing to do until they reply.',
      testId: 'link-flywheel-waiting',
    };
  } else if (active) {
    action = {
      href: `/dates/${active.id}?album=1`,
      title: 'Open your date album',
      detail: `${active.title} is happening now. Save a moment together.`,
      testId: 'link-flywheel-active',
    };
  } else if (nextPlanned) {
    action = {
      href: `/dates/${nextPlanned.id}`,
      title: 'Open your plan',
      detail: nextPlanned.title,
      testId: 'link-flywheel-planned',
    };
  } else if (completedWithoutMemory) {
    action = {
      href: `/dates/${completedWithoutMemory.id}?album=1`,
      title: 'Keep a memory from your date',
      detail: completedWithoutMemory.title,
      testId: 'link-flywheel-memory',
    };
  } else {
    action = {
      href: '/assistant',
      title: 'Find your next idea',
      detail: 'Start with something small that sounds good to both of you.',
      testId: 'link-flywheel-repeat',
    };
  }

  const message = couple.memberCount < 2
    ? 'A shared plan starts when your partner joins.'
    : !hasYourProfile || !hasPartnerProfile
      ? 'Make room for both of your tastes.'
      : needsResponse
        ? needsResponse.canRespond ? 'There is an idea waiting for your answer.' : 'An idea is with your partner.'
        : active
          ? 'You are in the middle of making a memory.'
          : nextPlanned
            ? 'The next time together is on the calendar.'
            : completedWithoutMemory
              ? 'Your date is done; its album is ready for a memory.'
              : nextMemory
                ? 'A memory is here. Whenever you are ready, find what comes next.'
                : 'Bring one idea, then make a plan together.';

  return (
    <section className="rise mt-6 overflow-hidden rounded-[24px] border border-border bg-card" aria-labelledby="couple-flywheel-title" data-testid="couple-flywheel">
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow" data-testid="text-flywheel-kicker">Your shared rhythm</p>
          <span className="rounded-full bg-secondary/75 px-2.5 py-1 text-[11px] text-muted-foreground" data-testid="text-flywheel-privacy">Just the two of you</span>
        </div>
        <h2 id="couple-flywheel-title" className="font-display mt-2 text-[1.45rem] leading-tight sm:text-[1.65rem]">Good things, made together.</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground" data-testid="text-flywheel-current-state">{message}</p>

        <ol className="mt-5 grid grid-cols-5 gap-1" aria-label="Idea, agree, do, remember, repeat" data-testid="list-flywheel-stages">
          {STAGES.map(({ key, label, icon: Icon }, index) => {
            const current = activeStage === key;
            const reached = STAGES.findIndex((stage) => stage.key === activeStage) > index;
            return (
              <li key={key} data-testid={`stage-flywheel-${key}`} aria-current={current ? 'step' : undefined} className="min-w-0 text-center">
                <div className={`mx-auto grid h-8 w-8 place-items-center rounded-full border transition-colors ${current ? 'border-primary bg-primary text-primary-foreground' : reached ? 'border-primary/25 bg-secondary text-primary' : 'border-border bg-background text-muted-foreground'}`}>
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                <span className={`mt-1.5 block truncate text-[10px] leading-tight sm:text-[11px] ${current ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{label}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <Link href={action.href} data-testid={action.testId} className="group flex min-h-[76px] items-center gap-3 border-t border-border bg-secondary/40 px-4 py-3.5 transition-colors hover:bg-secondary/70 sm:px-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <ArrowUpRight className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-medium uppercase tracking-wide text-primary">A good next step</span>
          <span className="mt-0.5 block font-medium leading-tight" data-testid="text-flywheel-action-title">{action.title}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground" data-testid="text-flywheel-action-detail">{action.detail}</span>
        </span>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
      </Link>
    </section>
  );
}
