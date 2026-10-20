import { Link } from 'wouter';
import { ArrowRight, BookHeart, RotateCw, Sparkles } from 'lucide-react';
import type { BillingStatus } from '@workspace/api-client-react';
import { priceLine } from '@/lib/billing';
import { trackUpgradeEntry } from '@/lib/billing-analytics';

const COPY = {
  assistant: { kicker: 'Couple Dates Plus', title: 'The date concierge is part of Plus.', body: 'Ask for ideas shaped around both your profiles, then turn any of them into a proposal. Your earlier ideas stay right here to read and propose.' },
  recap: { kicker: 'Couple Dates Plus', title: 'Your year in review is part of Plus.', body: 'A look back at the memories, dates and check-ins you two added, month by month. Everything you saved stays yours either way.' },
};

export function Paywall({ feature, status, onRetry, retrying }: { feature: 'assistant' | 'recap'; status?: BillingStatus | null; onRetry?: () => void; retrying?: boolean }) {
  const c = COPY[feature];
  const unsure = !status || status.verificationPending;
  const Icon = feature === 'assistant' ? Sparkles : BookHeart;
  return (
    <section data-testid={`paywall-${feature}`} className="rise relative overflow-hidden rounded-[28px] bg-foreground p-5 text-background">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary/40 blur-2xl" />
      <p className="relative flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-accent"><Icon className="h-3.5 w-3.5" />{c.kicker}</p>
      {unsure ? (
        <>
          <p className="font-display relative mt-2 text-2xl leading-tight">We couldn't confirm your plan just now.</p>
          <p className="relative mt-1.5 text-sm opacity-75">New requests are paused until your space's status is verified. Nothing is lost.</p>
          {onRetry && <button data-testid={`button-paywall-retry-${feature}`} disabled={retrying} onClick={onRetry} className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-background px-4 py-2 text-sm text-foreground transition active:scale-95 disabled:opacity-50"><RotateCw className={`h-3.5 w-3.5 ${retrying ? 'animate-spin' : ''}`} />{retrying ? 'Checking...' : 'Check again'}</button>}
        </>
      ) : (
        <>
          <p className="font-display relative mt-2 text-2xl leading-tight">{c.title}</p>
          <p className="relative mt-1.5 text-sm opacity-75">{c.body}</p>
          <p data-testid={`text-paywall-price-${feature}`} className="relative mt-3 font-mono text-[11px] opacity-70">{priceLine(status)}. One plan covers you both.</p>
          <Link href="/billing" onClick={() => trackUpgradeEntry(feature)} data-testid={`link-paywall-billing-${feature}`} className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition active:scale-95">See Plus <ArrowRight className="h-4 w-4" /></Link>
        </>
      )}
    </section>
  );
}
