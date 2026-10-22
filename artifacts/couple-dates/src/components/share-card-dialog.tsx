import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, ImageOff, LoaderCircle, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { photoUrl } from '@/lib/data';

type MemoryShare = {
  kind: 'memory';
  title: string;
  date: string;
  category: string;
  photoPath?: string | null;
};
type RecapShare = {
  kind: 'recap';
  year: number;
  memoryCount: number;
  dateCount: number;
  averageRating: number | null;
  activeDays: number;
  longestStreak: number;
  topCategory: string | null;
};
type ShareOptions = {
  includePhoto: boolean;
  memoryCount: boolean;
  dateCount: boolean;
  averageRating: boolean;
  activeDays: boolean;
  longestStreak: boolean;
  topCategory: boolean;
};

const DEFAULT_OPTIONS: ShareOptions = {
  includePhoto: false,
  memoryCount: false,
  dateCount: false,
  averageRating: false,
  activeDays: false,
  longestStreak: false,
  topCategory: false,
};

export function ShareCardDialog({ open, onOpenChange, content }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: MemoryShare | RecapShare | null;
}) {
  const [previewUrl, setPreviewUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [photoWarning, setPhotoWarning] = useState(false);
  const [error, setError] = useState('');
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [consented, setConsented] = useState(false);
  const [nativeShareFailed, setNativeShareFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fallbackReady, setFallbackReady] = useState(false);
  const captionField = useRef<HTMLTextAreaElement>(null);
  const [attempt, setAttempt] = useState(0);
  const contentKey = content ? JSON.stringify(content) : '';
  const [savedOptions, setSavedOptions] = useState<{ contentKey: string; options: ShareOptions } | null>(null);
  const options = savedOptions?.contentKey === contentKey ? savedOptions.options : DEFAULT_OPTIONS;
  const optionsKey = JSON.stringify(options);
  const caption = content ? captionFor(content, options) : '';

  useEffect(() => {
    if (!open || !content) return;
    let cancelled = false;
    let objectUrl = '';
    setLoading(true);
    setError('');
    setPhotoWarning(false);
    setCanNativeShare(false);
    setConsented(false);
    setNativeShareFailed(false);
    setCopied(false);
    setFallbackReady(false);
    setPreviewUrl('');
    setFile(null);

    void buildShareCard(content, options).then(({ blob, photoFailed }) => {
      if (cancelled) return;
      const nextFile = new File([blob], content.kind === 'memory' ? 'memory-card.png' : `year-${content.year}-recap.png`, { type: 'image/png' });
      objectUrl = URL.createObjectURL(blob);
      setPreviewUrl(objectUrl);
      setFile(nextFile);
      setPhotoWarning(photoFailed);
      const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
      try { setCanNativeShare(typeof nav.share === 'function' && !!nav.canShare?.({ files: [nextFile] })); }
      catch { setCanNativeShare(false); }
      setLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setError('The image could not be prepared. Check your connection and try again.');
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, contentKey, optionsKey, attempt]);

  function updateOption(key: keyof ShareOptions, value: boolean) {
    setConsented(false);
    setNativeShareFailed(false);
    setCopied(false);
    setFallbackReady(false);
    setError('');
    setSavedOptions({
      contentKey,
      options: { ...options, [key]: value },
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setSavedOptions(null);
    onOpenChange(nextOpen);
  }

  async function shareNative() {
    if (!file) return;
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    try {
      if (typeof nav.share !== 'function') throw new Error('Native sharing is unavailable');
      await nav.share({ files: [file], text: caption });
      handleOpenChange(false);
    } catch (reason) {
      if ((reason as { name?: string } | null)?.name === 'AbortError') {
        setError('Sharing was canceled. Nothing was sent.');
      } else {
        setError('Sharing did not complete. You can still download the image or copy its caption.');
        setConsented(true);
        setNativeShareFailed(true);
      }
    }
  }

  async function copyCaption() {
    setFallbackReady(false);
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setError('');
      return true;
    } catch {
      setCopied(false);
      setError('Clipboard access is blocked. Use “Select caption text” below, then copy it manually.');
      return false;
    }
  }

  function selectCaption() {
    captionField.current?.focus();
    captionField.current?.select();
  }

  function downloadImage() {
    if (!file || !previewUrl) return;
    const link = document.createElement('a');
    link.href = previewUrl;
    link.download = file.name;
    link.rel = 'noopener';
    link.click();
  }

  async function downloadAndCopy() {
    downloadImage();
    if (await copyCaption()) setFallbackReady(true);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="dialog-share-preview" className="max-h-[92dvh] max-w-md overflow-y-auto rounded-[24px] p-5 sm:p-6">
        <DialogHeader className="pr-7 text-left">
          <DialogTitle className="font-display text-2xl">Share a little of this</DialogTitle>
          <DialogDescription>Choose what belongs on the card, then review the image and caption before sharing.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <section aria-label="Choose what to include" className="space-y-2 rounded-xl border border-border bg-secondary/25 p-3.5">
            <h3 className="text-sm font-medium">Choose what to include</h3>
            {content?.kind === 'memory' && content.photoPath && (
              <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm">
                <input data-testid="checkbox-share-photo" type="checkbox" checked={options.includePhoto} disabled={consented} onChange={(e) => updateOption('includePhoto', e.target.checked)} className="h-4 w-4 accent-primary" />
                Include our photo
              </label>
            )}
            {content?.kind === 'recap' && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <OptionCheckbox testId="checkbox-share-memory-count" label="Memories" checked={options.memoryCount} disabled={consented} onChange={(value) => updateOption('memoryCount', value)} />
                <OptionCheckbox testId="checkbox-share-date-count" label="Dates" checked={options.dateCount} disabled={consented} onChange={(value) => updateOption('dateCount', value)} />
                {hasAverageRating(content.averageRating) && <OptionCheckbox testId="checkbox-share-average-rating" label="Average rating" checked={options.averageRating} disabled={consented} onChange={(value) => updateOption('averageRating', value)} />}
                <OptionCheckbox testId="checkbox-share-active-days" label="Active days" checked={options.activeDays} disabled={consented} onChange={(value) => updateOption('activeDays', value)} />
                <OptionCheckbox testId="checkbox-share-longest-streak" label="Longest streak" checked={options.longestStreak} disabled={consented} onChange={(value) => updateOption('longestStreak', value)} />
                {hasTopCategory(content.topCategory) && <OptionCheckbox testId="checkbox-share-top-category" label="Top category" checked={options.topCategory} disabled={consented} onChange={(value) => updateOption('topCategory', value)} />}
              </div>
            )}
            {content?.kind === 'recap' && <p className="text-xs text-muted-foreground">Recap details are off until you choose them.</p>}
          </section>

          <div className="overflow-hidden rounded-2xl border border-border bg-secondary/40">
            {loading ? (
              <div data-testid="share-card-loading" role="status" className="grid aspect-[4/5] place-items-center bg-secondary/40">
                <div className="w-[72%] space-y-3" aria-hidden><div className="h-48 animate-pulse rounded-xl bg-foreground/10" /><div className="h-5 w-2/3 animate-pulse rounded bg-foreground/10" /><div className="h-3 w-1/2 animate-pulse rounded bg-foreground/10" /></div>
                <span className="sr-only">Preparing share image</span>
              </div>
            ) : error && !previewUrl ? (
              <div className="grid aspect-[4/5] place-items-center p-6 text-center" role="alert">
                <div><ImageOff className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 text-sm">{error}</p><Button data-testid="button-share-retry" variant="outline" className="mt-4 rounded-full" onClick={() => setAttempt((n) => n + 1)}>Try again</Button></div>
              </div>
            ) : previewUrl ? (
              <img data-testid="img-share-preview" src={previewUrl} alt={content?.kind === 'memory' ? `Preview of ${content.title} share card` : `Preview of ${content?.year} recap share card`} className="block aspect-[4/5] w-full object-cover" />
            ) : null}
          </div>

          <p data-testid="text-share-warning" className="rounded-xl border border-[hsl(34_55%_74%)] bg-[hsl(38_65%_94%)] px-3.5 py-3 text-sm leading-relaxed text-[hsl(28_45%_25%)]">
            Your Couple Dates space stays private. Once shared, recipients may save or repost this image. Only the details shown in this preview are included.
          </p>
          {previewUrl && (
            <section data-testid="share-caption-preview" aria-label="Caption preview" className="space-y-1 rounded-xl border border-border px-3.5 py-3">
              <h3 className="text-xs font-medium text-muted-foreground">Caption to post</h3>
              <p data-testid="text-share-caption-preview" className="break-words text-sm">{caption}</p>
            </section>
          )}
          <p className="text-xs text-muted-foreground">On mobile, press and hold the preview to save the image if your browser does not offer a download.</p>
          {photoWarning && <p data-testid="text-share-photo-warning" className="text-sm text-muted-foreground">The saved photo could not be loaded; the card uses a text-only design.</p>}
          {error && previewUrl && <p role="alert" data-testid="text-share-error" className="text-sm text-destructive">{error}</p>}
          {copied && <p role="status" data-testid="text-share-copied" className="flex items-center gap-1.5 text-sm text-primary"><Check className="h-4 w-4" />{fallbackReady ? 'Image downloaded and caption copied.' : 'Caption copied.'}</p>}
          {consented && previewUrl && (
            <section data-testid="share-manual-fallback" className="space-y-2 rounded-xl border border-border bg-secondary/35 p-3.5">
              <h3 className="text-sm font-medium">Ready to post manually</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{nativeShareFailed ? 'The image could not be sent to another app. Download the card and copy its caption to post them there.' : 'This browser can’t send the image directly to another app. Download the card and copy its caption to post them there.'} Nothing is uploaded and no private link is shared.</p>
              <label htmlFor="share-manual-caption" className="block text-xs font-medium text-muted-foreground">Caption to copy</label>
              <textarea
                ref={captionField}
                id="share-manual-caption"
                data-testid="text-share-caption"
                aria-label="Caption to copy"
                value={caption}
                readOnly
                rows={3}
                className="w-full resize-y select-text rounded-lg border border-border bg-background/70 px-3 py-2 text-base leading-relaxed text-foreground"
              />
              <Button data-testid="button-share-select-caption" type="button" variant="outline" onClick={selectCaption} className="min-h-11 w-full rounded-full">
                Select caption text
              </Button>
              <p className="text-xs leading-relaxed text-muted-foreground">If copying is blocked, select the text above and copy it manually. On a phone, press and hold the caption, choose Select All, then Copy. On a computer, use Ctrl+C or ⌘C.</p>
            </section>
          )}
        </div>

        <DialogFooter className="gap-2 sm:flex-col sm:space-x-0">
          {loading ? (
            <Button disabled className="w-full rounded-full"><LoaderCircle className="h-4 w-4 animate-spin" />Preparing image</Button>
          ) : !consented ? (
            canNativeShare ? (
              <Button data-testid="button-share-confirm" disabled={!file} onClick={() => void shareNative()} className="w-full rounded-full"><Share2 className="h-4 w-4" />Share image</Button>
            ) : (
              <Button data-testid="button-share-confirm" disabled={!file} onClick={() => { setConsented(true); setError(''); }} className="w-full rounded-full">I understand — continue</Button>
            )
          ) : (
            <>
              <Button data-testid="button-share-download-copy" disabled={!file} onClick={() => void downloadAndCopy()} className="w-full rounded-full"><Download className="h-4 w-4" />Download image + copy caption</Button>
              <Button data-testid="button-share-download" variant="outline" disabled={!file} onClick={downloadImage} className="w-full rounded-full"><Download className="h-4 w-4" />Download image</Button>
              <Button data-testid="button-share-copy-caption" variant="outline" onClick={() => void copyCaption()} className="w-full rounded-full"><Copy className="h-4 w-4" />{copied ? 'Copy caption again' : 'Copy caption'}</Button>
            </>
          )}
          <Button data-testid="button-share-cancel" variant="ghost" onClick={() => onOpenChange(false)} className="w-full rounded-full">Not now</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OptionCheckbox({ testId, label, checked, disabled, onChange }: {
  testId: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm">
      <input data-testid={testId} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-primary" />
      {label}
    </label>
  );
}

function captionFor(content: MemoryShare | RecapShare, options: ShareOptions) {
  if (content.kind === 'memory') return `A little moment from us: ${content.title} 💛 #CoupleDates`;
  const details = recapDetails(content, options, false);
  return `Our ${content.year}, one moment at a time. 💛${details.length ? ` ${details.join(' · ')}` : ''} #CoupleDates`;
}

function hasAverageRating(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0;
}

function hasTopCategory(value: string | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function recapDetails(content: RecapShare, options: ShareOptions, includeCategoryLabel: boolean) {
  const details: string[] = [];
  const averageRating = content.averageRating;
  if (options.memoryCount) details.push(`${content.memoryCount} ${content.memoryCount === 1 ? 'memory' : 'memories'}`);
  if (options.dateCount) details.push(`${content.dateCount} ${content.dateCount === 1 ? 'date' : 'dates'}`);
  if (options.averageRating && hasAverageRating(averageRating)) details.push(`${averageRating.toFixed(1)} average rating`);
  if (options.activeDays) details.push(`${content.activeDays} active days`);
  if (options.longestStreak) details.push(`${content.longestStreak}-day longest streak`);
  if (options.topCategory && hasTopCategory(content.topCategory)) {
    details.push(includeCategoryLabel ? `Top category · ${content.topCategory.trim()}` : content.topCategory.trim());
  }
  return details;
}

async function buildShareCard(content: MemoryShare | RecapShare, options: ShareOptions): Promise<{ blob: Blob; photoFailed: boolean }> {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');

  context.fillStyle = '#f7f0e8';
  context.fillRect(0, 0, canvas.width, canvas.height);
  let photoFailed = false;
  let photo: HTMLImageElement | null = null;
  if (content.kind === 'memory' && options.includePhoto && content.photoPath) {
    const src = photoUrl(content.photoPath);
    if (src) {
      try {
        photo = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error('Photo unavailable'));
          image.src = src;
        });
      } catch { photoFailed = true; }
    } else photoFailed = true;
  }

  context.fillStyle = '#fffaf4';
  roundedRect(context, 48, 48, 984, 1254, 32);
  context.fill();
  if (photo) {
    drawCover(context, photo, 80, 80, 920, 760);
  } else {
    context.fillStyle = '#ead9d3';
    roundedRect(context, 80, 80, 920, 760, 24);
    context.fill();
    context.fillStyle = '#9e594d';
    context.font = 'italic 46px Georgia, serif';
    context.textAlign = 'center';
    context.fillText(content.kind === 'recap' ? 'A year, remembered' : 'A moment worth keeping', 540, 476, 820);
    context.textAlign = 'left';
  }

  context.fillStyle = '#a15b4d';
  context.font = '600 24px sans-serif';
  context.fillText(content.kind === 'recap' ? 'OUR YEAR IN REVIEW' : 'A LITTLE MOMENT FROM US', 88, 914);
  context.fillStyle = '#392b29';
  if (content.kind === 'memory') {
    drawMemoryTitle(context, content.title, 88, 982, 880, 1170);
  } else {
    context.font = '500 62px Georgia, serif';
    context.fillText(String(content.year), 88, 1010);
    const details = recapDetails(content, options, true);
    context.fillStyle = '#79645e';
    context.font = '30px sans-serif';
    const detailLineHeight = Math.min(36, Math.floor(150 / Math.max(details.length - 1, 1)));
    details.forEach((detail, index) => context.fillText(detail, 88, 1070 + index * detailLineHeight, 880));
  }

  context.fillStyle = '#a15b4d';
  context.font = '600 20px sans-serif';
  context.fillText('COUPLE DATES', 88, 1260);

  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not encode image')), 'image/png'));
  return { blob, photoFailed };
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sw = width / scale;
  const sh = height / scale;
  const sx = (image.naturalWidth - sw) / 2;
  const sy = (image.naturalHeight - sh) / 2;
  context.save();
  context.beginPath();
  context.roundRect(x, y, width, height, 24);
  context.clip();
  context.drawImage(image, sx, sy, sw, sh, x, y, width, height);
  context.restore();
}

function drawMemoryTitle(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, bottomBaseline: number) {
  const normalizedText = text.trim().replace(/\s+/g, ' ');
  let selected: { fontSize: number; lineHeight: number; lines: string[] } | undefined;

  for (let fontSize = 62; fontSize >= 28; fontSize -= 2) {
    const lineHeight = Math.ceil(fontSize * 1.22);
    context.font = `500 ${fontSize}px Georgia, serif`;
    const lines = wrapText(context, normalizedText, maxWidth);
    if (y + (lines.length - 1) * lineHeight <= bottomBaseline) {
      selected = { fontSize, lineHeight, lines };
      break;
    }
  }
  selected ??= { fontSize: 28, lineHeight: 35, lines: wrapText(context, normalizedText, maxWidth) };
  context.font = `500 ${selected.fontSize}px Georgia, serif`;
  selected.lines.forEach((line, index) => context.fillText(line, x, y + index * selected!.lineHeight));
  return {
    lastBaseline: y + (selected.lines.length - 1) * selected.lineHeight,
    lineHeight: selected.lineHeight,
  };
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (!text) return [''];
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (context.measureText(word).width > maxWidth) {
      if (line) {
        lines.push(line);
        line = '';
      }
      let chunk = '';
      for (const character of Array.from(word)) {
        if (chunk && context.measureText(chunk + character).width > maxWidth) {
          lines.push(chunk);
          chunk = character;
        } else chunk += character;
      }
      line = chunk;
      continue;
    }
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
