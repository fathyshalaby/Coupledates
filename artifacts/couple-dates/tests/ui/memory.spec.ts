import { test, expect, png } from './fixtures';
import { memory } from './records';
import { keyboardFocus, reachable, scrollableDrawer } from './assertions';

const draft = {
  title: 'Unsaved synthetic title',
  note: 'An unsaved note that must survive photo operations.',
  date: '2026-07-19',
  category: 'Adventure',
};

// Pin the product boundary independently of MAX_BYTES so changing the
// implementation's limit cannot silently change the regression expectation.
const tenMB = 10 * 1024 * 1024;
function syntheticPhoto(size: number) {
  return {
    name: `synthetic-${size}.png`,
    mimeType: 'image/png',
    buffer: Buffer.concat([png, Buffer.alloc(size - png.length)]),
  };
}

async function assertDraft(page: import('@playwright/test').Page) {
  await expect(page.getByTestId('input-memory-title')).toHaveValue(draft.title);
  await expect(page.getByTestId('input-memory-note')).toHaveValue(draft.note);
  await expect(page.getByTestId('input-memory-date')).toHaveValue(draft.date);
  await expect(page.getByTestId('option-category-adventure')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('toggle-favorite')).toHaveAttribute('aria-pressed', 'true');
}

async function openDraft(page: import('@playwright/test').Page) {
  await page.goto('/memories');
  await page.getByTestId(`button-edit-memory-${memory.id}`).click();
  await expect(page.getByRole('dialog').getByRole('heading')).toHaveText('Edit memory');
  await fillDraft(page);
}

async function fillDraft(page: import('@playwright/test').Page) {
  await page.getByTestId('input-memory-title').fill(draft.title);
  await page.getByTestId('input-memory-note').fill(draft.note);
  await page.getByTestId('input-memory-date').fill(draft.date);
  await page.getByTestId('option-category-adventure').click();
  await page.getByTestId('toggle-favorite').click();
}

for (const mode of ['create', 'edit'] as const) {
  test(`${mode} save failure keeps the complete draft open until an explicit retry succeeds`, async ({ page, network }) => {
    const method = mode === 'create' ? 'POST' : 'PATCH';
    const path = mode === 'create' ? '/api/memories' : `/api/memories/${memory.id}`;
    const memoryWrites = () => network.writes.filter((w) => w.path.startsWith('/api/memories'));
    const releaseFailure = network.queueMemoryResponse(method, 503, true);
    const releaseSuccess = network.queueMemoryResponse(method, 200, true);
    if (mode === 'edit') {
      await openDraft(page);
    } else {
      await page.goto('/memories');
      await page.getByTestId('button-new-memory').click();
      await fillDraft(page);
    }
    const dialog = page.getByRole('dialog');
    const heading = mode === 'create' ? 'Keep a memory' : 'Edit memory';
    await page.getByTestId('input-photo').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: png });
    const save = page.getByTestId('button-save-memory');
    await expect(save).toBeEnabled();
    const photo = page.getByRole('img', { name: 'Selected photo' });
    await expect(photo).toHaveAttribute('src', /^blob:/);
    const photoSrc = await photo.getAttribute('src');
    const expectedWrite = {
      method, path,
      data: { ...draft, favorite: true, photoPath: '/synthetic/replacement.png', dateId: mode === 'create' ? null : memory.dateId },
    };
    const assertOpenDraft = async () => {
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('heading')).toHaveText(heading);
      await assertDraft(page);
      // A remount or reset must not discard the selected local preview.
      await expect(photo).toHaveAttribute('src', photoSrc!);
    };
    expect(memoryWrites()).toEqual([]);
    await save.click();
    await expect.poll(memoryWrites).toHaveLength(1);
    await expect(save).toBeDisabled();
    await expect(save).toHaveText('Saving...');
    await assertOpenDraft();
    // Repeated activation of a pending save must not submit a second write.
    await save.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
    expect(memoryWrites()).toEqual([expectedWrite]);
    releaseFailure();

    const error = page.getByTestId('text-memory-error');
    await expect(error).toHaveAttribute('role', 'alert');
    await expect(error).toHaveText('Synthetic memory save unavailable. Your draft is still here — try saving again.');
    await expect(save).toBeEnabled();
    await expect(save).toHaveText(mode === 'create' ? 'Keep this memory' : 'Save changes');
    await assertOpenDraft();
    // Observe beyond React Query's initial retry delay: failure must not
    // silently retry, close the drawer, or write before the user's next click.
    await page.waitForTimeout(1200);
    expect(memoryWrites()).toEqual([expectedWrite]);
    await assertOpenDraft();

    await save.click();
    await expect.poll(memoryWrites).toHaveLength(2);
    await expect(save).toBeDisabled();
    await expect(save).toHaveText('Saving...');
    await expect(error).toHaveCount(0);
    await assertOpenDraft();
    await save.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
    expect(memoryWrites()).toEqual([expectedWrite, expectedWrite]);
    // Retrying the memory write must reuse the successful upload, not upload
    // the photo again or lose either the null/new or existing album link.
    expect(network.writes.filter((w) => !w.path.startsWith('/api/memories'))).toEqual([
      { method: 'POST', path: '/api/storage/uploads/request-url', data: { name: 'synthetic.png', size: png.length, contentType: 'image/png' } },
      { method: 'PUT', path: '/synthetic-upload', data: {} },
    ]);
    releaseSuccess();
    await expect(dialog).not.toBeVisible();
    expect(memoryWrites()).toEqual([expectedWrite, expectedWrite]);
  });
}

