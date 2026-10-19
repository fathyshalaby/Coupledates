import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, CalendarPlus, Clock, Info, MapPin, RotateCw, Sparkles, UserRound, Video, Wallet } from 'lucide-react';
import { useAskDateAssistant, type AssistantTurn, type DateIdea } from '@workspace/api-client-react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { CategoryChip, ErrorState, PageHeader } from '@/components/bits';
import { DateForm, type DatePrefill } from '@/components/date-form';
import { errMsg, errStatus, useAssistantQ, useInvalidate, usePreferencesQ } from '@/lib/data';
import { cn } from '@/lib/utils';
import { useBillingStatusQ, useBillingSync } from '@/lib/billing';
import { Paywall } from '@/components/paywall';
import { useRefreshBilling } from '@workspace/api-client-react';

const CHIPS = [
  { label: 'Online date', prompt: 'We’re apart this week — give us an online date over video that still feels close.' },
  { label: 'Cook-along call', prompt: 'An online cook-along we can do together on a video call from two kitchens.' },
  { label: 'Online game night', prompt: 'A playful online game night for two over a call.' },
  { label: 'Watch party', prompt: 'A cosy online watch party we can sync up from different places.' },
  { label: 'Budget-friendly', prompt: 'Something lovely that costs almost nothing this weekend.' },
  { label: 'Surprise me', prompt: 'Surprise us with something we haven’t thought of.' },
  { label: 'Rainy evening', prompt: 'A cosy indoor evening for a rainy weeknight.' },
  { label: 'Anniversary', prompt: 'Ideas for a special anniversary date that fits us.' },
];

function ideaNotes(i: DateIdea): string {
  const parts = [i.description, i.whyBoth && `Why it fits us: ${i.whyBoth}`, i.steps.length ? `Plan:\n${i.steps.map((s, n) => `${n + 1}. ${s}`).join('\n')}` : '', i.estimatedCost && `Rough cost: ${i.estimatedCost}`, 'Suggested by the date concierge — nothing is booked; check venues and times yourselves.'];
  return parts.filter(Boolean).join('\n\n').slice(0, 5000);
}

