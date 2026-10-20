import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

// Explicit cross-engine gate, separate from the existing Chromium-only gate.
// Missing WebKit fails this command; it must never silently downgrade to Chromium.
export default defineConfig({
  ...base,
  projects: [
    base.projects!.find((project) => project.name === 'keyboard-chromium')!,
    {
      name: 'keyboard-webkit',
      testMatch: 'keyboard.spec.ts',
      use: {
        ...devices['iPhone 13'],
        browserName: 'webkit',
        // Do not inherit Chromium's Replit executable override.
        launchOptions: {},
      },
    },
  ],
});
