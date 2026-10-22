import { test, expect } from './fixtures';
import { memory } from './records';

test('memory share cards show short and long titles fully and download the preview layout', async ({ page }) => {
  const titles = [
    'A quiet evening together',
    'A celebration that brought our families together for a long weekend of cooking, music, stories, and late-night walks under the stars',
    'Tarde de café con Sofía — ¡qué bonito! ☕💛',
  ];
  await page.addInitScript(() => {
    const exportedCards: { text: string; x: number; y: number; font: string }[][] = [];
    let currentCard: { text: string; x: number; y: number; font: string }[] = [];
    (window as Window & { __shareCardExportedText?: typeof exportedCards }).__shareCardExportedText = exportedCards;

    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
      if (this.canvas.width === 1080 && this.canvas.height === 1350) {
        currentCard.push({ text: String(text), x, y, font: this.font });
      }
      return originalFillText.call(this, text, x, y, maxWidth);
    };
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      if (this.width === 1080 && this.height === 1350) {
        exportedCards.push(currentCard);
        currentCard = [];
      }
      return originalToBlob.call(this, callback, type, quality);
    };
    const originalAnchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      (window as Window & { __downloadedShareCardHref?: string }).__downloadedShareCardHref = this.href;
      return originalAnchorClick.call(this);
    };
  });

  for (const title of titles) {
    await page.route('**/api/memories', (route) => route.fulfill({ json: [{ ...memory, title }] }));
    await page.goto('/memories');
    await page.getByTestId('button-share-memory-900003').click();
    const preview = page.getByTestId('img-share-preview');
    await expect(preview).toBeVisible();
    const previewUrl = await preview.getAttribute('src');
    const cards = await page.evaluate(() =>
      (window as Window & { __shareCardExportedText?: { text: string; x: number; y: number; font: string }[][] }).__shareCardExportedText || []
    );
    const card = cards.at(-1);
    expect(card).toBeDefined();

    const label = card!.find(({ text }) => text === 'A LITTLE MOMENT FROM US');
    const brand = card!.find(({ text }) => text === 'COUPLE DATES');
    expect(label).toBeDefined();
    expect(brand).toBeDefined();
    const titleRows = card!.filter(({ y }) => y >= 950 && y < brand!.y);
    expect(titleRows.length).toBeGreaterThan(0);
    expect(titleRows.map(({ text }) => text).join(' ').replace(/\s+/g, ' ').trim()).toBe(title);
    const lastTitleRow = titleRows.at(-1)!;
    const fontSize = Number(lastTitleRow.font.match(/(\d+(?:\.\d+)?)px/)?.[1]);
    expect(brand!.y - lastTitleRow.y).toBeGreaterThanOrEqual(fontSize + 18);
    expect(brand!.y).toBe(1260);
    expect(titleRows[0].y - label!.y).toBeGreaterThan(fontSize / 2);
    expect(card!.some(({ text }) => text === 'FOOD' || text === '2026-06-15')).toBe(false);

    await page.getByTestId('button-share-confirm').click();
    const download = page.waitForEvent('download');
    await page.getByTestId('button-share-download').click();
    await expect(download).resolves.toBeTruthy();
    expect(await page.evaluate(() => (window as Window & { __downloadedShareCardHref?: string }).__downloadedShareCardHref)).toBe(previewUrl);
    await page.getByTestId('button-share-cancel').click();
  }
});

