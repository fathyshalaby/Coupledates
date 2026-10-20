import { test, expect } from './fixtures';

const dateModule = /\/src\/pages\/dates\.tsx(?:\?|$)/;

test('page downloads wait for navigation and keep navigation visible while loading', async ({ page }) => {
  const loadedPages: string[] = [];
  page.on('request', (request) => {
    if (/\/src\/pages\//.test(request.url())) loadedPages.push(request.url());
  });
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  await page.route(dateModule, async (route) => {
    await waiting;
    await route.continue();
  });

  await page.goto('/home');
  await expect(page.getByTestId('text-couple-names')).toBeVisible();
  expect(loadedPages.some((url) => /\/(dates|memories|billing|calendar|recap)\.tsx/.test(url))).toBe(false);
  await page.getByTestId('nav-dates').click();
  await expect(page.getByRole('status')).toContainText('Loading your space');
  await expect(page.getByTestId('nav-dates')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  release();
  await expect(page.getByTestId('button-new-date')).toBeVisible();
  await expect(page.getByTestId('state-loading-page')).toHaveCount(0);
  await page.getByTestId('nav-memories').click();
  await expect(page.getByTestId('button-new-memory')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('button-new-date')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('button-new-date')).toBeVisible();
});

test('a failed page download offers reload and does not disable navigation', async ({ page }) => {
  await page.route(dateModule, (route) => route.abort('failed'));
  await page.goto('/home');
  await expect(page.getByTestId('text-couple-names')).toBeVisible();
  await page.getByTestId('nav-dates').click();
  await expect(page.getByRole('alert')).toContainText('This page couldn’t open');
  await expect(page.getByRole('button', { name: 'Reload page' })).toBeVisible();
  await page.getByTestId('nav-us').click();
  await expect(page.getByTestId('text-couple-names')).toBeVisible();
  await page.getByTestId('nav-dates').click();
  await expect(page.getByTestId('state-page-error')).toBeVisible();
  await page.unroute(dateModule);
  await page.getByRole('button', { name: 'Reload page' }).click();
  await expect(page.getByTestId('button-new-date')).toBeVisible();
});
