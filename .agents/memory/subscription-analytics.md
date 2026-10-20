---
name: Subscription analytics boundaries
description: Privacy and interpretation constraints for measuring Couple Dates upgrades.
---

Subscription funnel analytics must never include private relationship or payment
data, account or checkout identifiers, hosted checkout URLs, or free-form content.
Use fixed entry-location and plan labels. Checkout returns are separate from
server-verified Plus activation, and analytics must never determine paid access.

**Why:** The user explicitly required privacy-safe funnel measurement and rejected
return parameters as activation evidence. A couple's shared entitlement also means
browser-observed activation is not a unique payment or revenue ledger.

**How to apply:** Preserve these boundaries when adding analytics dimensions,
interpreting conversion counts, or instrumenting new paid-feature entry points.
