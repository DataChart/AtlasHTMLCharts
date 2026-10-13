import { defineConfig } from '@playwright/test';

// Pages are opened straight from disk (file://) — exactly how end users open them.
export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    viewport: { width: 1400, height: 900 },
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
});
