import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight, Link2 } from 'lucide-react';
import { PageLoading } from '@/components/page-loader';
import { TwoRings } from '@/components/bits';
import { parseIncomingSocialShare, saveIncomingSocialInspiration } from '@/lib/social-inspiration';

export default function ShareTargetPage() {
  const [location, setLocation] = useLocation();
  const handled = useRef(false);
  const [problem, setProblem] = useState<'unsupported' | 'storage' | null>(null);

  useEffect(() => {
    if (location !== '/share' || handled.current) return;
    handled.current = true;

    const incoming = parseIncomingSocialShare(new URLSearchParams(window.location.search));
    if (!incoming) {
      setProblem('unsupported');
      return;
    }
    if (!saveIncomingSocialInspiration(incoming)) {
      setProblem('storage');
      return;
    }
    setLocation('/assistant', { replace: true });
  }, [location, setLocation]);

  if (!problem) return <PageLoading />;

  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-5 py-10">
      <section className="w-full max-w-md rounded-[28px] border border-foreground/10 bg-card p-6 text-center shadow-[0_20px_50px_-35px_hsl(330_40%_20%/.5)]">
        <TwoRings size={52} />
        <div className="mx-auto mt-5 grid h-11 w-11 place-items-center rounded-full bg-secondary text-primary"><Link2 className="h-5 w-5" /></div>
        <h1 className="font-display mt-4 text-2xl">
          {problem === 'unsupported' ? 'That share needs a link' : 'The link could not be saved'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {problem === 'unsupported'
            ? 'Choose Copy link in Instagram or TikTok, then paste the link in Ideas. Couple Dates only accepts secure links from those two services.'
            : 'Allow this browser to store the shared link for a moment, then try sharing it again.'}
        </p>
        <Link href="/assistant" className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">
          Open Ideas <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}
