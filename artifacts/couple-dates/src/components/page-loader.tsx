import { lazy, Suspense, type ComponentType } from 'react';
import { useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Skeleton } from '@/components/ui/skeleton';

export function PageLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="mx-auto max-w-xl space-y-4 px-5 py-12" data-testid="state-loading-page">
      <span className="sr-only">Loading your space…</span>
      <div aria-hidden="true" className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-32 w-full rounded-[28px]" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-[24px]" />
          <Skeleton className="h-24 rounded-[24px]" />
        </div>
      </div>
    </div>
  );
}

function PageLoadError() {
  return (
    <section role="alert" className="surface mx-auto my-12 max-w-md space-y-3 p-6 text-center" data-testid="state-page-error">
      <h1 className="font-display text-2xl">This page couldn’t open</h1>
      <p className="text-sm text-muted-foreground">Check your connection, then reload to try again.</p>
      <button type="button" className="min-h-11 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground" onClick={() => window.location.reload()}>
        Reload page
      </button>
    </section>
  );
}

/** Declare once at module scope: a render must never create a new lazy type. */
export function lazyPage(load: () => Promise<{ default: ComponentType }>) {
  const Page = lazy(load);
  return function LazyPage() {
    const [location] = useLocation();
    return (
      <ErrorBoundary resetKey={location} FallbackComponent={PageLoadError}>
        <Suspense fallback={<PageLoading />}>
          <Page />
        </Suspense>
      </ErrorBoundary>
    );
  };
}