export default function AssistantPage() {
  const prefs = usePreferencesQ();
  const history = useAssistantQ();
  const invalidate = useInvalidate();
  const [, navigate] = useLocation();
  const [msg, setMsg] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [proposing, setProposing] = useState<DatePrefill | null>(null);
  const billing = useBillingStatusQ();
  const sync = useBillingSync();
  const refresh = useRefreshBilling({ mutation: { onSuccess: (d) => sync(d) } });
  const ask = useAskDateAssistant({ mutation: { onSuccess: () => { invalidate(['assistant']); setMsg(''); }, onError: (e) => { if (errStatus(e) === 402) sync(); } } });
  const paidError = ask.isError && errStatus(ask.error) === 402;
  const locked = !billing.data?.entitled || !!billing.data?.verificationPending || paidError;

  useEffect(() => {
    if (!ask.isPending) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [ask.isPending]);

  const mine = prefs.data?.find((p) => p.isYou);
  const partner = prefs.data?.find((p) => !p.isYou);
  const needsProfile = prefs.isSuccess && !mine;
  const profileError = ask.isError && errStatus(ask.error) === 409;

  const send = (text: string) => {
    const t = text.trim();
    if (!t || ask.isPending || needsProfile || locked) return;
    setLastPrompt(t);
    ask.mutate({ data: { message: t.slice(0, 1500) } });
  };
  const onSubmit = (e: FormEvent) => { e.preventDefault(); send(msg); };
  const turns = history.data ?? [];

  return (
    <div>
      <PageHeader kicker="Date concierge" title={<>Ideas for <em className="text-primary">two</em></>} />

      {prefs.isLoading ? <Skeleton className="h-20 rounded-[24px]" /> : (needsProfile || profileError) ? (
        <Link href="/preferences" data-testid="card-assistant-setup" className="rise mb-5 block rounded-[28px] bg-foreground p-5 text-background">
          <p className="font-mono text-[10px] uppercase tracking-widest text-accent">One quick thing first</p>
          <p className="font-display mt-1 text-2xl">Tell it what you like.</p>
          <p className="mt-1 text-sm opacity-75">The concierge needs your interests, budget and city before it can suggest anything. Two minutes, four short steps.</p>
          <span className="mt-3 inline-block rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Set up my profile</span>
        </Link>
      ) : (
        <p data-testid="text-profile-basis" className="mb-4 flex items-start gap-2 text-xs text-muted-foreground"><UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {partner ? `Ideas use both your profile and ${partner.displayName}’s.` : 'Ideas use your profile only — your partner hasn’t filled theirs in yet.'} <Link href="/preferences" className="underline">Edit</Link></p>
      )}

      {!billing.isLoading && locked && (
        <div className="mb-4">{billing.isError ? <ErrorState error={billing.error} onRetry={() => billing.refetch()} label="Your plan" /> : <Paywall feature="assistant" status={billing.data} onRetry={() => refresh.mutate()} retrying={refresh.isPending} />}</div>
      )}
      <form onSubmit={onSubmit} className="rounded-[26px] bg-card p-3 shadow-[0_1px_0_hsl(var(--border)),0_20px_40px_-30px_hsl(330_40%_20%/.5)]">
        <label htmlFor="ask" className="sr-only">Ask the date concierge</label>
        <Textarea id="ask" data-testid="input-assistant-message" maxLength={1500} disabled={needsProfile || ask.isPending || locked} value={msg} onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(msg); } }}
          placeholder={needsProfile ? 'Set up your profile to start asking.' : 'What kind of date are you in the mood for?'} className="min-h-20 resize-none border-0 bg-transparent text-[15px] shadow-none focus-visible:ring-0" />
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
            {CHIPS.map((c) => (
              <button type="button" key={c.label} data-testid={`chip-prompt-${c.label.toLowerCase().replace(/\W+/g, '-')}`} disabled={needsProfile || ask.isPending || locked} onClick={() => setMsg(c.prompt)} className="shrink-0 rounded-full bg-secondary px-3 py-1.5 text-xs transition active:scale-95 disabled:opacity-40">{c.label}</button>
            ))}
          </div>
          <button data-testid="button-ask" disabled={!msg.trim() || ask.isPending || needsProfile || locked} aria-label="Ask" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition active:scale-90 disabled:opacity-40"><ArrowUp className="h-5 w-5" /></button>
        </div>
      </form>
      <p className="mt-2 flex items-start gap-1.5 px-1 text-[11px] text-muted-foreground"><Info className="mt-0.5 h-3 w-3 shrink-0" />Shared history — your partner sees these questions and ideas too. Suggestions aren’t bookings; venues and prices aren’t verified. An operating-cost safeguard currently limits requests to 20 per space in 24 hours; this is not a paid-plan allowance.</p>

      <div className="mt-6 space-y-6">
        <AnimatePresence>
          {ask.isPending && (
            <motion.div key="pending" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} data-testid="state-assistant-thinking">
              <Bubble text={lastPrompt} />
              <div className="mt-3 rounded-[26px] bg-card p-5 shadow-[0_1px_0_hsl(var(--border))]">
                <div className="flex items-center gap-2 text-sm"><Sparkles className="h-4 w-4 animate-pulse text-primary" /><span>{elapsed < 8 ? 'Reading both your profiles…' : elapsed < 25 ? 'Sketching ideas that suit you both…' : 'Still working — this can take up to a minute.'}</span><span className="ml-auto font-mono text-xs text-muted-foreground">{elapsed}s</span></div>
                <div className="mt-4 space-y-2"><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-2/3" /><Skeleton className="mt-3 h-24 rounded-[20px]" /></div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {ask.isError && !profileError && !paidError && (
          <div role="alert" data-testid="state-assistant-error" className="rounded-[24px] border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="font-medium">The concierge couldn’t answer that one.</p><p className="text-muted-foreground">{errMsg(ask.error)}</p>
            <button data-testid="button-assistant-retry" disabled={locked} onClick={() => send(lastPrompt)} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs text-background"><RotateCw className="h-3.5 w-3.5" /> Try again</button>
          </div>
        )}

        {history.isLoading ? <div className="space-y-3"><Skeleton className="h-10 w-2/3 rounded-full" /><Skeleton className="h-44 rounded-[26px]" /></div>
          : history.isError ? <ErrorState error={history.error} onRetry={() => history.refetch()} label="Past ideas" />
          : turns.length === 0 && !ask.isPending ? (
            <div data-testid="state-assistant-empty" className="rounded-[28px] border border-dashed border-foreground/20 px-6 py-10 text-center">
              <Sparkles className="mx-auto h-7 w-7 text-primary" />
              <p className="font-display mt-3 text-2xl">Nothing asked yet.</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">Tap a prompt above or describe a mood. You’ll get a few tailored ideas you can turn into a proposal.</p>
            </div>
          ) : turns.map((t) => <Turn key={t.id} t={t} onPropose={(i) => setProposing({ title: i.title, category: i.category, mode: i.mode, location: i.location, notes: ideaNotes(i) })} />)}
      </div>

      <Drawer open={!!proposing} onOpenChange={(o) => !o && setProposing(null)}>
        <DrawerContent className="max-h-[94dvh] bg-background">
          {proposing && <DateForm plan={null} prefill={proposing} requireTime onDone={() => setProposing(null)} onCreated={(d) => navigate(`/dates/${d.id}`)} />}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function Bubble({ text }: { text: string }) {
  return <p className="ml-auto w-fit max-w-[85%] rounded-[22px] rounded-br-md bg-foreground px-4 py-2.5 text-sm text-background">{text}</p>;
}