test('memory sharing requires explicit consent before download or caption copy', async ({ page, network }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => { (window as Window & { __copiedCaption?: string }).__copiedCaption = text; } },
    });
  });
  await page.goto('/memories');
  await page.getByTestId('button-share-memory-900003').click();

  const dialog = page.getByTestId('dialog-share-preview');
  await expect(dialog).toBeVisible();
  const photoOption = page.getByTestId('checkbox-share-photo');
  await expect(photoOption).not.toBeChecked();
  const originalPreview = await page.getByTestId('img-share-preview').getAttribute('src');
  await photoOption.check();
  await expect.poll(() => page.getByTestId('img-share-preview').getAttribute('src')).not.toBe(originalPreview);
  await photoOption.uncheck();
  await expect.poll(() => page.getByTestId('img-share-preview').getAttribute('src')).not.toBe(originalPreview);
  await expect(page.getByTestId('text-share-caption-preview')).toContainText('A little moment from us:');
  await expect(page.getByTestId('text-share-caption-preview')).toContainText('#CoupleDates');
  await expect(page.getByTestId('text-share-caption-preview')).not.toContainText('Food');
  await expect(page.getByTestId('text-share-caption-preview')).not.toContainText('2026-06-15');
  await expect(page.getByTestId('text-share-warning')).toContainText('may save or repost');
  await expect(page.getByTestId('button-share-confirm')).toHaveText('I understand — continue');
  await expect(page.getByTestId('button-share-download')).toHaveCount(0);
  await expect(page.getByTestId('button-share-copy-caption')).toHaveCount(0);
  await expect(page.getByTestId('share-manual-fallback')).toHaveCount(0);
  expect(network.writes).toEqual([]);

  await page.getByTestId('button-share-confirm').click();
  await expect(page.getByTestId('share-manual-fallback')).toContainText('This browser can’t send the image directly to another app.');
  await expect(page.getByTestId('text-share-caption')).toHaveValue(/#CoupleDates/);
  await expect(page.getByTestId('share-manual-fallback').getByRole('link')).toHaveCount(0);
  await expect(page.getByTestId('button-share-download')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByTestId('button-share-download-copy').click();
  await expect(download).resolves.toBeTruthy();
  await expect(page.getByTestId('text-share-copied')).toContainText('Image downloaded and caption copied.');
  expect(await page.evaluate(() => (window as Window & { __copiedCaption?: string }).__copiedCaption)).toContain('#CoupleDates');
  await page.getByTestId('button-share-copy-caption').click();
  await expect(page.getByTestId('text-share-copied')).toContainText('Caption copied.');
  expect(network.writes).toEqual([]);
});

test('manual fallback keeps the exact caption selectable when clipboard access fails', async ({ page, network }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => { throw new Error('Clipboard permission denied'); } },
    });
  });
  await page.goto('/memories');
  await page.getByTestId('button-share-memory-900003').click();
  const approvedCaption = await page.getByTestId('text-share-caption-preview').textContent();
  await page.getByTestId('button-share-confirm').click();

  const download = page.waitForEvent('download');
  await page.getByTestId('button-share-download-copy').click();
  await expect(download).resolves.toBeTruthy();
  await expect(page.getByTestId('text-share-error')).toContainText('Clipboard access is blocked.');
  const manualFallback = page.getByTestId('share-manual-fallback');
  await expect(manualFallback).toContainText('Nothing is uploaded and no private link is shared.');
  await expect(manualFallback).toContainText('On a phone, press and hold the caption, choose Select All, then Copy.');
  await expect(manualFallback).toContainText('On a computer, use Ctrl+C or ⌘C.');
  const captionField = page.getByTestId('text-share-caption');
  await expect(captionField).toHaveValue(approvedCaption || '');
  await page.getByTestId('button-share-select-caption').click();
  const selection = await captionField.evaluate((element: HTMLTextAreaElement) => ({
    selectedText: element.value.slice(element.selectionStart, element.selectionEnd),
    value: element.value,
  }));
  expect(selection.selectedText).toBe(approvedCaption);
  expect(selection.value).toBe(approvedCaption);
  expect(network.writes).toEqual([]);
});

test('supported native file share happens only after the second confirmation action', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: (data: ShareData) => !!data.files?.length });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        (window as Window & { __sharedFileName?: string }).__sharedFileName = data.files?.[0]?.name;
        (window as Window & { __sharedText?: string }).__sharedText = data.text;
      },
    });
  });
  await page.goto('/memories');
  await page.getByTestId('button-share-memory-900003').click();
  const confirm = page.getByTestId('button-share-confirm');
  await expect(confirm).toHaveText('Share image');
  expect(await page.evaluate(() => (window as Window & { __sharedFileName?: string }).__sharedFileName)).toBeUndefined();
  await confirm.click();
  await expect.poll(() => page.evaluate(() => (window as Window & { __sharedFileName?: string }).__sharedFileName)).toBe('memory-card.png');
  await expect.poll(() => page.evaluate(() => (window as Window & { __sharedText?: string }).__sharedText)).toContain('#CoupleDates');
  expect(await page.evaluate(() => (window as Window & { __sharedText?: string }).__sharedText)).toContain('A very long synthetic date title');
  const sharedText = await page.evaluate(() => (window as Window & { __sharedText?: string }).__sharedText || '');
  expect(sharedText).not.toContain('Food');
  expect(sharedText).not.toContain('2026-06-15');
  expect(sharedText).not.toContain('Original synthetic note');
  await expect(page.getByTestId('dialog-share-preview')).not.toBeVisible();
});

