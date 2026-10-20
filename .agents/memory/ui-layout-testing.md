---
name: Isolated layout regression tests
description: Avoiding false layout failures when testing real components under a separate Vite root.
---

When a layout fixture uses a different Vite root, verify that Tailwind still scans
the real component sources before interpreting browser geometry failures.

**Why:** Missing generated utilities in an isolated harness initially looked like
broken drawer height/scrolling despite the production UI having those utilities.

**How to apply:** Keep the fixture's compiled styling equivalent to the shipped
components. For enlarged-text checks, enlarge text without enlarging rem-based
spacing; changing the root font size alone confounds those two effects.

Keep cross-engine mobile verification separate from the always-runnable local
Chromium check; do not silently skip WebKit or call simulations hardware coverage.

**Why:** The Replit Nix environment supplies Chromium but downloaded Playwright
WebKit lacks its Linux shared libraries. Making that engine an unconditional
local prerequisite blocks unrelated regressions without providing iOS evidence.

**How to apply:** Require the explicit cross-engine gate on a supported runner
for mobile changes, and report physical Safari keyboard/safe-area checks separately.
Changing `visualViewport` or substituting CSS insets is deterministic stress
coverage, not proof of actual iPhone keyboard, chrome panning or notch behavior.
