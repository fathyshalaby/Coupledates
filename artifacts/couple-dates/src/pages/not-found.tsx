import { Link } from 'wouter';
import { TwoRings } from '@/components/bits';

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
      <TwoRings size={72} />
      <p className="font-mono mt-6 text-[11px] uppercase tracking-[0.25em] text-primary">404</p>
      <h1 className="font-display mt-2 text-4xl">This page wandered off.</h1>
      <p className="mt-2 max-w-xs text-muted-foreground">Nothing was written here. Let's get you back to somewhere familiar.</p>
      <Link href="/" data-testid="link-home-404" className="mt-6 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background">Take me home</Link>
    </div>
  );
}
