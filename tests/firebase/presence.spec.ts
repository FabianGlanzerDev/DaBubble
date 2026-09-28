import { randomUUID } from 'node:crypto';
import type { BrowserContext, Page } from '@playwright/test';
import { test, expect, installAppRoutes } from '../browser-fixture';
import { registerChatUser, secondUser, noOverflow } from './chat-helpers';
import { startGuest, endGuest, identity, leaveAccount } from './access-helpers';

test.use({ emulatedFirebase: true });

async function presence(page: Page, value: string): Promise<void> {
  const header = page.locator('app-live-conversation .title-button');
  await expect(header).toHaveAttribute('aria-description', value, { timeout: 90000 });
  const state = value === 'Online' ? 'online' : value === 'Offline' ? 'offline' : 'unknown';
  await expect(header.locator('.presence')).toHaveAttribute('data-presence', state);
}

async function direct(page: Page, name: string): Promise<void> {
  await page.goto('/#/chat/neue-nachricht');
  await page.getByLabel('Empfänger', { exact: true }).fill('@' + name);
  await page.locator('.results').getByRole('button', { name, exact: true }).click();
  await expect(page).toHaveURL(/\/chat\/direkt\//);
}

for (const [width, guest] of [
  [1440, false],
  [320, true],
] as const) {
  test(`presence ${width}px ${guest ? 'guest' : 'regular'}: tabs, device, logout, close and reload`, async ({
    page,
    browser,
    baseURL,
  }, info) => {
    test.setTimeout(240000);
    await page.setViewportSize({ width, height: 932 });
    const observer = await secondUser(browser, baseURL!, width);
    let device: BrowserContext | undefined;
    const deviceErrors: string[] = [];
    try {
      if (guest) await startGuest(page);
      else await registerChatUser(page, 'Presence ' + randomUUID().slice(0, 8));
      const uid = (await identity(page)).uid;
      const name = await page.locator('app-live-header .profile > span').innerText();
      await registerChatUser(observer.page, 'Observer ' + randomUUID().slice(0, 8));
      await direct(observer.page, name);
      await presence(observer.page, 'Online');
      await noOverflow(observer.page, info, 'presence-online');
      const secondTab = await page.context().newPage();
      await secondTab.goto('/#/chat');
      await expect(secondTab.locator('app-live-header .presence')).toHaveAttribute(
        'data-presence',
        'online',
      );
      await secondTab.close();
      await presence(observer.page, 'Online');
      await page.reload();
      await expect(page.locator('app-live-header .presence')).toHaveAttribute(
        'data-presence',
        'online',
      );
      expect((await identity(page)).uid).toBe(uid);
      await presence(observer.page, 'Online');
      const logoutTab = await page.context().newPage();
      await logoutTab.goto('/#/chat');
      await expect(logoutTab.locator('app-live-header .presence')).toHaveAttribute(
        'data-presence',
        'online',
      );
      device = await browser.newContext({
        baseURL,
        storageState: await page.context().storageState({ indexedDB: true }),
        viewport: { width: 375, height: 932 },
        hasTouch: true,
        permissions: ['local-network-access'],
        serviceWorkers: 'block',
      });
      await installAppRoutes(device, true, baseURL, deviceErrors);
      const otherDevice = await device.newPage();
      await otherDevice.goto('/#/chat');
      await expect(otherDevice.locator('app-live-header .presence')).toHaveAttribute(
        'data-presence',
        'online',
      );
      expect((await identity(otherDevice)).uid).toBe(uid);
      if (guest) await endGuest(page);
      else await leaveAccount(page);
      await expect(logoutTab).toHaveURL(/\/anmeldung$/);
      await presence(observer.page, 'Online');
      await otherDevice.close();
      await presence(observer.page, 'Offline');
      await logoutTab.close();
      await noOverflow(observer.page, info, 'presence-offline');
      const reconnect = await device.newPage();
      await reconnect.goto('/#/chat');
      await expect(reconnect.locator('app-live-header .presence')).toHaveAttribute(
        'data-presence',
        'online',
      );
      await presence(observer.page, 'Online');
      if (guest) await endGuest(reconnect);
      else await leaveAccount(reconnect);
      await presence(observer.page, 'Offline');
      if (width < 768) {
        await observer.page.locator('.title-button').tap();
        await expect(observer.page.getByRole('dialog')).toContainText('Offline');
        await observer.page.getByRole('button', { name: 'Dialog schließen' }).tap();
        await expect(observer.page.getByRole('dialog')).toBeHidden();
      }
      await observer.page.locator('.title-button').focus();
      await observer.page.keyboard.press('Enter');
      await expect(observer.page.getByRole('dialog')).toBeVisible();
      await expect(observer.page.getByRole('dialog')).toContainText('Offline');
      await expect(observer.page.locator('app-presence-label')).toHaveCSS(
        'color',
        'rgb(104, 104, 104)',
      );
      await noOverflow(observer.page, info, 'presence-profile');
      await observer.page.keyboard.press('Escape');
      expect(observer.errors).toEqual([]);
      expect(deviceErrors).toEqual([]);
    } finally {
      await device?.close();
      await observer.context.close();
    }
  });
}

test('transport interruption clears stale status, disconnects on the server and reconnects', async ({
  page,
  browser,
  baseURL,
}, info) => {
  test.setTimeout(240000);
  await page.setViewportSize({ width: 375, height: 932 });
  let blocked = false;
  const sockets: { close(): void }[] = [];
  await page.context().routeWebSocket(/ws:\/\/127\.0\.0\.1:9000\//, (socket) => {
    if (blocked) {
      socket.close();
      return;
    }
    const server = socket.connectToServer();
    sockets.push({
      close: () => {
        server.close();
        socket.close();
      },
    });
  });
  const observer = await secondUser(browser, baseURL!, 375);
  try {
    await registerChatUser(page, 'Connection ' + randomUUID().slice(0, 8));
    const name = await page.locator('app-live-header .profile > span').innerText();
    const observerName = 'Connection Observer ' + randomUUID().slice(0, 8);
    await registerChatUser(observer.page, observerName);
    await direct(observer.page, name);
    await direct(page, observerName);
    await presence(page, 'Online');
    await presence(observer.page, 'Online');
    expect(sockets.length).toBeGreaterThan(0);
    blocked = true;
    sockets.forEach((socket) => socket.close());
    await expect(page.locator('app-live-header .presence')).toHaveAttribute(
      'data-presence',
      'unknown',
    );
    await presence(page, 'Status nicht verfügbar');
    await presence(observer.page, 'Offline');
    await noOverflow(page, info, 'presence-connection-lost');
    blocked = false;
    await expect(page.locator('app-live-header .presence')).toHaveAttribute(
      'data-presence',
      'online',
      { timeout: 90000 },
    );
    await presence(observer.page, 'Online');
    await noOverflow(page, info, 'presence-reconnected');
    expect(observer.errors).toEqual([]);
  } finally {
    await observer.context.close();
  }
});

test('presence permission errors stay unknown while Auth and Firestore remain usable', async ({
  page,
  request,
}, info) => {
  const rulesUrl = 'http://127.0.0.1:9000/.settings/rules.json?ns=demo-dabubble-auth-default-rtdb';
  const headers = { Authorization: 'Bearer owner' };
  const original = await request.get(rulesUrl, { headers });
  expect(original.ok()).toBe(true);
  const rules = await original.json();
  try {
    const denied = await request.put(rulesUrl, {
      headers,
      data: { rules: { '.read': false, '.write': false } },
    });
    expect(denied.ok()).toBe(true);
    await registerChatUser(page, 'Presence Permission Test');
    await expect(page.locator('app-live-header .presence')).toHaveAttribute(
      'data-presence',
      'unknown',
    );
    await page.getByRole('button', { name: /^Profilmenü für/ }).click();
    await page.getByRole('button', { name: 'Profil', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Status nicht verfügbar');
    await noOverflow(page, info, 'presence-permission-denied');
  } finally {
    expect((await request.put(rulesUrl, { headers, data: rules })).ok()).toBe(true);
  }
  await page.reload();
  await expect(page.locator('app-live-header .presence')).toHaveAttribute(
    'data-presence',
    'online',
  );
});
