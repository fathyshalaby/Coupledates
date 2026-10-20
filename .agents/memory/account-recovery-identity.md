---
name: Cross-environment account recovery
description: Safe recovery when preview and published Clerk instances give one person's login different app user IDs
---

Never automatically connect preview and production couple spaces by matching emails, names, or Clerk IDs. Require proof from the original space owner and a matching, verified Google provider identity in the target app. Keep both spaces and records; recovery should only change which proven space the returning person sees.

**Why:** Couple Dates can have copied preview membership records in production, while preview and production Clerk instances use distinct user identities. Guessing a match risks disclosing one couple's private records to another account.

**How to apply:** During recovery, validate a short-lived, signed proof generated while authenticated as the original member, confirm the Google identity through the target app's server-side Clerk account record, and require explicit confirmation before linking.
