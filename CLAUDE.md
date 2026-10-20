# CLAUDE.md

Couple Dates is a mobile-first web app where two partners keep a private space: photo memories, date proposals and reviews, daily check-in streaks, a yearly recap, and an AI date assistant. A paid "Plus" plan (Whop, US$5/month per couple space) unlocks the assistant and the recap.

It was built on Replit and is being moved to Vercel. Both targets are supported; Replit-only behaviour is a fallback that applies when the matching env var is unset. `replit.md` and `.agents/memory/*.md` hold product decisions and their reasons. Read them before changing billing, reminders, analytics or layout.

## Commands

Use pnpm (the root `preinstall` rejects npm/yarn). Node 24 is the target; Node 22 works locally with an engines warning.

| Task | Command |
|---|---|
| Install | `pnpm install --frozen-lockfile` |
| Typecheck everything (libs, API, web, tests) | `pnpm run typecheck` |
| API unit tests | `pnpm --filter @workspace/api-server run test` |
| Web build | `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/couple-dates run build` |
| API build (long-running server) | `pnpm --filter @workspace/api-server run build` |
| API build (Vercel function) | `pnpm --filter @workspace/api-server run build:vercel` |
| UI layout regression (Playwright, no backend needed) | `pnpm --filter @workspace/couple-dates run test:ui` |
| Regenerate API client and Zod schemas after editing `lib/api-spec/openapi.yaml` | `pnpm --filter @workspace/api-spec run codegen` |
| Create/update DB tables (dev only, no migration files) | `pnpm --filter @workspace/db run push` |

Notes that save time:

- **The web build fails without `PORT` and `BASE_PATH`.** `vite.config.ts` throws if either is missing. `vercel.json` supplies them; set them yourself elsewhere.
- **UI tests need a browser.** Playwright asks for its own pinned Chromium. Where that isn't installed, point it at any Chromium: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium`.
- **Billing/recovery suites** (`test:billing-contract`, `test:account-recovery`) start a throwaway Postgres with `initdb`/`pg_ctl`. They need the Postgres binaries on `PATH` and refuse to run as root. They never touch the app database or real providers.
- **`pnpm run build` at the root runs typecheck first**, so a type error anywhere fails the whole build.
- There is no local dev proxy: the Vite dev server does not forward `/api`. On Replit a path router does that; locally run both servers and put a proxy in front, or test against a deployment.

## Layout

```
artifacts/couple-dates   React 19 + Vite 7 + Tailwind 4 SPA (wouter routing, TanStack Query, shadcn/Radix UI in src/components/ui)
artifacts/api-server     Express 5 API, bundled with esbuild to one ESM file
artifacts/mockup-sandbox Replit design canvas; not part of the product
lib/db                   Drizzle ORM + pg; tables in src/schema/*.ts
lib/api-spec             openapi.yaml is the API contract; Orval generates the two libs below
lib/api-client-react     generated React Query hooks (src/generated). Do not hand-edit
lib/api-zod              generated Zod request/response schemas. Do not hand-edit
lib/integrations-openai-ai-server  OpenAI client (created lazily on first use)
api/index.mjs            Vercel serverless entry; re-exports the bundled Express app
vercel.json              Vercel build, routing and function config
```

API changes flow spec first: edit `openapi.yaml`, run codegen, then use the generated hooks in the web app and the Zod schemas in the routes.

## How the pieces fit

- **Auth:** Clerk. Every `/api` route derives identity from the verified session (`requireUser`, then `requireCouple` in `src/lib/couple.ts`). A couple space has at most two members; invite codes are bearer secrets.
- **Request path:** `src/app.ts` builds the Express app (pino logging, Clerk proxy, JSON parsing, routes in `src/routes/*`). `src/index.ts` listens on `PORT` (Replit/long-running). `src/vercel.ts` exports the same app for Vercel and does not run startup tasks.
- **Photos:** bytes live in a private Google Cloud Storage bucket, never in Postgres. The browser PUTs to a short-lived signed URL, and reads stream back through `GET /api/storage/objects/...` after a membership check. Off Replit set `GCS_CREDENTIALS_JSON` and `PRIVATE_OBJECT_DIR`. Without `GCS_CREDENTIALS_JSON` the Replit storage sidecar is used.
- **Billing:** Whop hosted checkout with a server-side checkout reservation. Whop is the source of truth; access snapshots are short-lived and webhooks are signed and idempotent. The webhook is registered per `BILLING_APP_ORIGIN`: on Replit at server start (best effort), on Vercel the first time checkout runs.
- **Calendar:** Google Calendar through the signed-in partner's own Clerk Google connection, with explicit consent. Tokens stay with Clerk.
- **AI:** `POST /api/openai/date-assistant`, user-triggered only, model `gpt-5-mini`, via `AI_INTEGRATIONS_OPENAI_*`.
- **Env vars:** `.env.example` is the full list with what each one is for and which are required.

## Rules that are easy to break

- Never treat a checkout return URL, client email or membership id as proof of purchase. Only server-verified Whop state grants Plus. Do not seed fake Plus entitlements to make a test pass.
- Do not rotate `SESSION_SECRET`: it encrypts stored webhook secrets and signs account-recovery codes.
- Keep the Whop API version date identical in `whopClient.ts` and `billing.ts`.
- AI planning is explicitly user-triggered. Never call it on page load. The request cap is an operating-cost safeguard, not a paid entitlement.
- Analytics must never include relationship content, payment data, identifiers or checkout URLs.
- Dates use their saved IANA timezone (legacy dates fall back to the couple's), never the viewer's device zone.
- Keep navigation outside lazy-route loading and error boundaries. A failed page download needs a real reload, not just a boundary reset.
- Location is an optional foreground check only. Do not promise background arrival detection or push reminders.
- `BILLING_APP_ORIGIN` must equal the origin the app is served from. It is also the origin check for account-recovery POSTs, so a test deployment needs its own value.
- Clerk's `publishableKeyFromHost` returns a development key (`pk_test_`) unchanged but derives `clerk.<host>` for live keys. `*.vercel.app` therefore needs a Clerk development instance; production needs a custom domain.

## Deploying to Vercel

`vercel.json` builds both packages and serves the SPA from `artifacts/couple-dates/dist/public`. `/api/*` is rewritten to the single function in `api/index.mjs`, and every other path falls back to `index.html`. The build pins pnpm through the `packageManager` field with `ENABLE_EXPERIMENTAL_COREPACK=1`. After setting the env vars from `.env.example`, create the tables once with `pnpm --filter @workspace/db run push` against the target database. On Vercel use a pooled `DATABASE_URL`. `VITE_*` values are read at build time, so changing them needs a redeploy.

## Known issues

- `test:account-recovery`: 7 of 13 tests fail on `main`. The fixture fakes `req.auth`, which the installed `@clerk/express` no longer accepts (`getAuth` requires `clerkMiddleware` to have run). The app itself is not affected. Fix the fixture before relying on this suite.
- The schema is managed only with `drizzle-kit push`: there are no migration files, so production schema changes are unreviewed and unversioned.
- `cors({ credentials: true, origin: true })` in `app.ts` reflects any origin. Same-origin deployments don't need CORS at all.
- Upload size and type limits are enforced when a photo is read (`ownedPhoto`), not when the signed upload URL is issued.
- `whop-api.mjs` and `whop-mcp.mjs` are Replit-only helper scripts (they use the Replit connector proxy).
