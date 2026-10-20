# Shell and drawer regression checks

From the workspace root:

```sh
pnpm --filter @workspace/couple-dates run test:ui:types
pnpm --filter @workspace/couple-dates run test:ui
```

For one profile (pnpm forwards these arguments without an extra `--`):

```sh
pnpm --filter @workspace/couple-dates test:ui --project=phone-large-text
```

## Setup

`@playwright/test` is a locked development dependency. Run `pnpm install` on a
fresh checkout. The runner uses Replit's Chromium when available, otherwise a
Playwright-managed Chromium. Outside Replit, install it once:

```sh
pnpm --filter @workspace/couple-dates exec playwright install chromium webkit
```

On a CI image, provision the browser's system dependencies too (or use a supported
Playwright CI image). `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` optionally selects a
preinstalled Chromium. No app secrets, API server, database, Clerk session,
Google account, or billing account is required.

The runner starts and stops a separate loopback-only Vite server on port 5189.
It refuses to reuse an existing server, so it cannot accidentally test a live app.
Do not change the test base URL to the normal app preview or a deployed URL.

## What is covered

The existing layout, lazy-loading and memory cases run at **320×568**,
**390×844**, **1280×900**, and **390×844 with 200% text**:

- Real `AppShell`, home, dates and memories pages render long synthetic partner
  names/date titles without horizontal page overflow; navigation stays reachable.
- The harness uses the same lazy page wrappers as the app. Pages download only
  on navigation; a held download announces loading without hiding navigation.
  A failed download offers reload, leaves home reachable, and recovers after
  reload. Browser back and direct page reload also work.
- The visible **Propose** text stays inside its button and separate from the
  heading. Date tabs and bottom navigation labels stay within their controls.
- Date timezone/length labels and inputs stay separate and within the drawer.
- Date and new/edit memory forms scroll inside bounded drawers on phones, and
  submit controls can be scrolled into view and reached using real Tab navigation.
  Desktop forms that already fit do not have to scroll.
- Keyboard focus has a visible outline/ring. Hit testing checks that controls are
  not hidden under navigation/overlays; `toBeVisible()` alone cannot catch that.
- Photo **Change** and **Remove**, activated by keyboard, preserve an unsaved
  title, note, date, category and favorite flag without saving. An explicit save
  sends the draft, retains its date-album link and uses the new/null photo path.
  Canceling file selection also leaves the draft untouched.
- Create-date and create-memory submissions send their expected payloads; dialogs
  close after successful mocked responses.

The large-text profile doubles named and arbitrary pixel/rem text utilities,
including responsive headings, without doubling spacing or viewport pixels.
It is a deterministic text-resize stress test, not an OS font setting, mobile
browser zoom or OS font setting. See the separate mobile checks below.

## Mobile keyboard and safe-area checks

```sh
pnpm --filter @workspace/couple-dates test:ui:mobile
```

The six Chromium keyboard cases are also included in `test:ui` by default.
`test:ui:mobile` is a separate required cross-engine gate for mobile changes;
there is no automatic skip if WebKit is missing. Chromium's executable override
applies only to Chromium. Use `test:ui:mobile --project=keyboard-webkit` to run just
WebKit, or `test:ui --project=keyboard-chromium` for just Chromium.
On supported Linux CI, use `playwright install --with-deps chromium webkit`;
on macOS, use `playwright install chromium webkit`. Replit's Nix environment
may download WebKit but lack its Linux shared libraries. Run WebKit on a supported
macOS/Linux runner instead; a missing engine is **not** a passing mobile check.
The manually dispatched `mobile-drawers` GitHub workflow provides that runner and
retains reports, traces and failure screenshots.

Six scenarios per engine exercise date creation, new memory and edit memory in
portrait (390×844) and landscape (844×390). Each focuses an input, reduces only
`visualViewport.height`, changes the keyboard height again, scrolls to a focused
note and submit button, dismisses/reopens the keyboard, checks draft retention,
saves exactly once through mocked requests, restores navigation and reopens a
fresh drawer. Assertions use visual bounds plus hit testing, not `innerHeight`
alone. The background bottom nav must be blocked while the modal is open, then
be reachable and navigate after close.

Safe-area stress values (34px portrait, 21px landscape) replace only
`env(safe-area-inset-bottom)` in compiled production CSS declarations. Assertions
check real nav padding and main-content clearance. The helper fails if those
declarations disappear. It does not add padding or reposition drawers to hide
failures.

**Limits:** Playwright WebKit is not shipping iOS Safari. A synthetic visual
viewport does not open an OS keyboard, pan the browser chrome, change `dvh`, or
reproduce automatic input zoom. CSS substitution does not prove hardware `env()`
values. The automated matrix checks bottom insets only; real landscape side
insets and keyboard/browser behavior require the device pass below. Production
drawer/form/nav code is intentionally unchanged.