test('canceling native sharing says nothing was sent and leaves the reviewed card open', async ({ page, network }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: (data: ShareData) => !!data.files?.length });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async () => { throw new DOMException('User canceled', 'AbortError'); },
    });
  });
  await page.goto('/memories');
  await page.getByTestId('button-share-memory-900003').click();
  const dialog = page.getByTestId('dialog-share-preview');
  await page.getByTestId('button-share-confirm').click();

  await expect(page.getByTestId('text-share-error')).toHaveText('Sharing was canceled. Nothing was sent.');
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('img-share-preview')).toBeVisible();
  await expect(page.getByTestId('button-share-confirm')).toHaveText('Share image');
  await expect(page.getByTestId('share-manual-fallback')).toHaveCount(0);
  expect(network.writes).toEqual([]);
});

test('rejected native sharing exposes download-and-copy fallback without uploading or sharing private links', async ({ page, network }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: (data: ShareData) => !!data.files?.length });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async () => { throw new Error('Share target unavailable'); },
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => { (window as Window & { __copiedCaption?: string }).__copiedCaption = text; } },
    });
  });
  await page.goto('/memories');
  await page.getByTestId('button-share-memory-900003').click();
  await page.getByTestId('button-share-confirm').click();

  await expect(page.getByTestId('text-share-error')).toContainText('Sharing did not complete.');
  await expect(page.getByTestId('share-manual-fallback')).toContainText('Nothing is uploaded and no private link is shared.');
  await expect(page.getByTestId('share-manual-fallback')).toContainText('could not be sent to another app');
  await expect(page.getByTestId('share-manual-fallback').getByRole('link')).toHaveCount(0);
  const download = page.waitForEvent('download');
  await page.getByTestId('button-share-download-copy').click();
  await expect(download).resolves.toBeTruthy();
  await expect(page.getByTestId('text-share-copied')).toContainText('Image downloaded and caption copied.');
  expect(await page.evaluate(() => (window as Window & { __copiedCaption?: string }).__copiedCaption)).toContain('#CoupleDates');
  expect(network.writes).toEqual([]);
  await expect(page.getByTestId('dialog-share-preview')).toBeVisible();
});

