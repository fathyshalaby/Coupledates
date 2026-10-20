# Subscription funnel analytics

Uses only Replit's optional, publishing-injected tracker. No script, website ID,
or analytics environment settings are added by the app. Tracker errors and denied
session storage never change checkout, renewal, or feature access.

| Description | Event name |
| --- | --- |
| Click See Plus on the assistant/recap paywall, upgrade, or continue checkout | `upgrade_clicked` |
| API successfully creates or reopens hosted checkout, before redirect | `checkout_created` |
| Browser arrives on the checkout return route; **not payment success** | `checkout_returned` |
| Server-verified entitlement becomes active after checkout or a previously observed free status | `plus_activated` |
| Cancellation response confirms renewal is off and paid access remains verified | `renewal_cancelled` |
| Resumption response confirms renewal is on and paid access remains verified | `renewal_resumed` |

Only fixed `plan: plus`, entry `location` labels and a boolean `resumed` on checkout
creation are sent. No user/couple/membership/checkout identifiers, hosted URLs,
names, emails, prompts, photos or calendar information are event properties.
Automatic pageviews are managed by the publishing tracker, not this code.

Activation is observed through the shared billing query used by billing, settings,
assistant and recap. A return query parameter never establishes entitlement or
arms an activation event. Existing subscribers are not counted as new activations
on first observation. A tab-scoped pending boolean survives hosted checkout; query
cache removal at the auth boundary resets it. Polling and rerenders do not repeat
activation events. It is browser-observed activation, not an authoritative purchase
ledger: closed tabs, blockers, separate devices and missed status transitions can
cause undercounts. No analytics call is awaited before navigation.

## Enable and inspect

Go to Publishing settings, enable analytics, and publish or republish the app.
Events appear only on a supported published website with analytics enabled; local
development normally has no tracker. These changes must be merged before they
can be included in the next publish.

Useful questions after data arrives:
- Which entry locations lead to the most checkout creations?
- How often do checkout returns lead to verified Plus activation?
- How many confirmed renewal cancellations and resumptions occur?

## Focused regression checks

From the workspace root:

```sh
pnpm --filter @workspace/api-server exec esbuild ../couple-dates/src/lib/billing-analytics.test.ts --bundle --platform=node --format=esm --outfile=/tmp/couple-billing-analytics.test.mjs
node /tmp/couple-billing-analytics.test.mjs
pnpm --filter @workspace/couple-dates run typecheck
```
