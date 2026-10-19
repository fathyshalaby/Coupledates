# Couple Dates

A mobile-first private space for couples to save photos and memories, plan and rate dates, check in together, and revisit a yearly relationship recap.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/couple-dates` — React mobile-first web app at `/`
- `artifacts/api-server/src/routes` — protected Express API
- `lib/api-spec/openapi.yaml` — API contract, regenerate clients after changes
- `lib/db/src/schema/couples.ts` — couple spaces, membership, memories, dates, check-ins, upload metadata

## Architecture decisions

- Clerk owns authentication; every couple API derives identity from the verified session.
- A couple space has at most two members. Invite codes are private bearer invitations: only share with your partner.
- Streaks measure explicit daily check-ins in the couple's configured timezone, not page visits.
- Personal photo bytes live in private App Storage, never in PostgreSQL. Reads require membership in the owning space.
- Recaps are computed on demand from saved records; sample preview content is not personal history.

## Product

Shared photo memory timeline; partner date proposals, acceptance/counter/decline, start/completion and individual 1–5 reviews; date-linked albums and camera capture; daily quality-time streaks; yearly relationship recap; couple profile and code-based partner pairing. Each partner can complete a shared interests/budget/availability questionnaire. A shared AI date concierge recommends in-person or remote experiences using the available profiles and recent dates. AI suggests only; people choose dates and approve plans.

Location is an optional, explicitly requested foreground check against a voluntarily pinned meeting point. Do not promise background arrival detection or push reminders. Current device locations from arrival checks are never sent to the backend.

## User preferences

The user chose a mobile-first web app rather than a native mobile app. Product scope comes from their description of the couples memory/date/streak/yearly recap concept. They want a coherent interests → recommendations → proposal → partner approval → date → photos flow, including long-distance relationships.

The user confirmed the launch upgrade at US$5/month per shared couple space, covering both partners, and selected Whop. The paid features are the AI date assistant and yearly recap; existing memories must remain accessible after cancellation. Whop bills in 30-day periods, disclosed alongside applicable taxes. Cancellation stops renewal, with Plus continuing through the verified paid-through date.

Billing uses hosted checkout and a server-owned checkout reservation to bind a verified Whop membership to the couple space. A return URL, client-provided email, or membership identifier is never purchase proof. Both partners share entitlements; only the initiating billing owner manages renewal. Whop is the source of truth, with short-lived access snapshots and signed, idempotent webhook updates. Signing secrets are encrypted using the stable SESSION_SECRET, which must not be rotated without reprovisioning webhook verification. BILLING_APP_ORIGIN is an explicitly configured HTTPS origin for each environment.

The user wants partners to connect their own calendars and supports online dates as well as physical dates. They chose Google Calendar first.

Calendar access is per signed-in partner through Clerk's Google external account with explicit incremental consent, never a shared workspace-owner connector. OAuth tokens remain with Clerk. Free/busy sharing is a separate opt-in, off by default; shared slots require both partners' consent and complete primary-calendar responses. Never send private calendar events to the partner or AI.

Google saves and .ics downloads are explicit, one-time calendar copies, not background/two-way sync. Only agreed dates may be saved; each partner manages their own Google copy. Editing or deleting an app plan does not automatically update/remove calendar copies; keep that warning visible. Google provider approval/API availability must succeed before reporting a connection as verified. Date times use the date's saved IANA timezone, with legacy dates falling back to the couple timezone; do not reinterpret an existing date using the viewer's device timezone.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
