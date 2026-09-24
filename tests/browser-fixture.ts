import { test as base, expect, type BrowserContext } from '@playwright/test';
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

export const test = base.extend<{
  browserHealth: void;
  emulatedFirebase: boolean;
  expectedOffline: boolean;
}>({
  emulatedFirebase: [false, { option: true }],
  expectedOffline: [false, { option: true }],
  browserHealth: [
    async ({ page, emulatedFirebase, expectedOffline, baseURL }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (
          expectedOffline &&
          message.location().url.startsWith('http://127.0.0.1:8080/') &&
          message.text() === 'Failed to load resource: net::ERR_INTERNET_DISCONNECTED'
        )
          return;
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
        const canceledListener =
          /^http:\/\/127\.0\.0\.1:8080\/google\.firestore\.v1\.Firestore\/(Listen|Write)\/channel\?/.test(
            request.url(),
          );
        if (emulatedFirebase && canceledListener && failure === 'net::ERR_ABORTED') return;
        if (expectedOffline && canceledListener && failure === 'net::ERR_INTERNET_DISCONNECTED')
          return;
        errors.push(`Failed request (${failure}): ${request.url()}`);
      });
      await installAppRoutes(page.context(), emulatedFirebase, baseURL, errors, expectedOffline);
      await use();
      expect(errors, 'No browser errors, missing assets, or external requests').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export async function installAppRoutes(
  context: BrowserContext,
  emulatedFirebase: boolean,
  baseURL: string | undefined,
  errors: string[],
  expectedOffline = false,
): Promise<void> {
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    // The SDK probes connectivity after a deliberate outage; fulfil locally, never send it.
    if (
      expectedOffline &&
      url.origin === 'https://www.google.com' &&
      url.pathname === '/images/cleardot.gif'
    ) {
      await route.fulfill({ status: 204 });
      return;
    }
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
}