function Turn({ t, onPropose }: { t: AssistantTurn; onPropose: (i: DateIdea) => void }) {
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} data-testid={`turn-${t.id}`}>
      <div className="flex flex-col items-end"><Bubble text={t.prompt} /><span className="mt-1 font-mono text-[10px] text-muted-foreground">{new Date(t.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></div>
      {t.message && <p className="mt-3 max-w-[92%] text-[15px] leading-relaxed">{t.message}</p>}
      <div className="mt-3 space-y-3">
        {t.ideas.map((i, n) => <IdeaCard key={n} i={i} n={n} turnId={t.id} onPropose={() => onPropose(i)} />)}
      </div>
    </motion.section>
  );
}

function IdeaCard({ i, n, turnId, onPropose }: { i: DateIdea; n: number; turnId: number; onPropose: () => void }) {
  const [open, setOpen] = useState(false);
  const hrs = i.durationMinutes >= 60 ? `${Math.round((i.durationMinutes / 60) * 10) / 10} h` : `${i.durationMinutes} min`;
  return (
    <article data-testid={`card-idea-${turnId}-${n}`} className={cn('overflow-hidden rounded-[26px] shadow-[0_1px_0_hsl(var(--border))]', n % 2 ? 'bg-card' : 'bg-[hsl(38_70%_96%)]')}>
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-1.5"><CategoryChip category={i.category} /><span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider">{i.mode === 'remote' ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}{i.mode === 'remote' ? 'Online' : 'In person'}</span></div>
        <h3 className="font-display mt-2 text-2xl leading-tight">{i.title}</h3>
        <p className="mt-1.5 text-sm text-foreground/80">{i.description}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {i.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{i.location}</span>}
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{hrs}</span>
          {i.estimatedCost && <span className="flex items-center gap-1"><Wallet className="h-3 w-3" />{i.estimatedCost}</span>}
        </div>
        {i.whyBoth && <p className="mt-3 rounded-2xl bg-secondary/70 px-3 py-2 text-sm"><span className="font-mono text-[10px] uppercase tracking-widest text-primary">Why you both · </span>{i.whyBoth}</p>}
        <AnimatePresence initial={false}>
          {open && (
            <motion.ol initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 space-y-1.5 overflow-hidden">
              {i.steps.map((s, k) => <li key={k} className="flex gap-2 text-sm"><span className="font-mono text-xs text-primary">{String(k + 1).padStart(2, '0')}</span>{s}</li>)}
            </motion.ol>
          )}
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-2 border-t border-foreground/10 px-4 py-2.5">
        <button data-testid={`button-idea-steps-${turnId}-${n}`} aria-expanded={open} onClick={() => setOpen((v) => !v)} className="rounded-full px-3 py-1.5 text-xs hover:bg-foreground/5">{open ? 'Hide plan' : `See ${i.steps.length} steps`}</button>
        <button data-testid={`button-propose-idea-${turnId}-${n}`} onClick={onPropose} className="ml-auto flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition active:scale-95"><CalendarPlus className="h-3.5 w-3.5" /> Propose this</button>
      </div>
    </article>
  );
}