test('recap sharing includes only selected details and keeps the caption aligned with its preview', async ({ page, network }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => { (window as Window & { __copiedCaption?: string }).__copiedCaption = text; } },
    });

    const exportedCardText: string[][] = [];
    let currentDrawnText: string[] = [];
    (window as Window & { __shareCardExportedText?: string[][] }).__shareCardExportedText = exportedCardText;
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
      if (this.canvas.width === 1080 && this.canvas.height === 1350) currentDrawnText.push(String(text));
      return originalFillText.call(this, text, x, y, maxWidth);
    };

    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      if (this.width === 1080 && this.height === 1350) {
        exportedCardText.push(currentDrawnText);
        currentDrawnText = [];
      }
      return originalToBlob.call(this, callback, type, quality);
    };
  });
  await page.goto('/recap');
  const year = await page.getByTestId('text-recap-year').textContent();
  await page.getByTestId('button-share-recap').click();
  await expect(page.getByTestId('img-share-preview')).toHaveAttribute('alt', `Preview of ${year} recap share card`);
  const defaultCaption = `Our ${year}, one moment at a time. 💛 #CoupleDates`;
  await expect(page.getByTestId('text-share-caption-preview')).toHaveText(defaultCaption);
  await expect(page.getByTestId('checkbox-share-memory-count')).not.toBeChecked();
  await expect(page.getByTestId('checkbox-share-date-count')).not.toBeChecked();
  await page.getByTestId('checkbox-share-memory-count').check();
  await page.getByTestId('checkbox-share-date-count').check();
  await page.getByTestId('checkbox-share-top-category').check();
  const previewCaption = `Our ${year}, one moment at a time. 💛 1 memory · 2 dates · Food #CoupleDates`;
  await expect(page.getByTestId('text-share-caption-preview')).toHaveText(previewCaption);

  const selectedImageStats = ['1 memory', '2 dates', 'Top category · Food'];
  const excludedImageStats = ['average rating', 'active days', 'longest streak'];
  await expect.poll(() => page.evaluate(({ selected, excluded }) => {
    const exportedCards = (window as Window & { __shareCardExportedText?: string[][] }).__shareCardExportedText || [];
    return exportedCards.some((drawnText) =>
      selected.every((stat) => drawnText.includes(stat)) &&
      excluded.every((stat) => !drawnText.some((line) => line.includes(stat)))
    );
  }, { selected: selectedImageStats, excluded: excludedImageStats })).toBe(true);

  const exportedCaption = await page.getByTestId('text-share-caption-preview').textContent();
  const exportedCards = await page.evaluate(() =>
    (window as Window & { __shareCardExportedText?: string[][] }).__shareCardExportedText || []
  );
  const matchingImage = exportedCards.find((drawnText) =>
    selectedImageStats.every((stat) => drawnText.includes(stat))
  );
  expect(exportedCaption).toBe(previewCaption);
  expect(matchingImage).toBeDefined();
  for (const stat of selectedImageStats) {
    expect(matchingImage).toContain(stat);
    expect(previewCaption).toContain(stat === 'Top category · Food' ? 'Food' : stat);
  }
  for (const stat of excludedImageStats) {
    expect(matchingImage?.some((line) => line.includes(stat))).toBe(false);
  }

  await page.getByTestId('button-share-confirm').click();
  await page.getByTestId('button-share-copy-caption').click();

  const caption = await page.evaluate(() => (window as Window & { __copiedCaption?: string }).__copiedCaption);
  expect(caption).toBe(previewCaption);
  expect(caption).not.toContain('A very long synthetic date title');
  expect(caption).not.toContain('Original synthetic note');
  expect(network.writes).toEqual([]);
});

test('recap sharing keeps every selected detail inside the card and in the copied caption', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => { (window as Window & { __copiedCaption?: string }).__copiedCaption = text; } },
    });

    type DrawnLine = { text: string; x: number; y: number; font: string };
    const exportedCards: DrawnLine[][] = [];
    let currentCard: DrawnLine[] = [];
    (window as Window & { __shareCardExportedText?: DrawnLine[][] }).__shareCardExportedText = exportedCards;
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
      if (this.canvas.width === 1080 && this.canvas.height === 1350) {
        currentCard.push({ text: String(text), x, y, font: this.font });
      }
      return originalFillText.call(this, text, x, y, maxWidth);
    };
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      if (this.width === 1080 && this.height === 1350) {
        exportedCards.push(currentCard);
        currentCard = [];
      }
      return originalToBlob.call(this, callback, type, quality);
    };
  });

  await page.goto('/recap');
  const year = await page.getByTestId('text-recap-year').textContent();
  await page.getByTestId('button-share-recap').click();
  const selectedOptions = [
    'checkbox-share-memory-count',
    'checkbox-share-date-count',
    'checkbox-share-average-rating',
    'checkbox-share-active-days',
    'checkbox-share-longest-streak',
    'checkbox-share-top-category',
  ];
  for (const option of selectedOptions) await page.getByTestId(option).check();

  const details = [
    '1 memory',
    '2 dates',
    '4.5 average rating',
    '4 active days',
    '3-day longest streak',
    'Top category · Food',
  ];
  const caption = `Our ${year}, one moment at a time. 💛 1 memory · 2 dates · 4.5 average rating · 4 active days · 3-day longest streak · Food #CoupleDates`;
  await expect(page.getByTestId('text-share-caption-preview')).toHaveText(caption);
  await expect.poll(() => page.evaluate((expected) => {
    const cards = (window as Window & { __shareCardExportedText?: { text: string; x: number; y: number; font: string }[][] }).__shareCardExportedText || [];
    return cards.some((lines) => expected.every((detail) => lines.some(({ text }) => text === detail)));
  }, details)).toBe(true);

  const cards = await page.evaluate(() =>
    (window as Window & { __shareCardExportedText?: { text: string; x: number; y: number; font: string }[][] }).__shareCardExportedText || []
  );
  const card = cards.find((lines) => details.every((detail) => lines.some(({ text }) => text === detail)));
  expect(card).toBeDefined();
  const detailLines = details.map((detail) => card!.find(({ text }) => text === detail)!);
  expect(detailLines.every(({ y }) => y >= 1070 && y <= 1260)).toBe(true);
  expect(detailLines.every(({ x, font }) => x === 88 && font.includes('30px'))).toBe(true);
  expect(detailLines.map(({ y }) => y)).toEqual([...detailLines.map(({ y }) => y)].sort((a, b) => a - b));
  for (let index = 1; index < detailLines.length; index++) {
    expect(detailLines[index].y - detailLines[index - 1].y).toBeGreaterThanOrEqual(30);
  }
  for (const detail of details) expect(caption).toContain(detail === 'Top category · Food' ? 'Food' : detail);

  await page.getByTestId('button-share-confirm').click();
  await page.getByTestId('button-share-copy-caption').click();
  await expect.poll(() => page.evaluate(() => (window as Window & { __copiedCaption?: string }).__copiedCaption)).toBe(caption);
});

