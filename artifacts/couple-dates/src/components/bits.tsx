import { useState, type ReactNode } from 'react';
import { ImageOff, RotateCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CATEGORY_TONE, errMsg, photoUrl } from '@/lib/data';
import { cn } from '@/lib/utils';

export function PageHeader({ kicker, title, children }: { kicker: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="rise mb-6 flex items-end justify-between gap-4">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">{kicker}</p>
        <h1 className="font-display mt-1 text-[2.4rem] leading-[1] font-medium">{title}</h1>
      </div>
      {children}
    </header>
  );
}

export function ErrorState({ error, onRetry, label = 'This page' }: { error: unknown; onRetry: () => void; label?: string }) {
  return (
    <div data-testid="state-error" className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-center">
      <p className="font-display text-xl">{label} couldn't load.</p>
      <p className="mt-1 text-sm text-muted-foreground">{errMsg(error)}</p>
      <button data-testid="button-retry" onClick={onRetry} className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm text-background active:scale-95 transition-transform">
        <RotateCw className="h-4 w-4" /> Try again
      </button>
    </div>
  );
}

export function EmptyState({ title, body, action, art }: { title: string; body: string; action?: ReactNode; art?: ReactNode }) {
  return (
    <div data-testid="state-empty" className="rise rounded-3xl border border-dashed border-foreground/20 bg-card/60 px-6 py-10 text-center">
      <div className="mx-auto mb-4 flex justify-center">{art ?? <TwoRings />}</div>
      <p className="font-display text-2xl">{title}</p>
      <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function TwoRings({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 100 60" aria-hidden>
      <circle cx="38" cy="30" r="22" fill="none" stroke="hsl(var(--primary))" strokeWidth="6" />
      <circle cx="62" cy="30" r="22" fill="none" stroke="hsl(var(--chart-2))" strokeWidth="6" />
    </svg>
  );
}

export function CategoryChip({ category, className }: { category: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider', CATEGORY_TONE[category] ?? 'bg-muted', className)}>
      {category}
    </span>
  );
}

export function Photo({ path, alt, className }: { path?: string | null; alt: string; className?: string }) {
  const [state, setState] = useState<'loading' | 'ok' | 'err'>('loading');
  const src = photoUrl(path);
  if (!src) return null;
  return (
    <div className={cn('relative overflow-hidden bg-muted', className)}>
      {state === 'loading' && <Skeleton className="absolute inset-0 rounded-none" />}
      {state === 'err' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
          <ImageOff className="h-5 w-5" />
          <span className="text-xs">Photo unavailable</span>
        </div>
      ) : (
        <img src={src} alt={alt} loading="lazy" onLoad={() => setState('ok')} onError={() => setState('err')} className={cn('h-full w-full object-cover transition-opacity duration-500', state === 'ok' ? 'opacity-100' : 'opacity-0')} />
      )}
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" data-testid="state-loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-3xl bg-foreground/[0.06]" />
      ))}
    </div>
  );
}

export function Stars({ value, onChange, size = 'md', testid }: { value: number | null | undefined; onChange?: (v: number) => void; size?: 'sm' | 'md'; testid?: string }) {
  const v = value ?? 0;
  return (
    <div className="flex gap-1" data-testid={testid}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          aria-label={`${n} of 5`}
          data-testid={testid ? `${testid}-${n}` : undefined}
          className={cn('rounded-full transition-transform', onChange && 'active:scale-75 hover:-translate-y-0.5', size === 'sm' ? 'h-3 w-3' : 'h-7 w-7')}
        >
          <span className={cn('block h-full w-full rounded-full border-2 transition-colors', n <= v ? 'border-primary bg-primary' : 'border-foreground/20 bg-transparent')} />
        </button>
      ))}
    </div>
  );
}
