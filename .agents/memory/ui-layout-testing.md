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
