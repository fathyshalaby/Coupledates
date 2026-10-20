import { test, expect } from './fixtures';

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
  await expect(page.getByTestId('text-share-warning')).toContainText('may save or repost');
  await expect(page.getByTestId('button-share-confirm')).toHaveText('I understand — continue');
  await expect(page.getByTestId('button-share-download')).toHaveCount(0);
  await expect(page.getByTestId('button-share-copy-caption')).toHaveCount(0);
  await expect(page.getByTestId('share-manual-fallback')).toHaveCount(0);
  expect(network.writes).toEqual([]);

  await page.getByTestId('button-share-confirm').click();
  await expect(page.getByTestId('share-manual-fallback')).toContainText('This browser can’t send the image directly to another app.');
  await expect(page.getByTestId('text-share-caption')).toContainText('Food');
  await expect(page.getByTestId('share-manual-fallback').getByRole('link')).toHaveCount(0);
  await expect(page.getByTestId('button-share-download')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByTestId('button-share-download-copy').click();
  await expect(download).resolves.toBeTruthy();
  await expect(page.getByTestId('text-share-copied')).toContainText('Image downloaded and caption copied.');
  expect(await page.evaluate(() => (window as Window & { __copiedCaption?: string }).__copiedCaption)).toContain('Food');
  await page.getByTestId('button-share-copy-caption').click();
  await expect(page.getByTestId('text-share-copied')).toContainText('Caption copied.');
  expect(network.writes).toEqual([]);
});

test('manual fallback reports clipboard failure while still downloading the image', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => { throw new Error('Clipboard permission denied'); } },
    });
  });
  await page.goto('/memories');
  await page.getByTestId('button-share-memory-900003').click();
  await page.getByTestId('button-share-confirm').click();

  const download = page.waitForEvent('download');
  await page.getByTestId('button-share-download-copy').click();
  await expect(download).resolves.toBeTruthy();
  await expect(page.getByTestId('text-share-error')).toContainText('The caption could not be copied. Check clipboard permission and try again.');
  await expect(page.getByTestId('share-manual-fallback')).toContainText('Nothing is uploaded and no private link is shared.');
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
  await expect.poll(() => page.evaluate(() => (window as Window & { __sharedText?: string }).__sharedText)).toContain('Food');
  expect(await page.evaluate(() => (window as Window & { __sharedText?: string }).__sharedText)).not.toContain('Original synthetic note');
  await expect(page.getByTestId('dialog-share-preview')).not.toBeVisible();
});

test('recap sharing includes aggregate details but not private memory titles or notes', async ({ page, network }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => { (window as Window & { __copiedCaption?: string }).__copiedCaption = text; } },
    });
  });
  await page.goto('/recap');
  const year = await page.getByTestId('text-recap-year').textContent();
  await page.getByTestId('button-share-recap').click();
  await expect(page.getByTestId('img-share-preview')).toHaveAttribute('alt', `Preview of ${year} recap share card`);
  await page.getByTestId('button-share-confirm').click();
  await page.getByTestId('button-share-copy-caption').click();

  const caption = await page.evaluate(() => (window as Window & { __copiedCaption?: string }).__copiedCaption);
  expect(caption).toBe(`${year}: 1 memory, 2 dates · Food`);
  expect(caption).not.toContain('A very long synthetic date title');
  expect(caption).not.toContain('Original synthetic note');
  expect(network.writes).toEqual([]);
});
