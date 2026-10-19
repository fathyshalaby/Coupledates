import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Compass, Flame, MessagesSquare, Sofa } from 'lucide-react';
import { useCheckIn, type CheckInInputActivity } from '@workspace/api-client-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState, PageHeader } from '@/components/bits';
import { useToast } from '@/hooks/use-toast';
import { errMsg, parseISO, useInvalidate, useSummaryQ } from '@/lib/data';
import { cn } from '@/lib/utils';

const ACTIVITIES: { value: CheckInInputActivity; icon: typeof Sofa; hint: string }[] = [
  { value: 'Quality time', icon: Sofa, hint: 'Phones down, just the two of you' },
  { value: 'A little adventure', icon: Compass, hint: 'Somewhere new, even around the corner' },
  { value: 'A good conversation', icon: MessagesSquare, hint: 'The kind that runs past bedtime' },
];

export default function StreaksPage() {
  const summary = useSummaryQ();
  const invalidate = useInvalidate();
  const { toast } = useToast();
  const [picked, setPicked] = useState<CheckInInputActivity | null>(null);
  const checkIn = useCheckIn({
    mutation: {
      onSuccess: () => { invalidate(['summary', 'recap']); toast({ title: 'Checked in', description: 'Today counts.' }); },
      onError: (e) => toast({ title: 'Check-in failed', description: errMsg(e), variant: 'destructive' }),
    },
  });
  const s = summary.data;

  return (
    <div>
      <PageHeader kicker="Daily check-in" title={<>Keep it <em className="text-primary">lit.</em></>} />
      {summary.isError ? <ErrorState error={summary.error} onRetry={() => summary.refetch()} label="Your streak" /> : !s ? (
        <div className="space-y-3"><Skeleton className="h-48 rounded-[32px]" /><Skeleton className="h-24 rounded-[24px]" /></div>
      ) : (
        <>
          <section className="rise relative overflow-hidden rounded-[32px] bg-foreground p-6 text-background">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest opacity-60">Current streak</p>
                <motion.p key={s.currentStreak} initial={{ scale: 1.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} data-testid="text-streak" className="font-display text-8xl leading-none">{s.currentStreak}</motion.p>
                <p className="mt-1 text-sm opacity-70">day{s.currentStreak === 1 ? '' : 's'} in a row / best {s.longestStreak}</p>
              </div>
              <Flame className={cn('h-12 w-12', s.currentStreak > 0 ? 'text-primary' : 'opacity-25')} />
            </div>
            <div className="mt-6 flex justify-between">
              {s.weekDays.map((d) => {
                const dt = parseISO(d.date);
                return (
                  <div key={d.date} className="flex flex-col items-center gap-1.5" data-testid={`day-${d.date}`}>
                    <span className={cn('grid h-9 w-9 place-items-center rounded-full transition', d.checked ? 'bg-primary text-primary-foreground' : 'border-2 border-dashed border-background/25')}>{d.checked && <Check className="h-4 w-4" />}</span>
                    <span className="font-mono text-[10px] opacity-60">{dt.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-8">
            {s.checkedInToday ? (
              <div className="rise relative rounded-[28px] bg-card p-6 text-center shadow-[0_1px_0_hsl(var(--border))]" data-testid="state-checked-in">
                <span className="stamp-in inline-block rounded-lg border-[3px] border-primary px-4 py-2 font-mono text-sm uppercase tracking-[0.3em] text-primary">Today counted</span>
                <p className="mt-4 text-muted-foreground">One of you already checked in today. Come back tomorrow to keep the streak going.</p>
              </div>
            ) : (
              <>
                <h2 className="font-display text-2xl">What did today hold?</h2>
                <p className="mt-1 text-sm text-muted-foreground">Either of you can check in. Once a day is enough for both.</p>
                <div className="mt-4 space-y-3">
                  {ACTIVITIES.map(({ value, icon: Icon, hint }) => (
                    <button key={value} data-testid={`button-activity-${value.replace(/\s/g, '-').toLowerCase()}`} onClick={() => setPicked(value)}
                      className={cn('flex w-full items-center gap-4 rounded-[24px] border-2 p-4 text-left transition active:scale-[.98]', picked === value ? 'border-primary bg-primary/5' : 'border-transparent bg-card')}>
                      <span className={cn('grid h-12 w-12 place-items-center rounded-2xl transition', picked === value ? 'bg-primary text-primary-foreground' : 'bg-secondary')}><Icon className="h-5 w-5" /></span>
                      <span><span className="block font-medium">{value}</span><span className="text-sm text-muted-foreground">{hint}</span></span>
                    </button>
                  ))}
                </div>
                <button data-testid="button-check-in" disabled={!picked || checkIn.isPending} onClick={() => picked && checkIn.mutate({ data: { activity: picked } })}
                  className="mt-5 w-full rounded-full bg-primary py-4 font-medium text-primary-foreground transition active:scale-[.98] disabled:opacity-40">
                  {checkIn.isPending ? 'Checking in...' : 'Check in for today'}
                </button>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
