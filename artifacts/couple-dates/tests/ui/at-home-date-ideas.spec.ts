import { test, expect } from './fixtures';

test('at-home date ideas are searchable, filterable, mobile-safe, and share unique metadata', async ({ page }) => {
  await page.goto('/at-home-date-ideas');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Romantic at-home date ideas');
  await expect(page.getByRole('link', { name: 'Join the free beta' })).toHaveAttribute('href', '/sign-up');
  await expect(page.getByRole('status')).toHaveText('8 ideas to try');
  await expect(page.getByRole('img', { name: /Real Couple Dates screen/ })).toBeVisible();
  await expect.poll(() => page.getByRole('img', { name: /Real Couple Dates screen/ }).evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

  await page.getByLabel('Budget').selectOption('free');
  await expect(page.getByRole('status')).toHaveText('5 ideas to try');
  await page.getByLabel('Date format').selectOption('online');
  await expect(page.getByRole('status')).toHaveText('4 ideas to try');
  await page.getByLabel('Search ideas').fill('music');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Trade three songs' })).toBeVisible();

  await page.getByLabel('Search ideas').fill('unmatched idea');
  await expect(page.getByText(/No ideas match those filters/)).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByRole('status')).toHaveText('8 ideas to try');

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBe(false);
});
