import { test as base, expect } from '@playwright/test';
import { memory, plan, summary } from './records';

export const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  'base64',
);
type Write = { method: string; path: string; data: Record<string, unknown> };
type UploadStage = 'request-url' | 'put';
type UploadResponse = { status: number; ready: Promise<void> };
type MemoryMethod = 'POST' | 'PATCH';
type Network = {
  writes: Write[];
  unexpected: string[];
  // Responses are consumed once; subsequent attempts succeed by default.
  queueUploadResponse: (stage: UploadStage, status: number, hold?: boolean) => () => void;
  queueMemoryResponse: (method: MemoryMethod, status: number, hold?: boolean) => () => void;
};

export const test = base.extend<{ network: Network }>({
  network: [async ({ page }, use) => {
    const responses: Record<UploadStage, UploadResponse[]> = { 'request-url': [], put: [] };
    const memoryResponses: Record<MemoryMethod, UploadResponse[]> = { POST: [], PATCH: [] };
    const releases: (() => void)[] = [];
    const network: Network = {
      writes: [], unexpected: [],
      queueUploadResponse(stage, status, hold = false) {
        let release!: () => void;
        const ready = new Promise<void>((resolve) => { release = resolve; });
        releases.push(release);
        responses[stage].push({ status, ready });
        if (!hold) release();
        return release;
      },
      queueMemoryResponse(method, status, hold = false) {
        let release!: () => void;
        const ready = new Promise<void>((resolve) => { release = resolve; });
        releases.push(release);
        memoryResponses[method].push({ status, ready });
        if (!hold) release();
        return release;
      },
    };
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      // Fonts are intentionally offline; layout assertions use deterministic
      // fallback fonts. No browser request can reach a real API/provider.
      if (url.origin !== 'http://127.0.0.1:5189') {
        if (!url.hostname.endsWith('googleapis.com') && !url.hostname.endsWith('gstatic.com')) {
          network.unexpected.push(request.url());
        }
        return route.abort();
      }
      const json = (body: unknown) => route.fulfill({ json: body });
      if (path === '/logo.svg') {
        return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><circle cx="14" cy="14" r="10" fill="#c45c43"/></svg>' });
      }
      if (request.method() === 'GET' && ['/api/storage/synthetic/original.png', '/api/storage/synthetic/replacement.png'].includes(path)) {
        return route.fulfill({ contentType: 'image/png', body: png });
      }
      if (request.method() === 'GET') {
        if (path === '/api/dates') return json([plan, { ...plan, id: 900004, status: 'proposed', canRespond: true }]);
        if (path === '/api/memories') return json([memory]);
        if (path === '/api/summary') return json(summary);
        if (path === '/api/recap') {
          const year = Number(url.searchParams.get('year')) || new Date().getFullYear();
          return json({
            year, memoryCount: 1, dateCount: 2, averageRating: 4.5, topCategory: 'Food',
            topMemories: [memory], longestStreak: 3, activeDays: 4,
            monthlyCounts: [1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0],
          });
        }
        if (path === '/api/openai/date-assistant') return json([]);
        if (path === '/api/preferences') return json([]);
        if (path === '/api/reminders') return json([]);
        if (!path.startsWith('/api/')) return route.continue();
      } else {
        network.writes.push({
          method: request.method(), path,
          data: path === '/synthetic-upload' ? {} : request.postDataJSON(),
        });
        if (path === '/api/storage/uploads/request-url') {
          const response = responses['request-url'].shift();
          if (response) {
            await response.ready;
            if (response.status !== 200) {
              return route.fulfill({ status: response.status, json: { message: 'Synthetic upload URL unavailable. Try again.' } });
            }
          }
          return json({ uploadURL: `${url.origin}/synthetic-upload`, objectPath: '/synthetic/replacement.png' });
        }
        if (path === '/synthetic-upload') {
          const response = responses.put.shift();
          if (response) await response.ready;
          return route.fulfill({ status: response?.status ?? 200, body: '' });
        }
        if (path === '/api/dates' && request.method() === 'POST') {
          return json({ ...plan, ...request.postDataJSON(), id: 900005 });
        }
        if ((path === `/api/memories/${memory.id}` && request.method() === 'PATCH')
          || (path === '/api/memories' && request.method() === 'POST')) {
          const method = request.method() as MemoryMethod;
          const response = memoryResponses[method].shift();
          if (response) {
            await response.ready;
            if (response.status >= 400) {
              return route.fulfill({
                status: response.status,
                json: { message: 'Synthetic memory save unavailable. Your draft is still here — try saving again.' },
              });
            }
          }
          return route.fulfill({
            status: response?.status ?? 200,
            json: { ...memory, ...request.postDataJSON(), id: method === 'POST' ? 900006 : memory.id },
          });
        }
      }
      network.unexpected.push(`${request.method()} ${path}`);
      return route.abort();
    });
    try {
      await use(network);
    } finally {
      // Never leave an intercepted request held when a test assertion fails.
      for (const release of releases) release();
    }
    expect(network.unexpected, 'Unexpected requests must fail closed, never reach a provider').toEqual([]);
    expect(errors, 'No uncaught browser errors').toEqual([]);
  }, { auto: true }],
});

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.project.name.endsWith('large-text')) {
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        // Double text, not rem-based spacing/controls. Cover Tailwind's named
        // sizes and arbitrary pixel/rem sizes, including responsive headings.
        style.textContent = `:root{
          --text-xs:1.5rem;--text-sm:1.75rem;--text-base:2rem;
          --text-lg:2.25rem;--text-xl:2.5rem;--text-2xl:3rem;
          --text-3xl:3.75rem;--text-4xl:4.5rem
        }.eyebrow{font-size:24px!important}`;
        document.head.append(style);
        const sizes = new Set<string>();
        const enlargePixelUtilities = () => {
          for (const el of document.querySelectorAll('[class]')) {
            for (const name of el.classList) {
              const match = /^(?:(sm):)?text-\[(\d+(?:\.\d+)?)(px|rem)\]$/.exec(name);
              if (match && !sizes.has(name)) {
                sizes.add(name);
                const rule = `.${CSS.escape(name)}{font-size:${Number(match[2]) * 2}${match[3]}!important}`;
                style.sheet!.insertRule(match[1] ? `@media(min-width:640px){${rule}}` : rule);
              }
            }
          }
        };
        new MutationObserver(enlargePixelUtilities).observe(document.body, { childList: true, subtree: true });
        enlargePixelUtilities();
      });
    });
  }
});

export { expect };
