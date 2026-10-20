import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Check, ExternalLink, Loader2, RotateCw, ShieldCheck } from 'lucide-react';
import { useCancelBilling, useCreateBillingCheckout, useManageBilling, useRefreshBilling, useResumeBilling, type BillingStatus } from '@workspace/api-client-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState, PageHeader } from '@/components/bits';
import { useToast } from '@/hooks/use-toast';
import { billingPhase, fmtPeriod, priceLine, safeWhopUrl, useBillingAnalytics, useBillingStatusQ, useBillingSync, type BillingPhase } from '@/lib/billing';
import { trackUpgradeEntry } from '@/lib/billing-analytics';
import { errMsg } from '@/lib/data';

const POLL_WINDOW = 3 * 60_000;

const PLUS = ['Date concierge: ideas shaped around both your profiles', 'Yearly recap of your memories, dates and check-ins'];
const FREE = ['Memories and photos', 'Date proposals and approvals', 'Calendars and reminders', 'Daily streaks and your profile'];

export default function BillingPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const sync = useBillingSync();
  const analytics = useBillingAnalytics();
  const returning = useRef(new URLSearchParams(window.location.search).get('checkout') === 'return').current;
  const [pollUntil, setPollUntil] = useState<number | null>(returning ? Date.now() + POLL_WINDOW : null);
  const [now, setNow] = useState(Date.now());
  const polling = pollUntil !== null && now < pollUntil;
  const q = useBillingStatusQ(polling);
  const s = q.data;
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'cancel' | 'resume' | null>(null);

  const refresh = useRefreshBilling({ mutation: { onSuccess: (d) => sync(d) } });
  const refreshRef = useRef(refresh.mutate);
  refreshRef.current = refresh.mutate;

  const returnHandled = useRef(false);
  useEffect(() => {
    if (returning && !returnHandled.current) {
      returnHandled.current = true;
      analytics.checkoutReturned();
      refreshRef.current();
      navigate('/billing', { replace: true });
    }
  }, [returning, navigate, analytics]);
  useEffect(() => {
    if (pollUntil === null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pollUntil]);
  // Keep polling while a checkout is pending on the server.
  useEffect(() => { if (s?.checkoutPending && !s.entitled && pollUntil === null) setPollUntil(Date.now() + POLL_WINDOW); }, [s?.checkoutPending, s?.entitled, pollUntil]);
  useEffect(() => { if (s?.entitled && pollUntil !== null) setPollUntil(null); }, [s?.entitled, pollUntil]);

  const go = (raw: string, what: string) => {
    const url = safeWhopUrl(raw);
    if (!url) { toast({ title: `${what} link looked wrong`, description: 'We did not open it. Please try again in a moment.', variant: 'destructive' }); return; }
    setOpenUrl(url);
    window.location.assign(url);
  };
  const checkout = useCreateBillingCheckout({ mutation: {
    onSuccess: (d) => { analytics.checkoutCreated(d.resumed); setPollUntil(Date.now() + POLL_WINDOW); sync(); go(d.url, 'Checkout'); },
    onError: (e) => { toast({ title: 'Checkout could not start', description: errMsg(e), variant: 'destructive' }); sync(); },
  } });
  const manage = useManageBilling({ mutation: { onSuccess: (d) => go(d.url, 'Billing'), onError: (e) => toast({ title: 'Could not open billing', description: errMsg(e), variant: 'destructive' }) } });
  const cancel = useCancelBilling({ mutation: { onSuccess: (d) => { analytics.renewalConfirmed('cancel', d); sync(d); setConfirm(null); toast({ title: 'Renewal stopped', description: 'Plus stays on until the end of the paid period.' }); }, onError: (e) => toast({ title: 'Could not stop renewal', description: errMsg(e), variant: 'destructive' }) } });
  const resume = useResumeBilling({ mutation: { onSuccess: (d) => { analytics.renewalConfirmed('resume', d); sync(d); setConfirm(null); toast({ title: 'Renewal back on' }); }, onError: (e) => toast({ title: 'Could not resume', description: errMsg(e), variant: 'destructive' }) } });
  const busy = checkout.isPending || manage.isPending || cancel.isPending || resume.isPending;

  if (q.isLoading) return <div><PageHeader kicker="Plan" title={<>Couple Dates <em className="text-primary">Plus</em></>} /><div className="space-y-3" data-testid="state-billing-loading"><Skeleton className="h-48 rounded-[28px]" /><Skeleton className="h-32 rounded-[24px]" /></div></div>;
  if (q.isError || !s) return <div><PageHeader kicker="Plan" title={<>Couple Dates <em className="text-primary">Plus</em></>} /><ErrorState error={q.error} onRetry={() => q.refetch()} label="Your plan" /></div>;

  const phase = billingPhase(s);
  const end = fmtPeriod(s.currentPeriodEnd);
  const timedOut = pollUntil !== null && !polling && !s.entitled;
  const checking = (polling || refresh.isPending) && !s.entitled;

  return (
    <div>
      <PageHeader kicker="Plan" title={<>Couple Dates <em className="text-primary">Plus</em></>} />
      <p data-testid="text-beta-free-access" className="mb-4 rounded-[20px] bg-secondary/70 px-4 py-3 text-sm">Beta access: the AI date assistant, yearly recap and all other features are free. Existing subscription renewals are not changed automatically; use Manage subscription below if you need to turn one off.</p>

      {(checking || timedOut) && (
        <div role="status" data-testid="state-billing-checking" className="rise mb-4 flex items-start gap-3 rounded-[24px] bg-accent/60 p-4 text-sm">
          {checking ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /> : <RotateCw className="mt-0.5 h-4 w-4 shrink-0" />}
          <div className="flex-1">
            <p className="font-medium">{checking ? 'Checking with the payment provider...' : 'Still waiting on confirmation.'}</p>
            <p className="text-foreground/70">{checking ? 'This page updates on its own once the payment is confirmed. It usually takes under a minute.' : 'If you completed checkout, confirmation can take a few more minutes. Nothing unlocks until it is confirmed.'}</p>
            {timedOut && <button data-testid="button-billing-check-again" disabled={refresh.isPending} onClick={() => { setPollUntil(Date.now() + POLL_WINDOW); refresh.mutate(); }} className="mt-2 rounded-full bg-foreground px-4 py-2 text-xs text-background disabled:opacity-50">Check again</button>}
          </div>
        </div>
      )}

      <StatusCard s={s} phase={phase} end={end} />

      {s.notice && <p data-testid="text-billing-notice" className="mt-3 rounded-2xl bg-secondary/70 px-4 py-2.5 text-sm">{s.notice}</p>}
      {refresh.isError && <p role="alert" className="mt-3 rounded-2xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{errMsg(refresh.error)}</p>}

      <div className="mt-4 space-y-2.5">
        {phase === 'verifying' && <Btn testid="button-billing-verify" onClick={() => refresh.mutate()} disabled={refresh.isPending} primary>{refresh.isPending ? 'Checking...' : 'Check status again'}</Btn>}

        {phase === 'free' && <p className="px-1 text-sm text-muted-foreground">All beta features are free. Paid plans and checkout are paused.</p>}

        {phase === 'pending' && <p data-testid="text-billing-partner-checkout" className="rounded-2xl border border-foreground/10 px-4 py-3 text-sm">Beta access is free. Starting or continuing paid checkout is paused.</p>}

        {(phase === 'active' || phase === 'ending' || phase === 'past_due') && (s.canManage ? (
          <>
            {phase === 'ending' && <Btn testid="button-billing-resume" onClick={() => setConfirm('resume')} disabled={busy} primary>Keep Plus renewing</Btn>}
            <Btn testid="button-billing-manage" onClick={() => manage.mutate()} disabled={busy} primary={phase === 'past_due'}>{manage.isPending ? 'Opening...' : phase === 'past_due' ? 'Update payment method' : 'Manage payment details'} <ExternalLink className="h-4 w-4" /></Btn>
            {phase === 'active' && <button data-testid="button-billing-cancel" onClick={() => setConfirm('cancel')} disabled={busy} className="w-full rounded-full py-3 text-sm text-muted-foreground underline-offset-4 hover:underline disabled:opacity-40">Stop renewal</button>}
          </>
        ) : <p data-testid="text-billing-partner-manages" className="rounded-2xl border border-foreground/10 px-4 py-3 text-sm">Your partner manages billing for this space.</p>)}

        {openUrl && <a href={openUrl} target="_blank" rel="noopener noreferrer" data-testid="link-billing-open-tab" className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground underline">Didn't open? Open it in a new tab <ExternalLink className="h-3 w-3" /></a>}
      </div>

      <section className="mt-8 grid gap-3 sm:grid-cols-[1.2fr_1fr]">
        <div className="rounded-[28px] bg-card p-5 shadow-[0_1px_0_hsl(var(--border))]">
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Plus adds</p>
          <ul className="mt-3 space-y-2">{PLUS.map((p) => <li key={p} className="flex gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{p}</li>)}</ul>
          <div className="perf my-4" />
          <p data-testid="text-billing-price" className="font-display text-3xl">US${s.price}<span className="text-base text-muted-foreground"> / couple</span></p>
          <p className="mt-1 text-xs text-muted-foreground">Billed every {s.billingIntervalDays} days, plus applicable taxes. One plan covers both of you. AI requests are subject to operational usage safeguards.</p>
        </div>
        <div className="rounded-[28px] border border-dashed border-foreground/20 p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Always free</p>
          <ul className="mt-3 space-y-2">{FREE.map((p) => <li key={p} className="flex gap-2 text-sm text-foreground/80"><Check className="mt-0.5 h-4 w-4 shrink-0 opacity-50" />{p}</li>)}</ul>
        </div>
      </section>

      <p className="mt-5 flex items-start gap-2 px-1 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Payment happens on Whop's secure checkout page; card details never touch Couple Dates. If you stop renewal, Plus stays on until the paid period ends, and every memory, photo and date stays readable and editable. Nothing is deleted.</p>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && !cancel.isPending && !resume.isPending && setConfirm(null)}>
        <AlertDialogContent className="rounded-[28px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl">{confirm === 'cancel' ? 'Stop renewal?' : 'Keep Plus renewing?'}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {confirm === 'cancel' ? (<>
                  <p>Your space won't be charged again. Plus stays on for both of you until {end ?? 'the end of the paid period'}.</p>
                  <p>After that, the concierge and recap pause. Memories, photos, dates, calendars, streaks and past ideas all stay, readable and editable.</p>
                </>) : (<>
                  <p>Renewal turns back on: {priceLine(s)}.</p>
                  <p>You won't be charged now. The next charge happens {end ? `on ${end}` : 'at the end of the current period'}.</p>
                </>)}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-billing-confirm-dismiss" className="rounded-full">Not now</AlertDialogCancel>
            <AlertDialogAction data-testid="button-billing-confirm" disabled={busy}
              onClick={(e) => { e.preventDefault(); if (confirm === 'cancel') cancel.mutate(); else resume.mutate(); }}
              className={`rounded-full ${confirm === 'cancel' ? 'bg-destructive text-destructive-foreground' : ''}`}>
              {cancel.isPending || resume.isPending ? 'Saving...' : confirm === 'cancel' ? 'Stop renewal' : 'Turn renewal on'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Btn({ children, onClick, disabled, primary, testid }: { children: ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean; testid: string }) {
  return <button data-testid={testid} onClick={onClick} disabled={disabled} className={`flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-medium transition active:scale-[.98] disabled:opacity-40 ${primary ? 'bg-primary text-primary-foreground' : 'bg-foreground/5'}`}>{children}</button>;
}

function StatusCard({ s, phase, end }: { s: BillingStatus; phase: BillingPhase; end: string | null }) {
  const m: Record<BillingPhase, { tag: string; title: string; body: string }> = {
    verifying: { tag: 'Status unknown', title: 'We can\'t verify your plan right now.', body: 'Plus features are paused until we can confirm with the payment provider. Your data is untouched.' },
    active: { tag: 'Plus', title: 'Plus is on for both of you.', body: end ? `Renews on ${end}.` : 'Renews automatically.' },
    ending: { tag: 'Plus, ending', title: `Plus stays on until ${end ?? 'the end of this period'}.`, body: 'Renewal is off. After that date your space returns to the free plan. Nothing is deleted.' },
    past_due: { tag: 'Payment issue', title: 'The last payment didn\'t go through.', body: s.canManage ? 'Update your payment method to keep Plus going.' : 'Your partner can update the payment method.' },
    pending: { tag: 'Checkout pending', title: s.isPayer ? 'Your checkout is waiting.' : 'Checkout in progress.', body: 'Plus turns on once the payment provider confirms it.' },
    free: { tag: 'Free beta', title: 'All features are free during beta.', body: 'The AI date assistant, yearly recap and everything else are included.' },
  };
  const c = m[phase];
  const plus = phase === 'active' || phase === 'ending';
  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} data-testid={`status-billing-${phase}`}
      className={`relative overflow-hidden rounded-[28px] p-6 ${plus ? 'bg-primary text-primary-foreground' : 'bg-foreground text-background'}`}>
      <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full border-[14px] border-current opacity-10" />
      <span className="inline-block rounded-full bg-background/15 px-3 py-1 font-mono text-[10px] uppercase tracking-widest">{c.tag}</span>
      <p className="font-display mt-3 text-3xl leading-tight">{c.title}</p>
      <p className="mt-2 text-sm opacity-80">{c.body}</p>
      {plus && end && <p data-testid="text-billing-period-end" className="mt-4 font-mono text-xs opacity-70">{phase === 'ending' ? 'Paid through' : 'Next renewal'} {end}</p>}
    </motion.section>
  );
}
