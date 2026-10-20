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
      <PageHeader kicker={`${total} kept`} title={<>Our <em className="font-normal text-primary">pages</em></>}>
        <button data-testid="button-new-memory" onClick={() => setEditing('new')} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-primary pl-3.5 pr-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 active:scale-95" aria-label="New memory"><Plus className="h-4 w-4" /><span className="hidden min-[400px]:inline" aria-hidden>Add</span></button>
      </PageHeader>

      <div className="sticky top-14 z-20 -mx-5 border-b border-transparent bg-background/90 px-5 pb-3 pt-2 backdrop-blur-md">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input data-testid="input-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search titles and notes" className="h-11 rounded-xl border-border bg-card pl-11" />
          {search && <button data-testid="button-clear-search" onClick={() => setSearch('')} className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:text-foreground" aria-label="Clear"><X className="h-4 w-4" /></button>}
        </div>
        <div className="no-scrollbar mt-2.5 flex gap-1.5 overflow-x-auto">
          <button data-testid="filter-favorites" onClick={() => setFavOnly((v) => !v)} aria-pressed={favOnly} className={cn('flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors', favOnly ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground')}>
            <Heart className={cn('h-3.5 w-3.5', favOnly && 'fill-current')} /> Favorites
          </button>
          {['All', ...CATEGORIES].map((c) => (
            <button key={c} data-testid={`filter-${c.toLowerCase()}`} onClick={() => setCat(c)} aria-pressed={cat === c} className={cn('min-h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-medium transition-colors', cat === c ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-muted-foreground hover:text-foreground')}>{c}</button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} label="Memories" /> : total === 0 ? (
          <EmptyState title="Nothing written yet." body="The first memory doesn't need to be big. What made you laugh this week?" action={<button data-testid="button-empty-new-memory" onClick={() => setEditing('new')} className="min-h-11 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">Write the first one</button>} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matches." body="Try another word, or clear the filters." action={<button data-testid="button-reset-filters" onClick={() => { setSearch(''); setCat('All'); setFavOnly(false); }} className="min-h-11 rounded-full border border-foreground/15 bg-card px-5 text-sm font-medium hover:bg-foreground/5">Reset filters</button>} />
        ) : (
          <div className="relative space-y-8 before:absolute before:bottom-0 before:left-[5px] before:top-3 before:w-px before:bg-border">
            {groups.map((g) => (
              <section key={g.key} className="relative pl-6 sm:pl-8">
                <span className="absolute left-0 top-[9px] h-[11px] w-[11px] rounded-full border-2 border-background bg-primary ring-1 ring-primary/30" aria-hidden />
                <h2 className="font-display text-lg font-medium">{g.label} <span className="ml-1 font-sans text-xs font-normal text-muted-foreground tnum">{g.items.length}</span></h2>
                <div className="mt-3 space-y-3">
                  <AnimatePresence initial={false}>
                    {g.items.map((m) => (
                      <motion.article layout key={m.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} data-testid={`card-memory-${m.id}`} className="surface overflow-hidden">
                        {m.photoPath && <Photo path={m.photoPath} alt={m.title} className="aspect-[4/3] w-full" />}
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2"><CategoryChip category={m.category} /><span className="text-xs text-muted-foreground">{fmtDate(m.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span></div>
                              <h3 className="font-display mt-2 text-xl leading-snug break-words">{m.title}</h3>
                            </div>
                            <motion.button whileTap={{ scale: 0.7 }} data-testid={`button-favorite-${m.id}`} aria-label="Favorite" aria-pressed={m.favorite} onClick={() => update.mutate({ id: m.id, data: memoryToInput(m, { favorite: !m.favorite }) })} className="-mr-1.5 -mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-foreground/5">
                              <Heart className={cn('h-[22px] w-[22px] transition-colors', m.favorite ? 'fill-primary text-primary' : 'text-foreground/35')} />
                            </motion.button>
                          </div>
                          {m.dateId != null && <Link href={`/dates/${m.dateId}`} data-testid={`link-memory-date-${m.id}`} className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"><CalendarHeart className="h-3.5 w-3.5" /> From a date · open album</Link>}
                          {m.note && <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-foreground/80">{m.note}</p>}
                          <div className="-mx-2 -mb-1 mt-3 flex justify-end gap-1 border-t border-border pt-2">
                            <button data-testid={`button-edit-memory-${m.id}`} onClick={() => setEditing(m)} className="flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-[13px] text-muted-foreground hover:bg-foreground/5 hover:text-foreground"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                            <button data-testid={`button-delete-memory-${m.id}`} onClick={() => setDeleting(m)} className="flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-[13px] text-destructive hover:bg-destructive/5"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
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
        <AlertDialogContent className="rounded-[20px]">
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

