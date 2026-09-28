import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test, expect, installAppRoutes } from '../browser-fixture';
import { emulatorAccounts, finishAvatar, identity, startGuest } from './access-helpers';

test.use({ emulatedFirebase: true });

/** Checks that restored anonymous access reaches real chat with guest labeling and no alerts. */
async function expectGuest(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.locator('app-live-header .guest-label')).toHaveText('Gast');
  await expect(page.getByRole('alert')).toHaveCount(0);
}

/** Converts the current test guest through email registration and finishes avatar setup without clearing storage. */
async function upgrade(page: Page): Promise<void> {
  await page.goto('/#/registrierung');
  await page.getByLabel('Name', { exact: true }).fill('Gast bleibt erhalten');
  await page
    .getByLabel('E-Mail-Adresse', { exact: true })
    .fill(`guest-${randomUUID()}@example.test`);
  await page.getByLabel('Passwort', { exact: true }).fill(randomUUID());
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Weiter zur Avatar-Auswahl' }).click();
  await finishAvatar(page);
}

/** Checks that guest entry cannot silently replace the supplied regular account and its existing chat access. */
async function expectRegularProtected(page: Page, uid: string): Promise<void> {
  await expect(page.getByRole('button', { name: 'Gäste-Login' })).toBeEnabled();
  await page.getByRole('button', { name: 'Gäste-Login' }).click();
  await expect(page.getByRole('alert')).toContainText('Ein persönliches Konto ist aktiv.');
  await expect(page).toHaveURL(/\/anmeldung$/);
  expect(await identity(page)).toEqual({ uid, isAnonymous: false });
  await page.getByRole('link', { name: 'Mit diesem Konto zum Chat' }).click();
  await expect(
    page.getByRole('button', { name: 'Profilmenü für Gast bleibt erhalten öffnen' }),
  ).toBeVisible();
}

for (const width of [1440, 375, 320]) {
  test.describe(`existing guest ${width}px`, () => {
    test.use({ viewport: { width, height: 932 }, hasTouch: width < 768 });
    test('reuses the same account after reload, browser back and returning to login', async ({
      page,
      request,
    }, info) => {
      let creations = 0;
      page.on('request', (entry) => {
        if (entry.url().includes('accounts:signUp')) creations++;
      });
      await startGuest(page);
      const original = await identity(page);
      expect(original.isAnonymous).toBe(true);
      const accounts = (await emulatorAccounts(request)).map((entry) => entry.localId).sort();
      await page.goBack();
      await expect(page).toHaveURL(/\/anmeldung$/);
      await page.reload();
      const button = page.getByRole('button', { name: 'Gäste-Login' });
      await expect(page.getByText('Gastzugang ·', { exact: false })).toBeVisible();
      await page.screenshot({
        path: info.outputPath(`restored-login-${width}.png`),
        fullPage: true,
      });
      if (width < 768) await button.tap();
      else {
        await button.focus();
        await expect(button).toHaveCSS('outline-style', 'solid');
        await page.keyboard.press('Enter');
      }
      await expectGuest(page);
      await page.reload();
      await expectGuest(page);
      await page.goto('/#/anmeldung');
      await button.click();
      await expectGuest(page);
      await page.goto('/#/anmeldung');
      await page.getByRole('link', { name: 'Mit diesem Konto zum Chat' }).click();
      await expectGuest(page);
      expect(await identity(page)).toEqual(original);
      expect(creations).toBe(1);
      expect((await emulatorAccounts(request)).map((entry) => entry.localId).sort()).toEqual(
        accounts,
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      await page.screenshot({ path: info.outputPath(`reused-guest-${width}.png`), fullPage: true });
    });
  });
}

test('two tabs reuse one guest; upgrading in one tab protects the regular account in the other', async ({
  page,
  context,
  request,
}) => {
  let creations = 0;
  context.on('request', (entry) => {
    if (entry.url().includes('accounts:signUp')) creations++;
  });
  await startGuest(page);
  const guest = await identity(page);
  const second = await context.newPage();
  await second.goto('/#/anmeldung');
  await expect(second.getByText('Gastzugang ·', { exact: false })).toBeVisible();
  await page.goto('/#/anmeldung');
  await Promise.all([
    page.getByRole('button', { name: 'Gäste-Login' }).click(),
    second.getByRole('button', { name: 'Gäste-Login' }).click(),
  ]);
  await expectGuest(page);
  await expectGuest(second);
  expect(await identity(second)).toEqual(guest);
  expect(creations).toBe(1);
  await second.goto('/#/anmeldung');
  await upgrade(page);
  await expect(second.getByText('Gastzugang ·', { exact: false })).toBeHidden();
  const before = (await emulatorAccounts(request)).map((entry) => entry.localId).sort();
  const requestsBefore = creations;
  await expectRegularProtected(second, guest.uid);
  expect(await identity(page)).toEqual({ uid: guest.uid, isAnonymous: false });
  expect(creations).toBe(requestsBefore);
  expect((await emulatorAccounts(request)).map((entry) => entry.localId).sort()).toEqual(before);
  await second.close();
});

/** New Chromium processes share only their test-owned on-disk profile, never a cloud session. */
async function launchStoredBrowser(directory: string, errors: string[]): Promise<BrowserContext> {
  const context = await chromium.launchPersistentContext(directory, {
    baseURL: 'http://127.0.0.1:4301',
    permissions: ['local-network-access'],
    serviceWorkers: 'block',
    viewport: { width: 1440, height: 932 },
  });
  await installAppRoutes(context, true, 'http://127.0.0.1:4301', errors);
  /** Collects browser errors for each page of the isolated persistent-profile restart test. */
  const watch = (page: Page) => {
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
  };
  context.pages().forEach(watch);
  context.on('page', watch);
  return context;
}

for (const regular of [false, true]) {
  test(`browser process restart preserves ${regular ? 'regular account and rejects guest switch' : 'guest UID without creating an account'}`, async ({
    request,
  }, info) => {
    // Keep Chromium's nested IndexedDB paths below Windows path limits, independently of reporter output paths.
    await mkdir('tmp/guest-session', { recursive: true });
    const directory = await mkdtemp(resolve('tmp/guest-session/run-'));
    const errors: string[] = [];
    let context = await launchStoredBrowser(directory, errors);
    let creations = 0;
    let original: { uid: string; isAnonymous: boolean };
    try {
      const page = context.pages()[0]!;
      await startGuest(page);
      if (regular) await upgrade(page);
      original = await identity(page);
      await page.goto('/#/anmeldung');
      await expect(page.getByRole('button', { name: 'Gäste-Login' })).toBeEnabled();
    } finally {
      await context.close();
    }
    const before = (await emulatorAccounts(request)).map((entry) => entry.localId).sort();
    context = await launchStoredBrowser(directory, errors);
    context.on('request', (entry) => {
      if (entry.url().includes('accounts:signUp')) creations++;
    });
    try {
      const page = context.pages()[0]!;
      await page.goto('/#/anmeldung');
      if (regular) await expectRegularProtected(page, original.uid);
      else {
        await page.getByRole('button', { name: 'Gäste-Login' }).click();
        await expectGuest(page);
      }
      expect(await identity(page)).toEqual(original);
      expect(creations).toBe(0);
      await page.screenshot({ path: info.outputPath('after-browser-restart.png'), fullPage: true });
      expect((await emulatorAccounts(request)).map((entry) => entry.localId).sort()).toEqual(
        before,
      );
    } finally {
      await context.close();
    }
    expect(errors).toEqual([]);
  });
}
