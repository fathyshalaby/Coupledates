import { useEffect, useState } from 'react';
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
  topCategory: string | null;
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
  const [copied, setCopied] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const contentKey = content ? JSON.stringify(content) : '';

  useEffect(() => {
    if (!open || !content) return;
    let cancelled = false;
    let objectUrl = '';
    setLoading(true);
    setError('');
    setPhotoWarning(false);
    setCanNativeShare(false);
    setConsented(false);
    setCopied(false);
    setPreviewUrl('');
    setFile(null);

    void buildShareCard(content).then(({ blob, photoFailed }) => {
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
  }, [open, contentKey, attempt]);

  const caption = content ? captionFor(content) : '';

  async function shareNative() {
    if (!file) return;
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    try {
      await nav.share?.({ files: [file], text: caption });
      onOpenChange(false);
    } catch (reason) {
      if ((reason as { name?: string } | null)?.name === 'AbortError') {
        setError('Sharing was canceled. Nothing was sent.');
      } else {
        setError('Sharing did not complete. You can still download the image or copy its caption.');
        setConsented(true);
      }
    }
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setError('');
    } catch {
      setCopied(false);
      setError('The caption could not be copied. Check clipboard permission and try again.');
    }
  }

  function downloadImage() {
    if (!file || !previewUrl) return;
    const link = document.createElement('a');
    link.href = previewUrl;
    link.download = file.name;
    link.rel = 'noopener';
    link.click();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-share-preview" className="max-h-[92dvh] max-w-md overflow-y-auto rounded-[24px] p-5 sm:p-6">
        <DialogHeader className="pr-7 text-left">
          <DialogTitle className="font-display text-2xl">Share a little of this</DialogTitle>
          <DialogDescription>Review the image before choosing whether to share it.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
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
            Once shared, recipients may save or repost this image. Only the details shown in this preview are included.
          </p>
          <p className="text-xs text-muted-foreground">On mobile, press and hold the preview to save the image if your browser does not offer a download.</p>
          {photoWarning && <p data-testid="text-share-photo-warning" className="text-sm text-muted-foreground">The saved photo could not be loaded; the card uses a text-only design.</p>}
          {error && previewUrl && <p role="alert" data-testid="text-share-error" className="text-sm text-destructive">{error}</p>}
          {copied && <p role="status" data-testid="text-share-copied" className="flex items-center gap-1.5 text-sm text-primary"><Check className="h-4 w-4" /> Caption copied.</p>}
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

function captionFor(content: MemoryShare | RecapShare) {
  if (content.kind === 'memory') return `${content.title} · ${content.date} · ${content.category}`;
  return `${content.year}: ${content.memoryCount} ${content.memoryCount === 1 ? 'memory' : 'memories'}, ${content.dateCount} ${content.dateCount === 1 ? 'date' : 'dates'}${content.topCategory ? ` · ${content.topCategory}` : ''}`;
}

async function buildShareCard(content: MemoryShare | RecapShare): Promise<{ blob: Blob; photoFailed: boolean }> {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');

  context.fillStyle = '#f7f0e8';
  context.fillRect(0, 0, canvas.width, canvas.height);
  let photoFailed = false;
  let photo: HTMLImageElement | null = null;
  if (content.kind === 'memory' && content.photoPath) {
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
  context.fillText(content.kind === 'recap' ? 'OUR YEAR IN REVIEW' : content.category.toUpperCase(), 88, 914);
  context.fillStyle = '#392b29';
  context.font = '500 62px Georgia, serif';
  if (content.kind === 'memory') {
    drawWrapped(context, content.title, 88, 1000, 880, 76, 2);
    context.fillStyle = '#79645e';
    context.font = '32px sans-serif';
    context.fillText(`${content.date}  ·  ${content.category}`, 88, 1196, 880);
  } else {
    context.fillText(String(content.year), 88, 1030);
    context.font = '42px Georgia, serif';
    context.fillText(`${content.memoryCount} ${content.memoryCount === 1 ? 'memory' : 'memories'}`, 88, 1112, 880);
    context.fillText(`${content.dateCount} ${content.dateCount === 1 ? 'date' : 'dates'}`, 88, 1170, 880);
    if (content.topCategory) {
      context.fillStyle = '#79645e';
      context.font = '28px sans-serif';
      context.fillText(`Most-kept category · ${content.topCategory}`, 88, 1232, 880);
    }
  }

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

function drawWrapped(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const words = text.split(/\s+/);
  let line = '';
  let lineNo = 0;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > maxWidth && line) {
      context.fillText(line, x, y + lineNo * lineHeight, maxWidth);
      line = word;
      lineNo += 1;
      if (lineNo >= maxLines - 1) break;
    } else line = next;
  }
  if (lineNo < maxLines) context.fillText(line, x, y + lineNo * lineHeight, maxWidth);
}
