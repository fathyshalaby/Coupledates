import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Camera, Heart, ImagePlus, Loader2 } from 'lucide-react';
import {
  useCreateMemory,
  useRequestUploadUrl,
  useUpdateMemory,
  type Memory,
  type MemoryInput,
  type MemoryInputCategory,
  type UploadInputContentType,
} from '@workspace/api-client-react';
import { DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ALLOWED_TYPES, CATEGORIES, MAX_BYTES, errMsg, photoUrl, todayISO, useInvalidate } from '@/lib/data';
import { cn } from '@/lib/utils';

export const MEMORY_AFFECTED = ['memories', 'summary', 'recap', 'detail'] as const;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';

/** Builds a full MemoryInput from a memory — always preserves dateId. */
export function memoryToInput(m: Memory, patch: Partial<MemoryInput> = {}): MemoryInput {
  return { title: m.title, note: m.note, date: m.date.slice(0, 10), category: m.category, photoPath: m.photoPath ?? null, favorite: m.favorite, dateId: m.dateId ?? null, ...patch };
}

export type MemoryDefaults = { title?: string; date?: string; category?: MemoryInputCategory; dateId?: number | null; dateTitle?: string };

export function MemoryForm({ memory, defaults, initialFile, onDone }: { memory: Memory | null; defaults?: MemoryDefaults; initialFile?: File | null; onDone: () => void }) {
  const invalidate = useInvalidate();
  const { toast } = useToast();
  const [title, setTitle] = useState(memory?.title ?? defaults?.title ?? '');
  const [note, setNote] = useState(memory?.note ?? '');
  const [date, setDate] = useState(memory?.date.slice(0, 10) ?? defaults?.date ?? todayISO());
  const [category, setCategory] = useState<MemoryInputCategory>(memory?.category ?? defaults?.category ?? 'Everyday');
  const [favorite, setFavorite] = useState(memory?.favorite ?? false);
  const [photoPath, setPhotoPath] = useState<string | null>(memory?.photoPath ?? null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  const selectedFile = useRef<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const dateId = memory ? memory.dateId ?? null : defaults?.dateId ?? null;

  const requestUrl = useRequestUploadUrl();
  const opts = { mutation: { onSuccess: () => { invalidate([...MEMORY_AFFECTED]); toast({ title: memory ? 'Memory updated' : 'Memory kept' }); onDone(); }, onError: (e: unknown) => setError(errMsg(e)) } };
  const create = useCreateMemory(opts);
  const update = useUpdateMemory(opts);
  const pending = create.isPending || update.isPending;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    selectedFile.current = file;
    setUploadFailed(true);
    setError(null);
    const type = (file.type || (/\.(heic)$/i.test(file.name) ? 'image/heic' : /\.(heif)$/i.test(file.name) ? 'image/heif' : '')) as UploadInputContentType;
    if (!(ALLOWED_TYPES as readonly string[]).includes(type)) { setError(`"${file.name}" isn't a supported photo. Use JPEG, PNG, WebP, HEIC or HEIF.`); return; }
    if (file.size > MAX_BYTES) { setError(`That photo is ${(file.size / 1048576).toFixed(1)} MB — the limit is 10 MB. Try a smaller one.`); return; }
    setUploading(true);
    setLocalPreview(URL.createObjectURL(file));
    try {
      const target = await requestUrl.mutateAsync({ data: { name: file.name.slice(0, 255) || 'photo.jpg', size: file.size, contentType: type } });
      const res = await fetch(target.uploadURL, { method: 'PUT', headers: { 'Content-Type': type }, body: file });
      if (!res.ok) throw new Error(`Photo upload failed (${res.status}). Your text is still here — try the photo again.`);
      setPhotoPath(target.objectPath);
      setUploadFailed(false);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
      if (camRef.current) camRef.current.value = '';
    }
  };

  const onFileRef = useRef(onFile);
  onFileRef.current = onFile;
  const startedRef = useRef(false);
  useEffect(() => {
    if (initialFile && !startedRef.current) { startedRef.current = true; void onFileRef.current(initialFile); }
  }, [initialFile]);
  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (uploading || uploadFailed) return;
    setError(null);
    const data: MemoryInput = { title: title.trim(), note, date, category, photoPath, favorite, dateId };
    if (memory) update.mutate({ id: memory.id, data }); else create.mutate({ data });
  };

  const preview = localPreview ?? photoUrl(photoPath);

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-xl overflow-y-auto px-5 pb-8 pt-2">
      <DrawerTitle className="font-display text-3xl">{memory ? 'Edit memory' : defaults?.dateId ? 'Add to the album' : 'Keep a memory'}</DrawerTitle>
      <DrawerDescription className="text-sm text-muted-foreground">
        {defaults?.dateTitle ? <>Pinned to <span className="font-medium text-foreground">{defaults.dateTitle}</span>. </> : null}
        Shared with your partner the moment you save. One photo per memory.
      </DrawerDescription>

      <div className="mt-5">
        <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" data-testid="input-photo" aria-label="Upload a photo" onChange={(e) => onFile(e.target.files?.[0])} />
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" data-testid="input-camera" aria-label="Take a photo" onChange={(e) => onFile(e.target.files?.[0])} />
        {preview ? (
          <div className="polaroid relative mx-auto w-3/4 rotate-[-2deg]">
            <div className="relative">
              <img src={preview} alt="Selected photo" className={cn('aspect-[4/3] w-full object-cover transition', uploading && 'opacity-60 blur-[1px]')} />
              {uploading && <div className="absolute inset-0 grid place-items-center"><span className="flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-xs"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading</span></div>}
            </div>
            <div className="absolute bottom-1 right-2 flex gap-3">
              <button type="button" disabled={uploading} data-testid="button-change-photo" onClick={() => fileRef.current?.click()} className="text-xs text-[hsl(330_32%_15%)] underline">Change</button>
              <button type="button" disabled={uploading} data-testid="button-remove-photo" onClick={() => { selectedFile.current = null; setUploadFailed(false); setPhotoPath(null); setLocalPreview(null); setError(null); }} className="text-xs text-destructive underline">Remove</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button type="button" data-testid="button-take-photo" disabled={uploading} onClick={() => camRef.current?.click()} className="flex flex-col items-center gap-2 rounded-[24px] bg-foreground py-6 text-background transition active:scale-[.97]">
              <Camera className="h-6 w-6" /><span className="text-sm font-medium">Take a photo</span>
            </button>
            <button type="button" data-testid="button-add-photo" disabled={uploading} onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-2 rounded-[24px] border-2 border-dashed border-foreground/20 py-6 text-muted-foreground transition active:scale-[.97]">
              <ImagePlus className="h-6 w-6" /><span className="text-sm">Upload one</span>
            </button>
            <p className="col-span-2 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Optional · up to 10 MB</p>
          </div>
        )}
      </div>

      <div className="mt-5 space-y-4">
        <div className="space-y-1.5"><Label htmlFor="memory-title" className="sr-only">Title</Label>
          <Input id="memory-title" data-testid="input-memory-title" required maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Give it a title" className="font-display h-14 rounded-2xl text-xl" /></div>
        <div className="space-y-1.5"><Label htmlFor="memory-note" className="sr-only">Note</Label>
          <Textarea id="memory-note" data-testid="input-memory-note" maxLength={5000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened? What do you want to remember?" className="min-h-28 rounded-2xl" /></div>
        <div className="space-y-1.5"><Label htmlFor="memory-date" className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Day</Label>
          <Input id="memory-date" data-testid="input-memory-date" required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-12 rounded-2xl" /></div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Category">
          {CATEGORIES.map((c) => (
            <button type="button" role="radio" aria-checked={category === c} key={c} data-testid={`option-category-${c.toLowerCase()}`} onClick={() => setCategory(c)} className={cn('rounded-full px-3.5 py-2 text-sm transition', category === c ? 'bg-foreground text-background' : 'bg-card')}>{c}</button>
          ))}
        </div>
        <button type="button" aria-pressed={favorite} data-testid="toggle-favorite" onClick={() => setFavorite((v) => !v)} className={cn('flex items-center gap-2 rounded-full px-4 py-2 text-sm', favorite ? 'bg-primary/10 text-primary' : 'bg-card')}>
          <Heart className={cn('h-4 w-4', favorite && 'fill-current')} /> {favorite ? 'Favorite' : 'Mark as favorite'}
        </button>
      </div>

      {error && <p role="alert" data-testid="text-memory-error" className="mt-4 rounded-2xl bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>}
      {uploadFailed && !uploading && <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <button type="button" data-testid="button-retry-photo" onClick={() => void onFile(selectedFile.current ?? undefined)} className="rounded-full bg-foreground px-4 py-2 text-background">Retry photo</button>
        <button type="button" data-testid="button-skip-failed-photo" onClick={() => { selectedFile.current = null; setUploadFailed(false); setLocalPreview(null); setPhotoPath(memory?.photoPath ?? null); setError(null); }} className="rounded-full border border-foreground/20 px-4 py-2">Discard this photo</button>
      </div>}
      <button data-testid="button-save-memory" disabled={pending || uploading || uploadFailed} className="mt-6 w-full rounded-full bg-primary py-4 font-medium text-primary-foreground transition active:scale-[.98] disabled:opacity-50">
        {uploading ? 'Waiting for photo...' : pending ? 'Saving...' : memory ? 'Save changes' : 'Keep this memory'}
      </button>
    </form>
  );
}
