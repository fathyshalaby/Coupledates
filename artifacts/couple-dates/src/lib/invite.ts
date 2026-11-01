const INVITE_STORAGE_KEY = 'couple-dates-pending-invite';

export function readInviteFromLocation(search = window.location.search): string {
  const params = new URLSearchParams(search);
  return (params.get('code') || params.get('invite') || '').trim();
}

export function stashInviteCode(code: string) {
  const trimmed = code.trim();
  if (!trimmed || trimmed.length < 8) return;
  try { sessionStorage.setItem(INVITE_STORAGE_KEY, trimmed); } catch { /* private mode */ }
}

export function takeStashedInviteCode(): string {
  try {
    const value = (sessionStorage.getItem(INVITE_STORAGE_KEY) || '').trim();
    if (value) sessionStorage.removeItem(INVITE_STORAGE_KEY);
    return value;
  } catch {
    return '';
  }
}

export function peekStashedInviteCode(): string {
  try { return (sessionStorage.getItem(INVITE_STORAGE_KEY) || '').trim(); }
  catch { return ''; }
}

export function resolveInviteCode(search = window.location.search): string {
  const fromUrl = readInviteFromLocation(search);
  if (fromUrl) {
    stashInviteCode(fromUrl);
    return fromUrl;
  }
  return peekStashedInviteCode();
}

export function inviteJoinPath(code: string, basePath = ''): string {
  const root = basePath.replace(/\/$/, '');
  return `${root}/join?code=${encodeURIComponent(code.trim())}`;
}
