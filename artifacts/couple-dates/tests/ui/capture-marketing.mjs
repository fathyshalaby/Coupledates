import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '../..');
const publicDir = path.join(appRoot, 'public');
const outputDir = path.join(publicDir, 'product-shots');
const origin = 'http://127.0.0.1:5189';

const dates = [
  {
    id: 730002, version: 2, title: 'Dinner by the canal', date: '2026-11-07',
    time: '19:30', timezone: 'Europe/Vienna', durationMinutes: 120,
    location: 'Neni am Prater', category: 'Food', notes: 'A table by the windows',
    status: 'planned', mode: 'in_person', rating: null, isProposer: true,
    canRespond: false, responseNote: '',
  },
  {
    id: 730003, version: 3, title: 'A film, then one more story', date: '2026-10-16',
    time: '20:00', timezone: 'Europe/Vienna', durationMinutes: 150,
    location: 'Rialto Cinema', category: 'Everyday',
    notes: 'We stayed for the conversation after.', status: 'completed',
    mode: 'in_person', rating: 5, isProposer: true, canRespond: false, responseNote: '',
  },
  {
    id: 730004, version: 1, title: 'Make pasta from scratch', date: '2026-11-14',
    time: '18:00', timezone: 'Europe/Vienna', durationMinutes: 120,
    location: 'At home', category: 'Everyday', notes: 'Pick the shape together',
    status: 'proposed', mode: 'online', rating: null, isProposer: false,
    canRespond: true, responseNote: '',
  },
];

const memories = [
  {
    id: 730010, title: 'The dumpling place you found',
    note: 'Ordered one of everything and shared the last chili crisp.',
    date: '2026-10-16', category: 'Food', photoPath: '/sample/noodles.jpg',
    favorite: true, dateId: 730003, createdAt: '2026-10-16T21:00:00Z',
  },
  {
    id: 730011, title: 'Slow Sunday, no plans',
    note: 'Coffee, a crossword, and nowhere else to be.',
    date: '2026-10-04', category: 'Everyday', photoPath: '/sample/kitchen.jpg',
    favorite: false, dateId: null, createdAt: '2026-10-04T14:00:00Z',
  },
  {
    id: 730012, title: 'We missed the last ferry',
    note: 'So we stayed to watch the sky change.',
    date: '2026-09-19', category: 'Adventure', photoPath: '/sample/shore.jpg',
    favorite: false, dateId: null, createdAt: '2026-09-19T22:00:00Z',
  },
];

const summary = {
  daysTogether: 612, memoryCount: memories.length, completedDates: 1,
  currentStreak: 9, longestStreak: 16, checkedInToday: false,
  weekDays: [
    { day: 'Mon', checkedIn: true }, { day: 'Tue', checkedIn: true },
    { day: 'Wed', checkedIn: false }, { day: 'Thu', checkedIn: true },
    { day: 'Fri', checkedIn: true }, { day: 'Sat', checkedIn: true },
    { day: 'Sun', checkedIn: false },
  ],
};

const images = {
  noodles: await readFile(path.join(publicDir, 'sample/noodles.jpg')),
  kitchen: await readFile(path.join(publicDir, 'sample/kitchen.jpg')),
  shore: await readFile(path.join(publicDir, 'sample/shore.jpg')),
};
const logo = await readFile(path.join(publicDir, 'logo.svg'));

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/repl/tools/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});

const captures = [
  { screen: 'home', file: 'home-mobile.jpg', width: 390, height: 844, dpr: 2, ready: 'text-couple-names' },
  { screen: 'dates', file: 'dates-mobile.jpg', width: 390, height: 844, dpr: 2, ready: 'button-new-date' },
  { screen: 'memories', file: 'memories-mobile.jpg', width: 390, height: 844, dpr: 2, ready: 'button-new-memory' },
  { screen: 'recap', file: 'recap-mobile.jpg', width: 390, height: 844, dpr: 2, ready: 'text-recap-headline' },
  { screen: 'memories', file: 'memories-desktop.jpg', width: 1280, height: 900, dpr: 1, ready: 'button-new-memory' },
];

try {
  for (const capture of captures) {
    const page = await browser.newPage({
      viewport: { width: capture.width, height: capture.height },
      deviceScaleFactor: capture.dpr,
      locale: 'en-US',
      timezoneId: 'Europe/Vienna',
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === '/logo.svg') return route.fulfill({ contentType: 'image/svg+xml', body: logo });
      if (request.method() === 'GET') {
        if (url.pathname === '/api/dates') return route.fulfill({ json: dates });
        if (url.pathname === '/api/memories') return route.fulfill({ json: memories });
        if (url.pathname === '/api/summary') return route.fulfill({ json: summary });
        if (url.pathname === '/api/preferences') return route.fulfill({
          json: [{ id: 730020, isYou: true, displayName: 'Noor' }, { id: 730021, isYou: false, displayName: 'Teo' }],
        });
        if (url.pathname === '/api/reminders') return route.fulfill({ json: [] });
        if (url.pathname === '/api/recap') return route.fulfill({
          json: {
            year: 2026, memoryCount: memories.length, dateCount: 1,
            averageRating: 5, topCategory: 'Food', topMemories: memories,
            longestStreak: 16, activeDays: 42,
            monthlyCounts: [1, 2, 4, 3, 2, 5, 4, 3, 5, 4, 0, 0],
          },
        });
        if (url.pathname.startsWith('/api/storage/')) {
          const key = url.pathname.includes('kitchen') ? 'kitchen' : url.pathname.includes('shore') ? 'shore' : 'noodles';
          return route.fulfill({ contentType: 'image/jpeg', body: images[key] });
        }
        if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
      }
      return route.continue();
    });

    await page.goto(`${origin}/marketing-capture.html?screen=${capture.screen}`);
    await page.getByTestId(capture.ready).waitFor({ timeout: 15_000 });
    if (capture.screen === 'recap') {
      await page.waitForTimeout(1_500); // Let the recap bars finish their staggered entrance.
      const barHeights = await page.getByTestId('chart-monthly').evaluate(element =>
        Array.from(element.children, column => column.firstElementChild?.getBoundingClientRect().height ?? 0));
      if (barHeights.some(height => height < 4)) throw new Error(`Recap chart has a missing bar: ${barHeights.join(', ')}`);
    }
    await page.screenshot({
      path: path.join(outputDir, capture.file),
      type: 'jpeg',
      quality: 90,
    });
    if (errors.length) throw new Error(`${capture.file} had browser errors: ${errors.join('; ')}`);
    console.log(`${capture.file}: ${capture.width}x${capture.height} @ ${capture.dpr}x`);
    await page.close();
  }
} finally {
  await browser.close();
}
