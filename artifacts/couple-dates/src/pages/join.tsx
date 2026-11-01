import { useEffect, useRef, useState } from 'react';
import { Link, Redirect } from 'wouter';
import { useGetCouple, useJoinCouple, getGetCoupleQueryKey } from '@workspace/api-client-react';
import { ErrorState, TwoRings } from '@/components/bits';
import { PageLoading } from '@/components/page-loader';
import { errMsg, useInvalidate } from '@/lib/data';
import { resolveInviteCode, takeStashedInviteCode } from '@/lib/invite';
import Onboarding from '@/pages/onboarding';

export default function JoinPage() {
  const code = resolveInviteCode();
  const invalidate = useInvalidate();
  const attempted = useRef(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const coupleQ = useGetCouple({ query: { queryKey: getGetCoupleQueryKey() } });
  const join = useJoinCouple({
    mutation: {
      onSuccess: () => {
        takeStashedInviteCode();
        invalidate(['couple', 'summary', 'memories', 'dates', 'preferences', 'assistant', 'detail', 'recap']);
      },
      onError: (error: unknown) => setManualError(errMsg(error)),
    },
  });

  const couple = coupleQ.data?.couple ?? null;
  const mutate = join.mutate;

  useEffect(() => {
    if (attempted.current || !code || coupleQ.isLoading || coupleQ.isError) return;
    if (couple && couple.memberCount >= 2) return;
    if (couple && couple.inviteCode === code) return;
    attempted.current = true;
    mutate({ data: { code } });
  }, [code, couple, coupleQ.isError, coupleQ.isLoading, mutate]);

  if (coupleQ.isLoading || (!coupleQ.data && !coupleQ.isError)) return <PageLoading />;
  if (coupleQ.isError) {
    return <div className="mx-auto max-w-md px-5 pt-24"><ErrorState error={coupleQ.error} onRetry={() => coupleQ.refetch()} label="Your space" /></div>;
  }

  if (!couple) return <Onboarding />;
  if (join.isSuccess || couple.memberCount >= 2 || (!join.isPending && !manualError && (!code || couple.inviteCode === code))) {
    return <Redirect to="/home" />;
  }

  if (join.isPending) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-5">
        <TwoRings size={64} />
        <p className="font-display text-2xl">Joining your shared space…</p>
      </div>
    );
  }

  if (manualError) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-5">
        <TwoRings size={52} />
        <h1 className="font-display mt-6 text-3xl">Couldn’t join that space</h1>
        <p data-testid="text-join-route-error" className="mt-3 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{manualError}</p>
        <button
          data-testid="button-join-route-retry"
          onClick={() => {
            setManualError(null);
            attempted.current = false;
            if (code) mutate({ data: { code } });
          }}
          className="mt-5 rounded-full bg-primary py-3.5 font-medium text-primary-foreground"
        >
          Try again
        </button>
        <Link href="/settings" className="mt-3 text-center text-sm text-muted-foreground underline underline-offset-4">Open settings</Link>
      </div>
    );
  }

  return <Redirect to="/home" />;
}
