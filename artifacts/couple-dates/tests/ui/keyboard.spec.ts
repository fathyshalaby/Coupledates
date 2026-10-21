import { test, expect } from './fixtures';
import { installVisualViewport, keyboardHeight, syntheticSafeArea, visuallyReachable } from './mobile-viewport';
import { noHorizontalOverflow, reachable } from './assertions';

test.beforeEach(async ({ page }) => {
  await installVisualViewport(page);
});

for (const orientation of ['portrait', 'landscape'] as const) {
  for (const kind of ['date', 'new-memory', 'edit-memory'] as const) {
    test(`${kind}: ${orientation} keyboard open, resize, dismiss and reopen`, async ({ page, network }) => {
      await page.setViewportSize(orientation === 'portrait'
        ? { width: 390, height: 844 } : { width: 844, height: 390 });
      const date = kind === 'date';
      const inset = orientation === 'portrait' ? 34 : 21;
      await page.goto(date ? '/dates' : '/memories');
      await syntheticSafeArea(page, inset);
      const nav = page.locator('nav[aria-label="Main"]');
      await expect(nav).toHaveCSS('padding-bottom', `${inset}px`);
      const mainPadding = await page.locator('main').evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
      expect(mainPadding).toBeGreaterThan((await nav.boundingBox())!.height);
      await reachable(page.getByTestId('nav-memories'));

      const trigger = page.getByTestId(date ? 'button-new-date'
        : kind === 'edit-memory' ? 'button-edit-memory-900003' : 'button-new-memory');
      await trigger.click();
      const dialog = page.getByRole('dialog');
      const form = dialog.locator('form');
      const title = page.getByTestId(`input-${date ? 'date' : 'memory'}-title`);
      const submit = page.getByTestId(`button-save-${date ? 'date' : 'memory'}`);
      const formBottomPadding = await form.evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
      expect(formBottomPadding).toBeGreaterThan(32 + inset - 1);
      // Wait for the drawer's opening animation before measuring clearance.
      await expect.poll(() => submit.evaluate((el) => {
        const form = el.closest('form')!;
        form.scrollTop = form.scrollHeight;
        return el.getBoundingClientRect().bottom;
      })).toBeLessThanOrEqual((await page.evaluate(() => innerHeight)) - inset + 1);
      await form.evaluate((el) => { el.scrollTop = 0; });
      await title.fill(`Synthetic keyboard ${kind}`);
      if (date) await page.getByTestId('input-date-date').fill('2099-06-15');
      await title.focus();
      const layoutHeight = await page.evaluate(() => innerHeight);
      const occlusion = orientation === 'portrait' ? 330 : 170;
      await keyboardHeight(page, occlusion);
      expect(await page.evaluate(() => innerHeight)).toBe(layoutHeight);
      await expect(title).toBeFocused();
      await visuallyReachable(title);
      // The background nav is intentionally not reachable through a modal.
      expect(await nav.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + 20);
        return !!hit && el.contains(hit);
      })).toBe(false);

      const note = dialog.locator('textarea').last();
      await note.fill('Synthetic note while keyboard is open');
      await expect(note).toBeFocused();
      await visuallyReachable(note);
      // Predictive text / keyboard height changes without resizing layout.
      await keyboardHeight(page, occlusion + 30);
      await visuallyReachable(note);
      await visuallyReachable(submit);
      expect(await dialog.locator('form').evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
      expect(network.writes).toEqual([]);
      // Dismiss and restore repeatedly, preserving the unsaved draft.
      await keyboardHeight(page, 0);
      await title.focus();
      await expect(title).toHaveValue(`Synthetic keyboard ${kind}`);
      await visuallyReachable(title);
      await keyboardHeight(page, occlusion);
      await visuallyReachable(title);
      await visuallyReachable(submit);
      await submit.click();
      const path = date ? '/api/dates' : kind === 'edit-memory' ? '/api/memories/900003' : '/api/memories';
      await expect.poll(() => network.writes.filter((w) => w.path === path)).toHaveLength(1);
      expect(network.writes[0].data.title).toBe(`Synthetic keyboard ${kind}`);
      await expect(dialog).not.toBeVisible();
      await keyboardHeight(page, 0);
      await reachable(page.getByTestId('nav-memories'));
      await page.getByTestId('nav-memories').click();
      await expect(page.getByTestId('nav-memories')).toHaveAttribute('aria-current', 'page');
      await noHorizontalOverflow(page);
      // A fresh drawer must not retain the old viewport adjustments.
      await page.getByTestId('button-new-memory').click();
      await page.getByTestId('input-memory-title').focus();
      await visuallyReachable(page.getByTestId('input-memory-title'));
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  }
}
