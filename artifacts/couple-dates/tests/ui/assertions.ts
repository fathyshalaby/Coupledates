import { expect, type Locator, type Page } from '@playwright/test';

/** Visibility alone misses clipping, overflow and elements under the bottom nav. */
export async function reachable(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible();
  await expect.poll(() => locator.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return box.left >= -1 && box.right <= innerWidth + 1
      && box.top >= -1 && box.bottom <= innerHeight + 1
      && !!hit && (el === hit || el.contains(hit));
  }), { message: 'Control must be fully within the viewport and not covered' }).toBe(true);
}

export async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))).toEqual({
    viewport: page.viewportSize()!.width,
    document: page.viewportSize()!.width,
    body: page.viewportSize()!.width,
  });
}

export async function inside(inner: Locator, outer: Locator) {
  const a = await inner.boundingBox();
  const b = await outer.boundingBox();
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  expect(a!.x).toBeGreaterThanOrEqual(b!.x - 1);
  expect(a!.x + a!.width).toBeLessThanOrEqual(b!.x + b!.width + 1);
}

export async function separate(a: Locator, b: Locator) {
  const x = (await a.boundingBox())!;
  const y = (await b.boundingBox())!;
  expect(x).not.toBeNull();
  expect(y).not.toBeNull();
  expect(x.x + x.width <= y.x + 1 || y.x + y.width <= x.x + 1
    || x.y + x.height <= y.y + 1 || y.y + y.height <= x.y + 1,
  'Labels/controls must not overlap').toBe(true);
}

export async function keyboardFocus(page: Page, target: Locator) {
  // Use real Tab navigation, not element.focus(), to exercise :focus-visible.
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement)) break;
  }
  await expect(target).toBeFocused();
  expect(await target.evaluate((el) => {
    const style = getComputedStyle(el);
    return el.matches(':focus-visible')
      && ((style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2
        && style.outlineColor !== 'rgba(0, 0, 0, 0)') || style.boxShadow !== 'none');
  }), 'Keyboard focus must have a visible outline or ring').toBe(true);
  await reachable(target);
}

export async function scrollableDrawer(page: Page, submit: Locator) {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((el) => el.getBoundingClientRect().height)).toBeLessThanOrEqual(page.viewportSize()!.height);
  const form = dialog.locator('form');
  const metrics = await form.evaluate((el) => ({
    overflow: getComputedStyle(el).overflowY,
    needsScroll: el.scrollHeight > el.clientHeight,
  }));
  expect(['auto', 'scroll'].includes(metrics.overflow), 'Form must allow scrolling').toBe(true);
  if (page.viewportSize()!.width < 640) {
    expect(metrics.needsScroll, 'Phone drawer content should exercise scrolling').toBe(true);
  }
  await reachable(submit);
  if (metrics.needsScroll) {
    expect(await form.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  }
  await noHorizontalOverflow(page);
}
