import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/firebase/**', '**/security/**'],
  fullyParallel: true,
  workers: 2,
  reporter: 'list',
  use: {
    browserName: 'chromium',
    baseURL: 'http://dabubble.test',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  // Deliberately no webServer: fixtures read dist files directly, without a listening port.
});
