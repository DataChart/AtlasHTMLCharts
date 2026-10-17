import { defineConfig, devices } from '@playwright/test';

// Pages are opened straight from disk (file://) — exactly how end users open them.
// Chromium, Firefox and WebKit (Safari's engine) all run in CI, so a page that works here works for every viewer.
// Locally, run one engine with `npx playwright test --project=chromium`; PW_CHROMIUM_PATH points at an existing Chromium.
const chromiumLaunch = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
const viewport = { width: 1400, height: 900 };

export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport, launchOptions: chromiumLaunch } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport } }
  ]
});
