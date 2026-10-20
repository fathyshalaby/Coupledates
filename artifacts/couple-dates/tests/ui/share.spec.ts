import { test, expect } from './fixtures';

test('memory sharing requires explicit consent before download or caption copy', async ({ page, network }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => undefined } });
  });
  await page.goto('/memories');
  await page.getByTestId('button-share-memory-900003').click();

  const dialog = page.getByTestId('dialog-share-preview');
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('text-share-warning')).toContainText('may save or repost');
  await expect(page.getByTestId('button-share-confirm')).toHaveText('I understand — continue');
  await expect(page.getByTestId('button-share-download')).toHaveCount(0);
  await expect(page.getByTestId('button-share-copy-caption')).toHaveCount(0);
  expect(network.writes).toEqual([]);

  await page.getByTestId('button-share-confirm').click();
  await expect(page.getByTestId('button-share-download')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByTestId('button-share-download').click();
  await expect(download).resolves.toBeTruthy();
  await page.getByTestId('button-share-copy-caption').click();
  await expect(page.getByTestId('text-share-copied')).toBeVisible();
  expect(network.writes).toEqual([]);
});

test('supported native file share happens only after the second confirmation action', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: (data: ShareData) => !!data.files?.length });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        (window as Window & { __sharedFileName?: string }).__sharedFileName = data.files?.[0]?.name;
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
  await expect(page.getByTestId('dialog-share-preview')).not.toBeVisible();
});
