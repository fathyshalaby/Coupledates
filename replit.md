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

Shared photo memory timeline; date planning, completion and 1–5 ratings; daily quality-time streaks; yearly relationship recap; couple profile and code-based partner pairing.

## User preferences

The user chose a mobile-first web app rather than a native mobile app. Product scope comes from their description of the couples memory/date/streak/yearly recap concept.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
