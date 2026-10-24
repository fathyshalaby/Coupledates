export const INCOMING_SOCIAL_INSPIRATION_KEY = 'couple-dates:incoming-social-inspiration';

export type IncomingSocialInspiration = {
  url: string;
  note: string;
};

const MAX_URL_LENGTH = 500;
const MAX_NOTE_LENGTH = 500;
const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;

export function socialPlatformFromUrl(raw: string): 'Instagram' | 'TikTok' | null {
  try {
    const candidate = raw.trim().replace(/[.,!?;:)\]}>]+$/, '');
    const url = new URL(candidate);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'instagram.com' || host === 'm.instagram.com' || host === 'instagr.am') return 'Instagram';
    if (host === 'tiktok.com' || host === 'vm.tiktok.com' || host === 'vt.tiktok.com') return 'TikTok';
  } catch {
    return null;
  }
  return null;
}

function cleanSharedText(value: string): string {
  return value
    .replace(URL_PATTERN, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseIncomingSocialShare(params: URLSearchParams): IncomingSocialInspiration | null {
  const title = (params.get('title') ?? '').slice(0, 2_000);
  const text = (params.get('text') ?? '').slice(0, 2_000);
  const directUrl = (params.get('url') ?? '').slice(0, MAX_URL_LENGTH);
  const candidates = [
    directUrl,
    ...[text, title].flatMap((value) =>
      Array.from(value.matchAll(URL_PATTERN), (match) => match[0].replace(/[.,!?;:)\]}>]+$/, '')),
    ),
  ];
  const url = candidates.find((candidate) => socialPlatformFromUrl(candidate))?.trim();
  if (!url || url.length > MAX_URL_LENGTH) return null;

  const noteParts = [...new Set([cleanSharedText(text), cleanSharedText(title)].filter(Boolean))];
  return { url, note: noteParts.join('\n').slice(0, MAX_NOTE_LENGTH) };
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveIncomingSocialInspiration(value: IncomingSocialInspiration): boolean {
  const store = storage();
  if (!store) return false;

  const url = value.url.trim();
  if (url.length > MAX_URL_LENGTH || !socialPlatformFromUrl(url)) {
    clearIncomingSocialInspiration();
    return false;
  }

  try {
    store.setItem(INCOMING_SOCIAL_INSPIRATION_KEY, JSON.stringify({
      url,
      note: value.note.slice(0, MAX_NOTE_LENGTH),
    }));
    return true;
  } catch {
    return false;
  }
}

export function getIncomingSocialInspiration(): IncomingSocialInspiration | null {
  const store = storage();
  if (!store) return null;

  try {
    const raw = store.getItem(INCOMING_SOCIAL_INSPIRATION_KEY);
    if (!raw || raw.length > 2_000) return null;
    const value = JSON.parse(raw) as Partial<IncomingSocialInspiration>;
    if (typeof value.url !== 'string' || !socialPlatformFromUrl(value.url)) return null;
    return {
      url: value.url.slice(0, MAX_URL_LENGTH),
      note: typeof value.note === 'string' ? value.note.slice(0, MAX_NOTE_LENGTH) : '',
    };
  } catch {
    return null;
  }
}

export function hasIncomingSocialInspiration(): boolean {
  return getIncomingSocialInspiration() !== null;
}

export function clearIncomingSocialInspiration(): void {
  try {
    storage()?.removeItem(INCOMING_SOCIAL_INSPIRATION_KEY);
  } catch {
    // Storage may be disabled. The current form state remains available in memory.
  }
}
