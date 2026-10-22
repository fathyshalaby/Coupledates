---
name: Static marketing routes
description: How nested static marketing HTML behaves under the Couple Dates Vite SPA fallback.
---

For this artifact's Vite development server, a request to a nested directory URL such as `/date-ideas/` falls through to the React SPA shell, even when `public/date-ideas/index.html` exists. Requesting the explicit `/date-ideas/index.html` serves the standalone HTML with its own metadata and content.

For client-rendered public routes that need crawler-visible metadata, emit a route-specific static HTML shell during the production build and source its title, description, and image from the same metadata data used by the client route. Verify the built file through a direct HTTP request; DOM assertions after JavaScript runs do not prove crawlers see those values.

**Why:** A client-rendered fallback can make an intended search landing page look like an ordinary SPA route in the raw HTTP response.

**How to apply:** For future public content pages that need crawler-readable source, inspect the raw response at the exact URL. Use standalone HTML for static content, or a generated route shell with shared metadata for a client-rendered page. Keep links on an explicit static file path unless a server-side rewrite or prerendered route has been verified.
