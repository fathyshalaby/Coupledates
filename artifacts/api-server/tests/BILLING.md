# Payment-free billing contracts

Run from the workspace root:

```sh
pnpm --filter @workspace/api-server run test:billing-contract
```

Requires Node 24, pnpm, and PostgreSQL's `initdb`, `pg_ctl`, and `createdb`
executables on `PATH` (already available in this workspace). Run as a non-root
user, as required by PostgreSQL.

The runner creates a fresh PostgreSQL cluster under the system temporary
directory, exposes it only through a private Unix socket, generates DDL from the
current Drizzle schema, and deletes the cluster on completion or test failure.
It does not use the development or production database. No database provisioning,
schema push, app login, real Whop account, or payment is needed.

The test child receives a scrubbed environment containing only disposable
database and fake billing settings. Every `fetch` is intercepted, including the
connector lookup used by production's `getWhopClient()`. Unexpected destinations
and operations fail rather than falling through to a network request. Fixture
assertion failures are checked after each test, even if application error
handling catches the original exception. The Express webhook handler is tested
over an ephemeral loopback HTTP server, not against the running app.

The production billing service, real Whop SDK, raw-body signature verification,
database transactions/locks/constraints, and access policy are not mocked.
Node's test clock controls all application dates. Wire fixtures cover the fields
consumed by billing on API date `2026-10-15-1`, including membership `account.id`,
flat product/plan/user IDs, ISO period dates, the list `data` envelope, payment
`membership_id`, plan `product.id`, checkout `purchase_url`, and
`webhook_secret`. Requests assert the API date, checkout binding/idempotency,
approved US$5/30-day pricing, and private `stock: 1`/`unlimited_stock: false`
safeguards.

The scenarios cover shared activation, concurrent checkout ownership, owner-only
management/cancellation/resumption, exact paid-period expiry, memory retention,
failed renewal and recovery, delayed events and re-reading under lock,
resubscription/retired membership events, signature/replay rejection, provider
outage retries, and price drift.

These fixtures are regression contracts, not live-provider certification: they
cannot detect an unannounced change to Whop's actual service or prove how Whop
enforces stock. On a deliberate API-date/SDK upgrade, compare fixtures with the
dated provider contract before updating expected values. Never obtain this
coverage by charging an account or inserting fake entitlements into the app.

`pnpm --filter @workspace/api-server run test` remains the fast policy/unit suite.
The existing `test:webhook` command is a separate opt-in development smoke check;
it is not required by this isolated suite.
