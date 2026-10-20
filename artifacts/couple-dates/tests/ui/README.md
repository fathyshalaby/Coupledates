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
pnpm --filter @workspace/couple-dates exec playwright install chromium
```

On a CI image, provision the browser's system dependencies too (or use a supported
Playwright CI image). `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` optionally selects a
preinstalled Chromium. No app secrets, API server, database, Clerk session,
Google account, or billing account is required.

The runner starts and stops a separate loopback-only Vite server on port 5189.
It refuses to reuse an existing server, so it cannot accidentally test a live app.
Do not change the test base URL to the normal app preview or a deployed URL.

## What is covered

Each case runs at **320×568**, **390×844**, **1280×900**, and **390×844 with
200% text** (24 cases total):

- Real `AppShell`, home, dates and memories pages render long synthetic partner
  names/date titles without horizontal page overflow; navigation stays reachable.
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
browser zoom, virtual-keyboard, safe-area hardware, or cross-browser test.

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
