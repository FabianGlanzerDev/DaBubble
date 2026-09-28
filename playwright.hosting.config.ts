/**
 * Runs hash-route and reset-link checks against a real local static server without SPA fallback.
 *
 * @packageDocumentation
 */

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/hosting',
  workers: 1,
  timeout: 120000,
  expect: { timeout: 8000 },
  outputDir: 'tmp/hash-routing-audit/browser-results',
  reporter: 'list',
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:4302',
    permissions: ['local-network-access'],
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/serve-static.mjs 4302',
    url: 'http://127.0.0.1:4302/',
    reuseExistingServer: false,
  },
});
