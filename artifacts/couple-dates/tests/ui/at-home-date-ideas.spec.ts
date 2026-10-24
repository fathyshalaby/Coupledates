import { test, expect } from './fixtures';

test('at-home date ideas are searchable, filterable, mobile-safe, and share unique metadata', async ({ page }) => {
  const response = await page.goto('/at-home-date-ideas');
  expect(response?.status()).toBe(200);

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Romantic at-home date ideas');
  await expect(page.getByRole('link', { name: 'Join the free beta' })).toHaveAttribute('href', '/sign-up');
  await expect(page.getByRole('status')).toHaveText('8 ideas to try');
  const productShot = page.getByRole('img', { name: /Real Couple Dates screen/ });
  await expect(productShot).toBeVisible();
  await expect(productShot).toHaveAttribute('src', /product-shots\/dates-mobile\.jpg$/);
  await expect.poll(() => productShot.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

  const title = 'Romantic At-Home Date Ideas for Two | Couple Dates';
  const description = 'Find romantic at-home date ideas for every budget and schedule, including long-distance options. Plan a date together in Couple Dates, free during beta.';
  const canonicalUrl = `${new URL(page.url()).origin}/at-home-date-ideas`;
  const productShotUrl = `${new URL(page.url()).origin}/product-shots/dates-mobile.jpg`;
  await expect(page).toHaveTitle(title);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', description);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', title);
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', description);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonicalUrl);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', productShotUrl);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content', title);
  await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute('content', description);
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', productShotUrl);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonicalUrl);

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

  const horizontalOverflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth > window.innerWidth,
    body: document.body.scrollWidth > window.innerWidth,
  }));
  expect(horizontalOverflow).toEqual({ document: false, body: false });
});
