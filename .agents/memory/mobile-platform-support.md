---
name: Mobile platform support
description: Product requirement for platform compatibility across Tuesday's mobile web experience.
---

Android and iOS users are both target users for Tuesday. Lead date-to-calendar actions with a device-compatible one-time .ics export; keep Google Calendar optional for mutual free/busy checks and separately managed event copies. Do not describe .ics imports as live sync.

Keep phone navigation and safe-area handling through landscape widths: an 844px CSS viewport can still be a rotated phone. Reserve the desktop top navigation for widths of at least 1024px. At 320px, keep every marketing nav label visible and prioritize the start-space action over sign-in.

**Why:** The user explicitly asked that both Android and iOS be kept in mind and chose device-calendar-first with Google optional. The app is a mobile web app, so .ics is the cross-platform add path; browser access is not native calendar sync. Responsive checks caught 844px landscape phones losing bottom safe-area padding and a 320px public header clipping its final navigation link.

**How to apply:** Treat both platforms as first-class targets when designing responsive flows, device sharing, browser fallbacks, and mobile testing; do not assume one mobile operating system. Test down to 320px as well as portrait and landscape; keep device imports and Google copies clearly separate, including their update and removal behavior.
