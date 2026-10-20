import { test, expect } from './fixtures';
import { couple, longTitle, plan } from './records';
import { inside, keyboardFocus, noHorizontalOverflow, reachable, scrollableDrawer, separate } from './assertions';

test('shell and real pages retain long content, navigation and the Propose label', async ({ page }) => {
  await page.goto('/home');
  const names = page.getByTestId('text-couple-names');
  await expect(names).toContainText(couple.yourName);
  await expect(names).toContainText(couple.partnerName);
  await inside(names, page.locator('main'));
  expect(await names.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await expect(page.getByTestId('couple-flywheel')).toBeVisible();
  await expect(page.getByTestId('link-flywheel-preferences')).toHaveAttribute('href', '/preferences');
  await expect(page.getByTestId('stage-flywheel-idea')).toHaveAttribute('aria-current', 'step');
  await expect(page.getByTestId('card-next-date')).toContainText(longTitle);
  await expect(page.getByTestId('badge-nav-inbox')).toHaveText('1');
  await noHorizontalOverflow(page);
  for (const nav of ['us', 'ideas', 'dates', 'memories', 'recap']) {
    const link = page.getByTestId(`nav-${nav}`);
    await reachable(link);
    await inside(link.locator('span').last(), link);
  }
  await keyboardFocus(page, page.getByTestId('link-settings'));
  await page.getByTestId('nav-dates').click();
  await expect(page.getByTestId('nav-dates')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('card-date-900004')).toContainText(longTitle);
  const propose = page.getByTestId('button-new-date');
  const label = propose.getByText('Propose', { exact: true });
  await expect(label).toBeVisible();
  await reachable(propose);
  await inside(label, propose);
  await separate(page.getByRole('heading', { level: 1 }), propose);
  await noHorizontalOverflow(page);
  const tabs = page.getByRole('tab');
  for (let i = 0; i < await tabs.count(); i++) {
    await inside(tabs.nth(i), page.getByRole('tablist'));
    for (let j = i + 1; j < await tabs.count(); j++) {
      await separate(tabs.nth(i), tabs.nth(j));
    }
  }
  await page.getByTestId('tab-upcoming').click();
  await expect(page.getByTestId(`card-date-${plan.id}`)).toContainText(longTitle);
  await page.getByTestId('nav-memories').click();
  await expect(page.getByTestId(`button-edit-memory-900003`)).toBeVisible();
  await reachable(page.getByTestId('button-new-memory'));
  await noHorizontalOverflow(page);
});

test('date drawer separates timezone/length and keeps submit reachable by keyboard', async ({ page, network }) => {
  await page.goto('/dates');
  await page.getByTestId('button-new-date').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading')).toHaveText('Propose a date');
  await page.getByTestId('input-date-title').fill(longTitle);
  await page.getByTestId('input-date-date').fill('2099-06-15');
  await page.getByTestId('input-date-time').fill('18:30');
  const timezone = page.getByTestId('input-date-timezone');
  const duration = page.getByTestId('select-date-duration');
  await timezone.fill(couple.timezone);
  await duration.selectOption('240');
  await separate(dialog.locator('label[for="df-tz"]'), dialog.locator('label[for="df-dur"]'));
  await separate(timezone, duration);
  await inside(timezone, dialog);
  await inside(duration, dialog);
  const submit = page.getByTestId('button-save-date');
  await scrollableDrawer(page, submit);
  await keyboardFocus(page, submit);
  expect(network.writes).toEqual([]);
  await page.keyboard.press('Enter');
  await expect.poll(() => network.writes.filter((w) => w.path === '/api/dates')).toHaveLength(1);
  expect(network.writes.find((w) => w.path === '/api/dates')!.data).toMatchObject({
    title: longTitle, timezone: couple.timezone, durationMinutes: 240,
    date: '2099-06-15', time: '18:30', status: 'proposed',
  });
  await expect(dialog).not.toBeVisible();
});

test('new memory drawer can scroll to and submit its save control', async ({ page, network }) => {
  await page.goto('/memories');
  await page.getByTestId('button-new-memory').click();
  await expect(page.getByRole('dialog').getByRole('heading')).toHaveText('Keep a memory');
  await page.getByTestId('input-memory-title').fill('Synthetic new memory');
  const submit = page.getByTestId('button-save-memory');
  await scrollableDrawer(page, submit);
  await keyboardFocus(page, submit);
  await page.keyboard.press('Enter');
  await expect.poll(() => network.writes.filter((w) => w.path === '/api/memories')).toHaveLength(1);
  expect(network.writes[0].data).toMatchObject({ title: 'Synthetic new memory', photoPath: null, dateId: null });
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