for (const action of ['change', 'remove'] as const) {
  test(`photo ${action} preserves every draft field and only saves on explicit submit`, async ({ page, network }) => {
    await openDraft(page);

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

for (const stage of ['request-url', 'put'] as const) {
  for (const recovery of ['retry', 'discard'] as const) {
    test(`${stage} failure preserves the draft through pending, failure and ${recovery}`, async ({ page, network }) => {
      const releaseFailure = network.queueUploadResponse(stage, 503, true);
      const failedPath = stage === 'request-url' ? '/api/storage/uploads/request-url' : '/synthetic-upload';
      const memoryWrites = () => network.writes.filter((w) => w.path.startsWith('/api/memories'));
      const uploadWrites = (path: string) => network.writes.filter((w) => w.path === path);
      await openDraft(page);
      await page.getByTestId('input-photo').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: png });

      await expect.poll(() => uploadWrites(failedPath)).toHaveLength(1);
      const save = page.getByTestId('button-save-memory');
      await expect(save).toBeDisabled();
      await expect(save).toHaveText('Waiting for photo...');
      await expect(page.getByText('Uploading', { exact: true })).toBeVisible();
      await assertDraft(page);
      expect(memoryWrites()).toEqual([]);
      // Even native form submission must not bypass the pending/failed guard.
      await save.evaluate((button: HTMLButtonElement) => button.form!.requestSubmit());
      expect(memoryWrites()).toEqual([]);
      releaseFailure();

      await expect(page.getByTestId('text-memory-error')).toContainText(
        stage === 'request-url' ? 'Synthetic upload URL unavailable' : 'Photo upload failed (503)',
      );
      await expect(save).toBeDisabled();
      await expect(page.getByTestId('button-retry-photo')).toBeVisible();
      await expect(page.getByTestId('button-skip-failed-photo')).toBeVisible();
      await assertDraft(page);
      await save.evaluate((button: HTMLButtonElement) => button.form!.requestSubmit());
      expect(memoryWrites()).toEqual([]);
      expect(uploadWrites('/api/storage/uploads/request-url')).toHaveLength(1);
      expect(uploadWrites('/synthetic-upload')).toHaveLength(stage === 'put' ? 1 : 0);

      if (recovery === 'retry') {
        const releaseRetry = network.queueUploadResponse('put', 200, true);
        await page.getByTestId('button-retry-photo').click();
        await expect.poll(() => uploadWrites('/synthetic-upload')).toHaveLength(stage === 'put' ? 2 : 1);
        await expect(save).toBeDisabled();
        await expect(save).toHaveText('Waiting for photo...');
        await assertDraft(page);
        expect(memoryWrites()).toEqual([]);
        releaseRetry();
        await expect(save).toBeEnabled();
        expect(uploadWrites('/api/storage/uploads/request-url')).toHaveLength(2);
        for (const write of uploadWrites('/api/storage/uploads/request-url')) {
          expect(write.data).toEqual({ name: 'synthetic.png', size: png.length, contentType: 'image/png' });
        }
        await expect(page.getByRole('img', { name: 'Selected photo' })).toHaveAttribute('src', /^blob:/);
      } else {
        await page.getByTestId('button-skip-failed-photo').click();
        await expect(save).toBeEnabled();
        await expect(page.getByRole('img', { name: 'Selected photo' })).toHaveAttribute('src', '/api/storage/synthetic/original.png');
        expect(uploadWrites('/api/storage/uploads/request-url')).toHaveLength(1);
        expect(uploadWrites('/synthetic-upload')).toHaveLength(stage === 'put' ? 1 : 0);
      }
      await expect(page.getByTestId('text-memory-error')).toHaveCount(0);
      await expect(page.getByTestId('button-retry-photo')).toHaveCount(0);
      await expect(page.getByTestId('button-skip-failed-photo')).toHaveCount(0);
      await assertDraft(page);
      expect(memoryWrites()).toEqual([]);
      await save.click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
      // The full payload proves the hidden album link survives every stage too.
      expect(memoryWrites()).toEqual([{
        method: 'PATCH', path: `/api/memories/${memory.id}`,
        data: {
          ...draft, favorite: true, dateId: memory.dateId,
          photoPath: recovery === 'retry' ? '/synthetic/replacement.png' : memory.photoPath,
        },
      }]);
    });
  }
}

for (const file of [
  { name: 'not-a-photo.pdf', mimeType: 'application/pdf' },
  { name: 'unknown-photo.xyz', mimeType: '' },
]) {
  test(`rejecting ${file.name} preserves the draft and discard restores the original photo`, async ({ page, network }) => {
    await openDraft(page);
    await page.getByTestId('input-photo').setInputFiles({ ...file, buffer: Buffer.from('synthetic non-photo') });
    const save = page.getByTestId('button-save-memory');
    for (const attempt of ['selection', 'retry']) {
      if (attempt === 'retry') await page.getByTestId('button-retry-photo').click();
      await expect(page.getByTestId('text-memory-error')).toContainText(`"${file.name}" isn't a supported photo`);
      await expect(save).toBeDisabled();
      await assertDraft(page);
      await save.evaluate((button: HTMLButtonElement) => button.form!.requestSubmit());
      expect(network.writes).toEqual([]);
    }
    await page.getByTestId('button-skip-failed-photo').click();
    await assertDraft(page);
    await expect(save).toBeEnabled();
    await expect(page.getByTestId('text-memory-error')).toHaveCount(0);
    await expect(page.getByTestId('button-retry-photo')).toHaveCount(0);
    await expect(page.getByTestId('button-skip-failed-photo')).toHaveCount(0);
    await expect(page.getByRole('img', { name: 'Selected photo' })).toHaveAttribute('src', '/api/storage/synthetic/original.png');
    expect(network.writes).toEqual([]);
    await save.click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    expect(network.writes).toEqual([{
      method: 'PATCH', path: `/api/memories/${memory.id}`,
      data: { ...draft, favorite: true, dateId: memory.dateId, photoPath: memory.photoPath },
    }]);
  });
}

for (const size of [tenMB - 1, tenMB]) {
  test(`a ${size}-byte photo is accepted without losing the draft or album link`, async ({ page, network }) => {
    const releaseUpload = network.queueUploadResponse('put', 200, true);
    const file = syntheticPhoto(size);
    await openDraft(page);
    await page.getByTestId('input-photo').setInputFiles(file);
    await expect.poll(() => network.writes.filter((w) => w.path === '/synthetic-upload')).toHaveLength(1);
    expect(network.writes).toEqual([
      {
        method: 'POST', path: '/api/storage/uploads/request-url',
        data: { name: file.name, size, contentType: file.mimeType },
      },
      { method: 'PUT', path: '/synthetic-upload', data: {} },
    ]);
    const save = page.getByTestId('button-save-memory');
    await expect(save).toBeDisabled();
    await expect(save).toHaveText('Waiting for photo...');
    await assertDraft(page);
    releaseUpload();
    await expect(save).toBeEnabled();
    await expect(page.getByTestId('text-memory-error')).toHaveCount(0);
    await expect(page.getByRole('img', { name: 'Selected photo' })).toHaveAttribute('src', /^blob:/);
    await assertDraft(page);
    expect(network.writes.filter((w) => w.path.startsWith('/api/memories'))).toEqual([]);
    await save.click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    expect(network.writes.filter((w) => w.path.startsWith('/api/memories'))).toEqual([{
      method: 'PATCH', path: `/api/memories/${memory.id}`,
      data: { ...draft, favorite: true, dateId: memory.dateId, photoPath: '/synthetic/replacement.png' },
    }]);
  });
}

for (const recovery of ['replacement', 'discard'] as const) {
  test(`a photo one byte over 10 MB is rejected locally and preserves the draft through ${recovery}`, async ({ page, network }) => {
    await openDraft(page);
    await page.getByTestId('input-photo').setInputFiles(syntheticPhoto(tenMB + 1));
    const save = page.getByTestId('button-save-memory');
    for (const attempt of ['selection', 'retry']) {
      if (attempt === 'retry') await page.getByTestId('button-retry-photo').click();
      await expect(page.getByTestId('text-memory-error')).toHaveText(
        'That photo is 10.0 MB — the limit is 10 MB. Try a smaller one.',
      );
      await expect(save).toBeDisabled();
      await expect(page.getByTestId('button-retry-photo')).toBeVisible();
      await expect(page.getByTestId('button-skip-failed-photo')).toBeVisible();
      await expect(page.getByRole('img', { name: 'Selected photo' })).toHaveAttribute('src', '/api/storage/synthetic/original.png');
      // A disabled button and the submit handler both protect the draft.
      await save.evaluate((button: HTMLButtonElement) => button.form!.requestSubmit());
      await assertDraft(page);
      // Includes the URL request, storage PUT and memory write: none may occur.
      expect(network.writes).toEqual([]);
    }

    if (recovery === 'replacement') {
      await page.getByTestId('input-photo').setInputFiles({ name: 'smaller.png', mimeType: 'image/png', buffer: png });
      await expect(save).toBeEnabled();
      expect(network.writes).toEqual([
        {
          method: 'POST', path: '/api/storage/uploads/request-url',
          data: { name: 'smaller.png', size: png.length, contentType: 'image/png' },
        },
        { method: 'PUT', path: '/synthetic-upload', data: {} },
      ]);
      await expect(page.getByRole('img', { name: 'Selected photo' })).toHaveAttribute('src', /^blob:/);
    } else {
      await page.getByTestId('button-skip-failed-photo').click();
      await expect(save).toBeEnabled();
      await expect(page.getByRole('img', { name: 'Selected photo' })).toHaveAttribute('src', '/api/storage/synthetic/original.png');
      expect(network.writes).toEqual([]);
    }
    await expect(page.getByTestId('text-memory-error')).toHaveCount(0);
    await expect(page.getByTestId('button-retry-photo')).toHaveCount(0);
    await expect(page.getByTestId('button-skip-failed-photo')).toHaveCount(0);
    await assertDraft(page);
    expect(network.writes.filter((w) => w.path.startsWith('/api/memories'))).toEqual([]);
    await save.click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    expect(network.writes.filter((w) => w.path.startsWith('/api/memories'))).toEqual([{
      method: 'PATCH', path: `/api/memories/${memory.id}`,
      data: {
        ...draft, favorite: true, dateId: memory.dateId,
        photoPath: recovery === 'replacement' ? '/synthetic/replacement.png' : memory.photoPath,
      },
    }]);
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
