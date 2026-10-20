import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const cwd = fileURLToPath(new URL('../..', import.meta.url));
const replitChromium = '/repl/tools/bin/chromium';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  workers: 2,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  outputDir: '../../../../generated-artifacts/couple-dates-ui/results',
  reporter: [['list'], ['html', {
    outputFolder: '../../../../generated-artifacts/couple-dates-ui/report',
    open: 'never',
  }]],
  use: {
    baseURL: 'http://127.0.0.1:5189',
    browserName: 'chromium',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'small-phone', use: { viewport: { width: 320, height: 568 } } },
    { name: 'phone', use: { viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
    // Text-only enlargement: deviceScaleFactor changes pixels, not CSS layout.
    // The fixture doubles text utilities without changing rem-based spacing.
    { name: 'phone-large-text', use: { viewport: { width: 390, height: 844 } } },
    {
      name: 'keyboard-chromium',
      testMatch: 'keyboard.spec.ts',
      use: { ...devices['Pixel 7'], browserName: 'chromium' as const },
    },
  ].map((project) => ({
    ...project,
    testIgnore: project.name.startsWith('keyboard-') ? undefined : 'keyboard.spec.ts',
    use: {
      ...project.use,
      launchOptions: {
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
          || (existsSync(replitChromium) ? replitChromium : undefined),
      },
    },
  })),
  webServer: {
    command: 'pnpm exec vite --config tests/ui/vite.config.ts',
    cwd,
    url: 'http://127.0.0.1:5189',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
