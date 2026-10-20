import { expect, type Locator, type Page } from '@playwright/test';

/** Change only the visual viewport, not innerHeight or CSS dvh. Headless
 * browsers never open an OS keyboard. Keep this explicit, not an iOS claim. */
export async function installVisualViewport(page: Page) {
  await page.addInitScript(() => {
    const viewport = new EventTarget();
    Object.assign(viewport, {
      width: innerWidth, height: innerHeight, offsetTop: 0, offsetLeft: 0,
      pageTop: 0, pageLeft: 0, scale: 1,
    });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  });
}

export async function keyboardHeight(page: Page, obscured: number) {
  await page.evaluate((amount) => {
    Object.assign(window.visualViewport!, { height: innerHeight - amount, width: innerWidth });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  }, obscured);
}

/** Replace env() values in the compiled *production* declarations, preserving
 * their selectors and arithmetic. This tests consumption, not hardware env(). */
export async function syntheticSafeArea(page: Page, bottom: number) {
  const count = await page.evaluate((inset) => {
    let replaced = 0;
    function visit(rules: CSSRuleList) {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSStyleRule) {
          for (const property of Array.from(rule.style)) {
            const value = rule.style.getPropertyValue(property);
            if (value.includes('env(safe-area-inset-bottom)')) {
              rule.style.setProperty(property,
                value.replaceAll('env(safe-area-inset-bottom)', `${inset}px`),
                rule.style.getPropertyPriority(property));
              replaced++;
            }
          }
        } else if ('cssRules' in rule) {
          visit((rule as CSSGroupingRule).cssRules);
        }
      }
    }
    for (const sheet of Array.from(document.styleSheets)) visit(sheet.cssRules);
    return replaced;
  }, bottom);
  expect(count, 'Must exercise real safe-area declarations, not test-only padding').toBeGreaterThanOrEqual(2);
}

/** Unlike reachable(), use the visual viewport bounds. Scrolling remains real;
 * no fixture CSS moves or shrinks the drawer to make this assertion pass. */
export async function visuallyReachable(control: Locator) {
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeVisible();
  await expect.poll(() => control.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const viewport = window.visualViewport!;
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return box.top >= viewport.offsetTop - 1
      && box.bottom <= viewport.offsetTop + viewport.height + 1
      && box.left >= viewport.offsetLeft - 1
      && box.right <= viewport.offsetLeft + viewport.width + 1
      && !!hit && (el === hit || el.contains(hit));
  }), { message: 'Control must be above the simulated keyboard, unclipped and hit-testable' }).toBe(true);
}
