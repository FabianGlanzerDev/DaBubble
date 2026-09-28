/**
 * Runs public UI tests against the built app through isolated fixtures rather than a development server.
 *
 * @packageDocumentation
 */

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/firebase/**', '**/security/**', '**/deletion/**', '**/hosting/**'],
  fullyParallel: true,
  workers: 2,
  expect: { timeout: 8000 },
  reporter: 'list',
  use: {
    browserName: 'chromium',
    baseURL: 'http://dabubble.test',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  // Deliberately no webServer: fixtures read dist files directly, without a listening port.
});
