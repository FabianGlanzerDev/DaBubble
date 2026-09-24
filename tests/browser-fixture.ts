import { test as base, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { emulatorConfig } from './firebase/emulator-config';

const root = resolve('dist/da-bubble/browser');
const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

export const test = base.extend<{ browserHealth: void; emulatedFirebase: boolean }>({
  emulatedFirebase: [false, { option: true }],
  browserHealth: [
    async ({ page, emulatedFirebase, baseURL }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (
          emulatedFirebase &&
          message.location().url.startsWith('http://127.0.0.1:9099/') &&
          /Failed to load resource.*status of 400/.test(message.text())
        )
          return;
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('requestfailed', (request) => {
        const failure = request.failure()?.errorText;
        const canceledListener = request
          .url()
          .startsWith('http://127.0.0.1:8080/google.firestore.v1.Firestore/Listen/channel?');
        if (emulatedFirebase && canceledListener && failure === 'net::ERR_ABORTED') return;
        errors.push(`Failed request (${failure}): ${request.url()}`);
      });
      await page.context().route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (
          emulatedFirebase &&
          ['http://127.0.0.1:9099', 'http://127.0.0.1:8080'].includes(url.origin)
        ) {
          await route.continue();
          return;
        }
        if (url.origin !== new URL(baseURL ?? 'http://dabubble.test').origin) {
          errors.push(`Unexpected external request: ${url.origin}`);
          await route.abort();
          return;
        }
        if (url.pathname === '/firebase-config.json') {
          await route.fulfill({
            json: emulatedFirebase ? emulatorConfig : { firebase: null, emulators: false },
          });
          return;
        }
        const filePath =
          route.request().resourceType() === 'document'
            ? resolve(root, 'index.html')
            : resolve(root, `.${decodeURIComponent(url.pathname)}`);
        if (!filePath.startsWith(`${root}${sep}`))
          throw new Error('Asset path outside build directory');
        try {
          await route.fulfill({
            body: await readFile(filePath),
            contentType: mimeTypes[extname(filePath)] ?? 'application/octet-stream',
          });
        } catch {
          errors.push(`Missing asset: ${url.pathname}`);
          await route.fulfill({ status: 404, body: 'Asset not found' });
        }
      });
      await use();
      expect(errors, 'No browser errors, missing assets, or external requests').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
