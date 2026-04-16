import { defineConfig, devices } from '@playwright/test';

/**
 * Browser E2E. Requires:
 * 1) `npm run test:e2e:install` once (downloads Chromium for your OS).
 * 2) API + Next running: `npm run dev` from repo root (or set PLAYWRIGHT_BASE_URL).
 *
 * Set PLAYWRIGHT_USE_SYSTEM_CHROME=1 to use installed Google Chrome instead of bundled Chromium.
 */
export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  use: {
    ...devices['Desktop Chrome'],
    ...(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === '1' ? { channel: 'chrome' } : {}),
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    navigationTimeout: 30_000,
  },
});
