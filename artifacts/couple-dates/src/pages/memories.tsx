import { useMemo, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Heart, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import {
  useCreateMemory,
  useDeleteMemory,
  useRequestUploadUrl,
  useUpdateMemory,
  type Memory,
  type MemoryInput,
  type MemoryInputCategory,
  type UploadInputContentType,
} from '@workspace/api-client-react';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CategoryChip, EmptyState, ErrorState, ListSkeleton, PageHeader, Photo } from '@/components/bits';
import { useToast } from '@/hooks/use-toast';
import { ALLOWED_TYPES, CATEGORIES, MAX_BYTES, errMsg, fmtDate, parseISO, photoUrl, todayISO, useInvalidate, useMemoriesQ } from '@/lib/data';
import { cn } from '@/lib/utils';

const AFFECTED = ['memories', 'summary', 'recap'] as const;

function toInput(m: Memory, patch: Partial<MemoryInput> = {}): MemoryInput {
  return { title: m.title, note: m.note, date: m.date.slice(0, 10), category: m.category, photoPath: m.photoPath ?? null, favorite: m.favorite, ...patch };
}

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
                            <motion.button whileTap={{ scale: 0.7 }} data-testid={`button-favorite-${m.id}`} aria-label="Favorite" onClick={() => update.mutate({ id: m.id, data: toInput(m, { favorite: !m.favorite }) })} className="shrink-0 p-1">
                              <Heart className={cn('h-6 w-6 transition', m.favorite ? 'fill-primary text-primary' : 'text-foreground/30')} />
                            </motion.button>
                          </div>
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

function MemoryForm({ memory, onDone }: { memory: Memory | null; onDone: () => void }) {
  const invalidate = useInvalidate();
  const { toast } = useToast();
  const [title, setTitle] = useState(memory?.title ?? '');
  const [note, setNote] = useState(memory?.note ?? '');
  const [date, setDate] = useState(memory?.date.slice(0, 10) ?? todayISO());
  const [category, setCategory] = useState<MemoryInputCategory>(memory?.category ?? 'Everyday');
  const [favorite, setFavorite] = useState(memory?.favorite ?? false);
  const [photoPath, setPhotoPath] = useState<string | null>(memory?.photoPath ?? null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const requestUrl = useRequestUploadUrl();
  const opts = { mutation: { onSuccess: () => { invalidate([...AFFECTED]); toast({ title: memory ? 'Memory updated' : 'Memory kept' }); onDone(); }, onError: (e: unknown) => setError(errMsg(e)) } };
  const create = useCreateMemory(opts);
  const update = useUpdateMemory(opts);
  const pending = create.isPending || update.isPending;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const type = (file.type || (/\.(heic)$/i.test(file.name) ? 'image/heic' : /\.(heif)$/i.test(file.name) ? 'image/heif' : '')) as UploadInputContentType;
    if (!(ALLOWED_TYPES as readonly string[]).includes(type)) { setError('Use a JPEG, PNG, WebP, HEIC or HEIF photo.'); return; }
    if (file.size > MAX_BYTES) { setError('That photo is over 10 MB. Try a smaller one.'); return; }
    setUploading(true);
    try {
      const target = await requestUrl.mutateAsync({ data: { name: file.name.slice(0, 255), size: file.size, contentType: type } });
      const res = await fetch(target.uploadURL, { method: 'PUT', headers: { 'Content-Type': type }, body: file });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      setPhotoPath(target.objectPath);
      setLocalPreview(URL.createObjectURL(file));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const data: MemoryInput = { title: title.trim(), note, date, category, photoPath, favorite };
    if (memory) update.mutate({ id: memory.id, data }); else create.mutate({ data });
  };

  const preview = localPreview ?? photoUrl(photoPath);

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-xl overflow-y-auto px-5 pb-8 pt-2">
      <DrawerTitle className="font-display text-3xl">{memory ? 'Edit memory' : 'Keep a memory'}</DrawerTitle>
      <DrawerDescription className="text-sm text-muted-foreground">Shared with your partner the moment you save.</DrawerDescription>

      <div className="mt-5">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" className="hidden" data-testid="input-photo" onChange={(e) => onFile(e.target.files?.[0])} />
        {preview ? (
          <div className="polaroid relative mx-auto w-3/4 rotate-[-2deg]">
            <img src={preview} alt="" className="aspect-[4/3] w-full object-cover" />
            <div className="absolute bottom-1 right-2 flex gap-2">
              <button type="button" data-testid="button-change-photo" onClick={() => fileRef.current?.click()} className="text-xs text-[hsl(330_32%_15%)] underline">Change</button>
              <button type="button" data-testid="button-remove-photo" onClick={() => { setPhotoPath(null); setLocalPreview(null); }} className="text-xs text-destructive underline">Remove</button>
            </div>
          </div>
        ) : (
          <button type="button" data-testid="button-add-photo" disabled={uploading} onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-[24px] border-2 border-dashed border-foreground/20 py-7 text-muted-foreground transition active:scale-[.99]">
            <Camera className="h-6 w-6" />
            <span className="text-sm">{uploading ? 'Uploading photo...' : 'Add a photo (optional, up to 10 MB)'}</span>
          </button>
        )}
        {uploading && preview && <p className="mt-2 text-center text-xs text-muted-foreground">Uploading...</p>}
      </div>

      <div className="mt-5 space-y-4">
        <Input data-testid="input-memory-title" required maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Give it a title" className="font-display h-14 rounded-2xl text-xl" />
        <Textarea data-testid="input-memory-note" maxLength={5000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened? What do you want to remember?" className="min-h-28 rounded-2xl" />
        <Input data-testid="input-memory-date" required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-12 rounded-2xl" />
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button type="button" key={c} data-testid={`option-category-${c.toLowerCase()}`} onClick={() => setCategory(c)} className={cn('rounded-full px-3.5 py-2 text-sm transition', category === c ? 'bg-foreground text-background' : 'bg-card')}>{c}</button>
          ))}
        </div>
        <button type="button" data-testid="toggle-favorite" onClick={() => setFavorite((v) => !v)} className={cn('flex items-center gap-2 rounded-full px-4 py-2 text-sm', favorite ? 'bg-primary/10 text-primary' : 'bg-card')}>
          <Heart className={cn('h-4 w-4', favorite && 'fill-current')} /> {favorite ? 'Favorite' : 'Mark as favorite'}
        </button>
      </div>

      {error && <p data-testid="text-memory-error" className="mt-4 rounded-2xl bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>}
      <button data-testid="button-save-memory" disabled={pending || uploading} className="mt-6 w-full rounded-full bg-primary py-4 font-medium text-primary-foreground transition active:scale-[.98] disabled:opacity-50">
        {pending ? 'Saving...' : memory ? 'Save changes' : 'Keep this memory'}
      </button>
    </form>
  );
}
