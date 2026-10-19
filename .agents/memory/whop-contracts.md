---
name: Whop API contract compatibility
description: Why billing must pin and verify Whop API shapes instead of relying on older setup examples
---

Pin the Whop runtime client and webhook payloads to the same dated API version. Treat installed SDK types and real provider responses as authoritative over older setup examples.

**Why:** Whop's Fern SDK replaced the earlier default-export client, while some generated webhook request fields still reflected the older wire format. The newer API needed account-scoped webhook creation and rejected the legacy API-version selector. Mixing proxy examples and the new runtime API produced valid-looking code but failed provisioning.

**How to apply:** Keep the dated version consistent when changing billing code. Check a real provider request before declaring setup complete, without printing keys or signing secrets. Run signature/raw-body checks after serializer or webhook changes.

Private, stock-limited offers are intentional for couple-space checkout.

**Why:** A shared reusable checkout link can otherwise let both partners purchase separate subscriptions. Application locking alone cannot prevent simultaneous payments on the provider's hosted page.

**How to apply:** Keep the pending checkout reservation scoped to the couple and its initiating partner. Do not replace the private one-purchase offer with an unlimited shared plan link without another provider-enforced duplicate-purchase safeguard.
