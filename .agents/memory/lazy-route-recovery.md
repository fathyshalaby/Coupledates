---
name: Lazy route recovery
description: Recovery and verification constraints for on-demand page downloads.
---

Keep the shared navigation outside page loading/error boundaries. Offer a real
page reload when a route download fails, rather than presenting a boundary
reset as a download retry.

**Why:** React lazy caches a rejected import promise. Resetting an error boundary
alone rethrows the same rejection; it does not fetch the chunk again. Keeping
navigation available lets users leave a failed page without reloading.

**How to apply:** When changing lazy routing, verify delayed and failed imports
as well as successful navigation. Measure initial transfer including the chosen
page's transitive static dependencies, not only the entry chunk.
