import { test, expect, png } from './fixtures';
import { memory } from './records';
import { keyboardFocus, reachable, scrollableDrawer } from './assertions';

const draft = {
  title: 'Unsaved synthetic title',
  note: 'An unsaved note that must survive photo operations.',
  date: '2026-07-19',
  category: 'Adventure',
};

async function assertDraft(page: import('@playwright/test').Page) {
  await expect(page.getByTestId('input-memory-title')).toHaveValue(draft.title);
  await expect(page.getByTestId('input-memory-note')).toHaveValue(draft.note);
  await expect(page.getByTestId('input-memory-date')).toHaveValue(draft.date);
  await expect(page.getByTestId('option-category-adventure')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('toggle-favorite')).toHaveAttribute('aria-pressed', 'true');
}

for (const action of ['change', 'remove'] as const) {
  test(`photo ${action} preserves every draft field and only saves on explicit submit`, async ({ page, network }) => {
    await page.goto('/memories');
    await page.getByTestId(`button-edit-memory-${memory.id}`).click();
    await expect(page.getByRole('dialog').getByRole('heading')).toHaveText('Edit memory');
    await page.getByTestId('input-memory-title').fill(draft.title);
    await page.getByTestId('input-memory-note').fill(draft.note);
    await page.getByTestId('input-memory-date').fill(draft.date);
    await page.getByTestId('option-category-adventure').click();
    await page.getByTestId('toggle-favorite').click();

    const photoAction = page.getByTestId(`button-${action}-photo`);
    await reachable(photoAction);
    await keyboardFocus(page, photoAction);
    if (action === 'change') {
      const chooser = page.waitForEvent('filechooser');
      await page.keyboard.press('Enter');
      await (await chooser).setFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: png });
      await expect.poll(() => network.writes.filter((w) => w.path === '/synthetic-upload')).toHaveLength(1);
      await expect(page.getByTestId('button-change-photo')).toBeEnabled();
      await expect(page.getByRole('img', { name: 'Selected photo' })).toBeVisible();
    } else {
      await page.keyboard.press('Enter');
      await expect(page.getByRole('img', { name: 'Selected photo' })).toHaveCount(0);
      await expect(page.getByTestId('button-add-photo')).toBeVisible();
    }
    await assertDraft(page);
    expect(network.writes.filter((w) => w.path.startsWith('/api/memories'))).toEqual([]);
    const save = page.getByTestId('button-save-memory');
    await scrollableDrawer(page, save);
    await save.click();
    await expect.poll(() => network.writes.filter((w) => w.path === `/api/memories/${memory.id}`)).toHaveLength(1);
    expect(network.writes.find((w) => w.path === `/api/memories/${memory.id}`)!.data).toMatchObject({
      ...draft, dateId: memory.dateId, favorite: true,
      photoPath: action === 'remove' ? null : '/synthetic/replacement.png',
    });
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
}

test('canceling photo selection leaves draft untouched and does not submit', async ({ page, network }) => {
  await page.goto('/memories');
  await page.getByTestId(`button-edit-memory-${memory.id}`).click();
  await page.getByTestId('input-memory-title').fill(draft.title);
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('button-change-photo').click();
  // Empty selection reproduces closing the native picker without a file.
  await (await chooser).setFiles([]);
  await expect(page.getByTestId('input-memory-title')).toHaveValue(draft.title);
  await expect(page.getByTestId('input-memory-note')).toHaveValue(memory.note);
  await expect(page.getByRole('img', { name: 'Selected photo' })).toBeVisible();
  expect(network.writes).toEqual([]);
});