test('recap sharing omits unavailable rating and category options and exports no blank metrics', async ({ page }) => {
  await page.route('**/api/recap**', async (route) => {
    const year = Number(new URL(route.request().url()).searchParams.get('year'));
    await route.fulfill({
      json: {
        year,
        memoryCount: 1,
        dateCount: 1,
        averageRating: 0,
        topCategory: null,
        topMemories: [],
        longestStreak: 0,
        activeDays: 1,
        monthlyCounts: Array(12).fill(0),
      },
    });
  });
  await page.addInitScript(() => {
    const exportedCardText: string[][] = [];
    let currentDrawnText: string[] = [];
    (window as Window & { __shareCardExportedText?: string[][] }).__shareCardExportedText = exportedCardText;
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
      if (this.canvas.width === 1080 && this.canvas.height === 1350) currentDrawnText.push(String(text));
      return originalFillText.call(this, text, x, y, maxWidth);
    };
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      if (this.width === 1080 && this.height === 1350) {
        exportedCardText.push(currentDrawnText);
        currentDrawnText = [];
      }
      return originalToBlob.call(this, callback, type, quality);
    };
  });
  await page.goto('/recap');
  const year = await page.getByTestId('text-recap-year').textContent();
  await page.getByTestId('button-share-recap').click();

  await expect(page.getByTestId('checkbox-share-average-rating')).toHaveCount(0);
  await expect(page.getByTestId('checkbox-share-top-category')).toHaveCount(0);
  await expect(page.getByTestId('text-share-caption-preview')).toHaveText(`Our ${year}, one moment at a time. 💛 #CoupleDates`);

  await page.getByTestId('checkbox-share-memory-count').check();
  await page.getByTestId('checkbox-share-date-count').check();
  const caption = `Our ${year}, one moment at a time. 💛 1 memory · 1 date #CoupleDates`;
  await expect(page.getByTestId('text-share-caption-preview')).toHaveText(caption);

  await expect.poll(() => page.evaluate(() => {
    const cards = (window as Window & { __shareCardExportedText?: string[][] }).__shareCardExportedText || [];
    return cards.some((text) =>
      text.includes('1 memory') &&
      text.includes('1 date') &&
      !text.some((line) => /average rating|top category|undefined|null/i.test(line))
    );
  })).toBe(true);
  const exportedCards = await page.evaluate(() =>
    (window as Window & { __shareCardExportedText?: string[][] }).__shareCardExportedText || []
  );
  const exportedImage = exportedCards.find((text) => text.includes('1 memory') && text.includes('1 date'));
  expect(exportedImage).toBeDefined();
  expect(exportedImage?.some((line) => /average rating|top category|undefined|null/i.test(line))).toBe(false);
  expect(caption).not.toMatch(/average rating|top category|undefined|null|·\s*$/i);
});