## Physical-device release check (synthetic only)

Use a trusted local checkout on a computer on the same private LAN as the phone.
Do not publish the fixture or point a device at the authenticated app. Start:

```sh
UI_DEVICE=1 pnpm --filter @workspace/couple-dates exec vite --config tests/ui/vite.config.ts
```

Open `http://<computer-LAN-IP>:5189/dates` on the phone. The explicit device mode
binds to the LAN; normal automated mode stays loopback-only. Stop it with Ctrl-C
when finished. Do not expose this development server to the public internet.
No API server, credentials, database or account is needed. Only known synthetic
reads and date/memory saves are answered by the fixture server; all other API
requests (including upload, Google, billing and entitlement endpoints) return 403.
A restrictive CSP blocks external connections. Saves echo a synthetic response
and close the drawer but do **not** persist; reopening/reloading restores fixtures.
Never enter real personal details or select real photos.

Minimum matrix before a release that changes drawers, forms, Vaul or navigation:

| Device/browser | Checks |
| --- | --- |
| iPhone with home indicator, current shipping Safari | Portrait and landscape, real bottom/side safe areas |
| Small supported iPhone, oldest supported iOS Safari | Short keyboard viewport, browser chrome expanded/collapsed |
| Android phone, current Chrome | Resize-style keyboard behavior and Back-to-dismiss |

Use **real touch/software keyboard**, not a paired hardware keyboard. For every
row, do the following for **Propose a date**, **Add memory**, and **Edit memory**:

1. Before opening, tap Dates/Memories in the fixed nav. Labels and targets must
   clear the home indicator and notch; content must scroll clear of the nav.
2. Open the drawer; focus title and type a synthetic draft. The focused input
   and caret must remain above the keyboard, with no horizontal clipping.
3. Focus the last note field and type multiple lines. Scroll **inside the form**
   to submit without closing the drawer. The full submit target must be visible,
   tappable, above the keyboard/home indicator, and not covered by navigation.
4. Toggle predictive text / another keyboard where available, and rotate while
   the keyboard is open. Repeat title → note → submit reachability in both
   orientations. Scroll the page/chrome to test expanded and collapsed toolbars.
5. Dismiss and reopen the keyboard twice. Draft text must survive; no stuck body
   scroll, jumped drawer, stale height, inaccessible field or hidden submit.
6. Submit with the keyboard still open (date requires a day). Exactly one local
   synthetic save should close the drawer. Tap the nav again, reopen another
   drawer, then cancel it; verify normal navigation and scrolling are restored.

Record device model, OS/browser versions, orientation, keyboard/predictive-text
setting, pass/fail for each drawer and nav, and a screenshot/video of any failure.
With Safari's remote Web Inspector, capture `innerHeight` and
`visualViewport.{height,offsetTop,scale}` before/during/after the keyboard plus
the focused control and submit `getBoundingClientRect()` values. Do not log
field contents. If no physical device was run, mark this matrix **not run**;
automated green results are not a substitute for hardware sign-off.

## Isolation and maintenance

The test entry imports real production components and styles, but **not** the app
bootstrap, Clerk, or any provider SDK. It supplies only a synthetic couple context.
The generated React Query hooks and form upload code still execute normally.

Every browser HTTP request is intercepted before navigation. Known reads/writes
receive local synthetic responses, including a tiny PNG and fake upload target.
Unexpected API/provider requests are aborted and fail the test; external font
requests are deliberately blocked. There is no API proxy in the fixture server.
No fixtures are inserted into a database, no real photo bytes are uploaded, and no
Google writes, checkout sessions, or paid entitlements are changed.

Fonts use offline fallback families to avoid network-dependent metrics. The logo
is synthetic. These are geometry/behavior tests, not pixel-snapshot comparisons.
Real account authentication and partner approval were verified separately; this
suite intentionally does not repeat those provider-backed flows.

Use existing `data-testid` selectors and accessible roles/labels. Add fixture API
responses explicitly when production components require a new endpoint; do not
replace fail-closed routing with a general successful fallback or network access.
Keep test-only fixtures outside `src` and out of the shipped app bootstrap.

The separate Vite root explicitly includes the production source in Tailwind's
scan. Keep that scan when moving the harness; missing utilities produce false
drawer/overflow failures.

Reports, failure screenshots and traces go to
`generated-artifacts/couple-dates-ui/` at the workspace root (ignored by Git and
deployment). Inspect a failure with:

```sh
pnpm --filter @workspace/couple-dates exec playwright show-report ../../generated-artifacts/couple-dates-ui/report
```
