import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/firebase',
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 8000 },
  outputDir: 'tmp/auth-audit/browser-results',
  reporter: 'list',
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:4301',
    permissions: ['local-network-access'],
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
});
