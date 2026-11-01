---
name: couple-space-membership
description: Keep partner pairing as one shared space with a simple invite join path.
---

Couple Dates membership is intentionally simple: one shared space, at most two partners. One person creates the space and shares an invite; the other joins that same space. Dates, assistant history, preferences, and memories are all scoped by that one couple id.

**Why:** Partners who accidentally create a second solo space get stuck at "1 of 2" and never see proposals or recommendations from the real shared space. Hard-blocking join for any existing membership made that trap permanent.

**How to apply:** Prefer invite deep links (`/join?code=...`) over asking people to create another space. Keep join idempotent. Allow abandoning an empty solo space (no second member, no subscription) so the person can move into their partner's invite. Do not invent multi-space switching for ordinary pairing; account recovery remains the only ownership-proven exception for preview/production identity.

For already-broken data, use the cleanup helper instead of guessing merges:
`pnpm --filter @workspace/api-server run cleanup:couple-spaces` (dry-run),
`--apply-orphans` for memberless couples, `--apply-empty-solos` to return empty mistaken solos to onboarding, and explicit `--move-user <id> --invite <code>` for a known repair. Never auto-merge by email or names; cross-named solos are only suggested as commands.
