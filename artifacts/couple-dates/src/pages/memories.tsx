import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarHeart, Heart, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { Link } from 'wouter';
import { useDeleteMemory, useUpdateMemory, type Memory } from '@workspace/api-client-react';
import { MEMORY_AFFECTED, MemoryForm, memoryToInput } from '@/components/memory-form';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { CategoryChip, EmptyState, ErrorState, ListSkeleton, PageHeader, Photo } from '@/components/bits';
import { useToast } from '@/hooks/use-toast';
import { CATEGORIES, errMsg, fmtDate, parseISO, useInvalidate, useMemoriesQ } from '@/lib/data';
import { cn } from '@/lib/utils';

const AFFECTED = MEMORY_AFFECTED;

export default function MemoriesPage() {
  const q = useMemoriesQ();
  const invalidate = useInvalidate();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<string>('All');
  const [favOnly, setFavOnly] = useState(false);
  const [editing, setEditing] = useState<Memory | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Memory | null>(null);

  const update = useUpdateMemory({ mutation: { onSuccess: () => invalidate([...AFFECTED]), onError: (e) => toast({ title: 'Could not update', description: errMsg(e), variant: 'destructive' }) } });
  const del = useDeleteMemory({ mutation: {
    onSuccess: () => { invalidate([...AFFECTED]); toast({ title: 'Memory removed' }); setDeleting(null); },
    onError: (e) => toast({ title: 'Could not delete', description: errMsg(e), variant: 'destructive' }),
  } });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...(q.data ?? [])]
      .filter((m) => (cat === 'All' || m.category === cat) && (!favOnly || m.favorite) && (!term || m.title.toLowerCase().includes(term) || m.note.toLowerCase().includes(term)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  }, [q.data, search, cat, favOnly]);

  const groups = useMemo(() => {
    const out: { key: string; label: string; items: Memory[] }[] = [];
    for (const m of filtered) {
      const key = m.date.slice(0, 7);
      let g = out.find((x) => x.key === key);
      if (!g) { g = { key, label: parseISO(m.date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), items: [] }; out.push(g); }
      g.items.push(m);
    }
    return out;
  }, [filtered]);

  const total = q.data?.length ?? 0;

  return (
    <div>
      <PageHeader kicker={`${total} kept`} title={<>Our <em className="text-primary">pages</em></>}>
        <button data-testid="button-new-memory" onClick={() => setEditing('new')} className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_24px_-10px_hsl(12_76%_45%/.8)] transition active:scale-90" aria-label="New memory"><Plus className="h-5 w-5" /></button>
      </PageHeader>

      <div className="sticky top-0 z-20 -mx-5 bg-background/85 px-5 pb-3 pt-1 backdrop-blur-md">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input data-testid="input-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search titles and notes" className="h-12 rounded-full border-0 bg-card pl-11 shadow-[0_1px_0_hsl(var(--border))]" />
          {search && <button data-testid="button-clear-search" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1" aria-label="Clear"><X className="h-4 w-4" /></button>}
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          <button data-testid="filter-favorites" onClick={() => setFavOnly((v) => !v)} className={cn('flex shrink-0 items-center gap-1 rounded-full px-3.5 py-1.5 text-sm transition', favOnly ? 'bg-primary text-primary-foreground' : 'bg-card')}>
            <Heart className={cn('h-3.5 w-3.5', favOnly && 'fill-current')} /> Favorites
          </button>
          {['All', ...CATEGORIES].map((c) => (
            <button key={c} data-testid={`filter-${c.toLowerCase()}`} onClick={() => setCat(c)} className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-sm transition', cat === c ? 'bg-foreground text-background' : 'bg-card')}>{c}</button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} label="Memories" /> : total === 0 ? (
          <EmptyState title="Nothing written yet." body="The first memory doesn't need to be big. What made you laugh this week?" action={<button data-testid="button-empty-new-memory" onClick={() => setEditing('new')} className="rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground">Write the first one</button>} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matches." body="Try another word, or clear the filters." action={<button data-testid="button-reset-filters" onClick={() => { setSearch(''); setCat('All'); setFavOnly(false); }} className="rounded-full bg-foreground px-5 py-3 text-sm text-background">Reset filters</button>} />
        ) : (
          <div className="relative space-y-8 before:absolute before:bottom-0 before:left-[7px] before:top-2 before:w-px before:bg-foreground/15">
            {groups.map((g) => (
              <section key={g.key} className="relative pl-7">
                <span className="absolute left-0 top-1.5 h-[15px] w-[15px] rounded-full border-[3px] border-background bg-primary" />
                <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{g.label}</h2>
                <div className="mt-3 space-y-4">
                  <AnimatePresence initial={false}>
                    {g.items.map((m) => (
                      <motion.article layout key={m.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} data-testid={`card-memory-${m.id}`} className="overflow-hidden rounded-[26px] bg-card shadow-[0_1px_0_hsl(var(--border))]">
                        {m.photoPath && <Photo path={m.photoPath} alt={m.title} className="aspect-[4/3] w-full" />}
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2"><CategoryChip category={m.category} /><span className="font-mono text-[10px] text-muted-foreground">{fmtDate(m.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span></div>
                              <h3 className="font-display mt-2 text-xl leading-tight">{m.title}</h3>
                            </div>
                            <motion.button whileTap={{ scale: 0.7 }} data-testid={`button-favorite-${m.id}`} aria-label="Favorite" onClick={() => update.mutate({ id: m.id, data: memoryToInput(m, { favorite: !m.favorite }) })} className="shrink-0 p-1">
                              <Heart className={cn('h-6 w-6 transition', m.favorite ? 'fill-primary text-primary' : 'text-foreground/30')} />
                            </motion.button>
                          </div>
                          {m.dateId != null && <Link href={`/dates/${m.dateId}`} data-testid={`link-memory-date-${m.id}`} className="mt-2 inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs"><CalendarHeart className="h-3 w-3" /> From a date · open album</Link>}
                          {m.note && <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-foreground/80">{m.note}</p>}
                          <div className="mt-3 flex justify-end gap-1">
                            <button data-testid={`button-edit-memory-${m.id}`} onClick={() => setEditing(m)} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs hover:bg-foreground/5"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                            <button data-testid={`button-delete-memory-${m.id}`} onClick={() => setDeleting(m)} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-destructive hover:bg-destructive/5"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                          </div>
                        </div>
                      </motion.article>
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <Drawer open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DrawerContent className="max-h-[94dvh] bg-background">
          {editing !== null && <MemoryForm key={editing === 'new' ? 'new' : editing.id} memory={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
        </DrawerContent>
      </Drawer>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="rounded-[28px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl">Remove this memory?</AlertDialogTitle>
            <AlertDialogDescription>"{deleting?.title}" will be gone for both of you. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete" className="rounded-full">Keep it</AlertDialogCancel>
            <AlertDialogAction data-testid="button-confirm-delete" disabled={del.isPending} onClick={(e) => { e.preventDefault(); if (deleting) del.mutate({ id: deleting.id }); }} className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {del.isPending ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

