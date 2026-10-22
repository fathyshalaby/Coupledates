import { test, expect } from './fixtures';

test('the public couples journal works when opened directly while signed out', async ({ page }) => {
  const response = await page.goto('/couples-journal');
  expect(response?.status()).toBe(200);

  await expect(page.getByTestId('link-journal-signup-hero')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'A private couples journal for the life you’re making together.',
  );

  const productShot = page.getByRole('img', { name: /Couple Dates memories page showing a shared timeline/ });
  await expect(productShot).toBeVisible();
  await expect.poll(() => productShot.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(productShot).toHaveAttribute('src', /product-shots\/memories-mobile\.jpg$/);

  await expect(page.getByText('Private to the two people in your space')).toBeVisible();
  await expect(page.getByText(/Your journal is private to the two people in your shared space/)).toBeVisible();
  await expect(page.getByText(/If you choose to share socially, it’s opt-in for an individual memory you select/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A year can be more than dates on a calendar.' })).toBeVisible();
  await expect(page.getByText(/An optional yearly recap brings together the dates and memories you’ve added/)).toBeVisible();

  for (const testId of ['link-journal-signup-hero', 'link-journal-signup-plan', 'link-journal-signup-bottom']) {
    await expect(page.getByTestId(testId)).toHaveAttribute('href', '/sign-up');
  }

  const description = 'Turn the dates you plan together into a private couples journal of photos and notes. Revisit your timeline and yearly recap; share a memory only if you choose.';
  const title = 'Private Couples Journal & Shared Memory Book | Couple Dates';
  await expect(page).toHaveTitle(title);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', description);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', title);
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', description);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', /\/couples-journal$/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /product-shots\/memories-mobile\.jpg$/);
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content', title);
  await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute('content', description);
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', /product-shots\/memories-mobile\.jpg$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/couples-journal$/);

  const horizontalOverflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth > window.innerWidth,
    body: document.body.scrollWidth > window.innerWidth,
  }));
  expect(horizontalOverflow).toEqual({ document: false, body: false });
});
