import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Share2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryChip, EmptyState, ErrorState, PageHeader, Photo } from '@/components/bits';
import { useCouple } from '@/lib/couple-context';
import { errStatus, fmtDate, parseISO, useRecapQ } from '@/lib/data';
import { ShareCardDialog } from '@/components/share-card-dialog';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export default function RecapPage() {
  const couple = useCouple();
  const thisYear = new Date().getFullYear();
  const firstYear = Math.max(2000, Math.min(thisYear, parseISO(couple.anniversary).getFullYear()));
  const [year, setYear] = useState(thisYear);
  const [shareOpen, setShareOpen] = useState(false);
  const q = useRecapQ(year, true);
  const r = q.data;
  const max = r ? Math.max(1, ...r.monthlyCounts) : 1;
  const empty = r && r.memoryCount === 0 && r.dateCount === 0 && r.activeDays === 0;

  const header = <PageHeader kicker="Year in review" title={<>The <em className="text-primary">recap</em></>} />;
  const beta = <p className="mb-4 rounded-2xl bg-secondary/70 px-4 py-3 text-sm">Included free during the beta.</p>;
  if (q.isError && errStatus(q.error) === 402) return <div>{header}{beta}<ErrorState error={q.error} onRetry={() => q.refetch()} label="Your recap" /></div>;

  return (
    <div>
      {header}{beta}
      <div className="mb-5 flex items-center justify-between rounded-full bg-card p-1.5 shadow-[0_1px_0_hsl(var(--border))]">
        <button data-testid="button-prev-year" disabled={year <= firstYear} onClick={() => setYear((y) => y - 1)} className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-foreground/5 disabled:opacity-30" aria-label="Previous year"><ChevronLeft className="h-5 w-5" /></button>
        <motion.span key={year} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} data-testid="text-recap-year" className="font-display text-2xl">{year}</motion.span>
        <button data-testid="button-next-year" disabled={year >= thisYear} onClick={() => setYear((y) => y + 1)} className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-foreground/5 disabled:opacity-30" aria-label="Next year"><ChevronRight className="h-5 w-5" /></button>
      </div>

      {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} label="This recap" /> : !r ? (
        <div className="space-y-3"><Skeleton className="h-56 rounded-[32px]" /><Skeleton className="h-32 rounded-[24px]" /></div>
      ) : empty ? (
        <EmptyState title={`${year} is still unwritten.`} body="Your recap fills in from the memories, dates and check-ins you two actually add. Nothing here is guessed." />
      ) : (
        <div className="space-y-4">
          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-[32px] bg-primary p-6 text-primary-foreground">
            <p className="font-mono text-[10px] uppercase tracking-widest opacity-80">{couple.yourName} &amp; {couple.partnerName} / {year}</p>
            <p className="font-display mt-3 text-5xl leading-[0.95]" data-testid="text-recap-headline">
              <span data-testid="text-recap-memories">{r.memoryCount}</span> memor{r.memoryCount === 1 ? 'y' : 'ies'}.<br />
              <em><span data-testid="text-recap-dates">{r.dateCount}</span> date{r.dateCount === 1 ? '' : 's'}.</em>
            </p>
            <div className="mt-6 flex h-28 items-end gap-1.5" data-testid="chart-monthly">
              {r.monthlyCounts.map((n, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <motion.span initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.1 + i * 0.04, type: 'spring', stiffness: 160, damping: 20 }} style={{ height: `${Math.max(4, (n / max) * 100)}%`, transformOrigin: 'bottom' }} className={`w-full rounded-t-md ${n ? 'bg-primary-foreground/90' : 'bg-primary-foreground/25'}`} title={`${n}`} />
                  <span className="font-mono text-[9px] opacity-70">{MONTHS[i]}</span>
                </div>
              ))}
            </div>
            <button data-testid="button-share-recap" onClick={() => setShareOpen(true)} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full border border-primary-foreground/35 px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground" aria-label={`Share ${year} recap`}><Share2 className="h-4 w-4" />Share recap</button>
          </motion.section>

          <section className="grid grid-cols-2 gap-3">
            <Tile label="Average rating" value={r.averageRating ? r.averageRating.toFixed(1) : '-'} sub={r.averageRating ? 'out of 5' : 'no rated dates'} testid="text-recap-rating" />
            <Tile label="Active days" value={String(r.activeDays)} sub="with a check-in" testid="text-recap-active" />
            <Tile label="Longest streak" value={String(r.longestStreak)} sub={`day${r.longestStreak === 1 ? '' : 's'} in a row`} testid="text-recap-streak" />
            <div className="rounded-[24px] bg-foreground p-4 text-background">
              <p className="font-mono text-[10px] uppercase tracking-widest opacity-60">Your kind of year</p>
              <p data-testid="text-recap-category" className="font-display mt-1 text-2xl italic">{r.topCategory || '-'}</p>
            </div>
          </section>

          {r.topMemories.length > 0 && (
            <section className="pt-4">
              <h2 className="font-display text-2xl">The ones you starred</h2>
              <div className="-mx-5 mt-3 flex snap-x gap-4 overflow-x-auto px-5 pb-4 [scrollbar-width:none]">
                {r.topMemories.map((m, i) => (
                  <figure key={m.id} data-testid={`card-top-memory-${m.id}`} className="polaroid w-52 shrink-0 snap-start" style={{ transform: `rotate(${i % 2 ? 2 : -2}deg)` }}>
                    {m.photoPath ? <Photo path={m.photoPath} alt={m.title} className="aspect-square w-full" /> : <div className="grid aspect-square w-full place-items-center bg-secondary font-display text-5xl italic text-[hsl(330_32%_15%)]">{m.title.charAt(0)}</div>}
                    <figcaption className="mt-2 text-[hsl(330_32%_15%)]">
                      <p className="font-display truncate italic">{m.title}</p>
                      <div className="mt-1 flex items-center gap-2"><CategoryChip category={m.category} /><span className="font-mono text-[10px] opacity-60">{fmtDate(m.date, { month: 'short', day: 'numeric' })}</span></div>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
      <ShareCardDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        content={r && !empty ? { kind: 'recap', year, memoryCount: r.memoryCount, dateCount: r.dateCount, topCategory: r.topCategory || null } : null}
      />
    </div>
  );
}

function Tile({ label, value, sub, testid }: { label: string; value: string; sub: string; testid: string }) {
  return (
    <div className="rounded-[24px] bg-card p-4 shadow-[0_1px_0_hsl(var(--border))]">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p data-testid={testid} className="font-display text-4xl">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
