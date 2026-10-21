---
name: Share-card regression tests
description: Testing canvas-generated share images and their preview/download consistency.
---

For canvas-generated share cards, DOM assertions alone cannot detect text that is truncated inside the image. Capture the canvas drawing calls to assert all visible title lines and their positions, and verify that downloads use the same generated image as the preview.

**Why:** The share-card content is rasterized before it reaches the preview; the DOM contains only an image, so content and spacing regressions are otherwise invisible to UI tests.

**How to apply:** When changing generated card layouts, test canvas text and coordinates, check relevant metadata spacing, and confirm the preview and download remain aligned.
