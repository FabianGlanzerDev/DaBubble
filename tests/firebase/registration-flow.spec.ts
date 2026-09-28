import { randomUUID } from 'node:crypto';
import { test, expect } from '../browser-fixture';
import { identity, leaveAccount, startGuest } from './access-helpers';
import type { Page } from '@playwright/test';
import { captureOverlay } from './overlay-evidence';

test.use({ emulatedFirebase: true });
const draftKey = 'dabubble.registration.v1';

async function fillRegistration(page: Page): Promise<void> {
  await page.goto('/#/registrierung');
  await page.getByLabel('Name', { exact: true }).fill('Frederik Beck');
  await page
    .getByLabel('E-Mail-Adresse', { exact: true })
    .fill(`setup-${randomUUID()}@example.test`);
  await page.getByLabel('Passwort', { exact: true }).fill(randomUUID());
  await page.getByRole('checkbox').check();
}

async function startRegistration(page: Page): Promise<void> {
  await fillRegistration(page);
  await page.getByRole('button', { name: 'Weiter zur Avatar-Auswahl' }).click();
  await expect(page).toHaveURL(/\/avatar-auswahl$/);
}

async function expectRestored(page: Page, name = 'Frederik Beck'): Promise<void> {
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.getByLabel('Name', { exact: true })).toHaveCount(0);
  await expect(page.locator('app-auth-note')).toHaveCount(0);
}

for (const width of [1920, 430, 375, 320]) {
  for (const guest of [false, true]) {
    test.describe(`${guest ? 'guest upgrade' : 'email signup'} ${width}px`, () => {
      test.use({ viewport: { width, height: width === 1920 ? 1080 : 932 }, hasTouch: width < 768 });
      test('restores name/selection, back navigation, one account and success before chat', async ({
        page,
      }, info) => {
        let signupCount = 0;
        page.on('request', (request) => {
          if (request.url().includes('accounts:signUp')) signupCount++;
        });
        if (guest) await startGuest(page);
        const guestUid = guest ? (await identity(page)).uid : null;
        await startRegistration(page);
        const uid = (await identity(page)).uid;
        if (guest) expect(uid).toBe(guestUid);
        await page.reload();
        await expectRestored(page);
        if (guest) {
          await expect(page.getByRole('button', { name: 'Avatar 1', exact: true })).toHaveAttribute(
            'aria-pressed',
            'true',
          );
          await expect(page.getByRole('button', { name: 'Weiter', exact: true })).toBeEnabled();
        } else
          await expect(page.getByRole('button', { name: 'Weiter', exact: true })).toBeDisabled();
        await page.screenshot({ path: info.outputPath(`avatar-${width}.png`), fullPage: true });
        const avatar = page.getByRole('button', { name: 'Avatar 3', exact: true });
        await avatar.hover();
        expect(await avatar.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');
        await avatar.focus();
        if (width < 768) await avatar.tap();
        else await page.keyboard.press('Enter');
        await expect(avatar).toHaveAttribute('aria-pressed', 'true');
        await page.reload();
        await expectRestored(page);
        await expect(avatar).toHaveAttribute('aria-pressed', 'true');
        await page.getByRole('link', { name: 'Zur Registrierung', exact: true }).click();
        await expect(page).toHaveURL(/\/registrierung$/);
        await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Frederik Beck');
        await expect(page.getByLabel('E-Mail-Adresse', { exact: true })).toBeDisabled();
        await expect(page.getByLabel('Passwort', { exact: true })).toHaveCount(0);
        await page.goBack();
        await expect(page).toHaveURL(/\/avatar-auswahl$/);
        await expect(avatar).toHaveAttribute('aria-pressed', 'true');
        await page.getByRole('link', { name: 'Zur Registrierung', exact: true }).click();
        await page.getByLabel('Name', { exact: true }).fill('Frederik Neu');
        await page.getByRole('button', { name: 'Weiter zur Avatar-Auswahl' }).click();
        await page.reload();
        await expectRestored(page, 'Frederik Neu');
        expect((await identity(page)).uid).toBe(uid);
        // Linking an anonymous account also uses signUp, retaining the verified same UID.
        expect(signupCount).toBe(guest ? 2 : 1);
        await page.getByRole('button', { name: 'Weiter', exact: true }).click();
        await expect(page.getByRole('status')).toHaveText('Konto erfolgreich erstellt!');
        await expect(page).toHaveURL(/\/avatar-auswahl$/);
        await expect(page.locator('app-public-layout')).toHaveAttribute('inert', '');
        await page.screenshot({
          path: info.outputPath(`success-${width}.png`),
          animations: 'disabled',
        });
        await captureOverlay(page, info, guest ? 'guest-upgrade' : 'registration');
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
        await page.reload();
        await expect(page.getByRole('status')).toHaveText('Konto erfolgreich erstellt!');
        await expect(page).toHaveURL(/\/chat$/);
        expect(await page.evaluate((key) => sessionStorage.getItem(key), draftKey)).toBeNull();
        await expect(
          page.getByRole('button', { name: 'Profilmenü für Frederik Neu öffnen' }),
        ).toBeVisible();
        await page.reload();
        await expect(
          page.getByRole('button', { name: 'Profilmenü für Frederik Neu öffnen' }),
        ).toBeVisible();
      });
    });
  }
}

test('leaving before signup makes no account; leaving a pending signup does not force navigation', async ({
  page,
}) => {
  await fillRegistration(page);
  let signupCount = 0;
  page.on('request', (request) => {
    if (request.url().includes('accounts:signUp')) signupCount++;
  });
  await page.getByRole('link', { name: 'Zur Anmeldung', exact: true }).click();
  expect(signupCount).toBe(0);
  await fillRegistration(page);
  await page.route('**/accounts:signUp?*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.fallback();
  });
  const response = page.waitForResponse((result) => result.url().includes('accounts:signUp'));
  await page.getByRole('button', { name: 'Weiter zur Avatar-Auswahl' }).click();
  await page.getByRole('link', { name: 'Impressum', exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect.poll(async () => (await identity(page).catch(() => null))?.isAnonymous).toBe(false);
  await expect(page).toHaveURL(/\/impressum$/);
  await page.goto('/#/anmeldung');
  await page.getByRole('link', { name: 'Registrierung fortsetzen' }).click();
  await expectRestored(page);
  expect(signupCount).toBe(1);
});

test('guest entry is direct and canceling navigation does not create a second guest', async ({
  page,
}) => {
  await page.goto('/#/zugang/gast');
  await expect(page).toHaveURL(/\/anmeldung$/);
  await expect(page.getByRole('button', { name: 'Gäste-Zugang starten' })).toHaveCount(0);
  let requests = 0;
  await page.route('**/accounts:signUp?*', async (route) => {
    requests++;
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.fallback();
  });
  const response = page.waitForResponse((result) => result.url().includes('accounts:signUp'));
  await page.getByRole('button', { name: 'Gäste-Login' }).click();
  await page.getByRole('link', { name: 'Impressum', exact: true }).click();
  await response;
  await expect.poll(async () => (await identity(page).catch(() => null))?.isAnonymous).toBe(true);
  await expect(page).toHaveURL(/\/impressum$/);
  await startGuest(page);
  expect(requests).toBe(1);
});

test.describe('profile permission error', () => {
  test.use({ expectedProfileDenied: true });
  test('denied profile save retains progress, shows no success and permits a retry', async ({
    page,
    request,
  }, info) => {
    await startRegistration(page);
    const { uid } = await identity(page);
    await page.getByRole('button', { name: 'Avatar 4', exact: true }).click();
    const documents =
      'http://127.0.0.1:8080/v1/projects/demo-dabubble-auth/databases/(default)/documents';
    const lock = `${documents}/accountDeletions/${uid}`;
    const headers = { Authorization: 'Bearer owner' };
    expect((await request.patch(lock, { headers, data: { fields: {} } })).status()).toBe(200);
    const denial = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith('/documents:batchGet') &&
        response.status() === 403,
    );
    await page.getByRole('button', { name: 'Weiter', exact: true }).click();
    await denial;
    await expect(page.getByRole('alert')).toContainText('Zugriff auf das Profil verweigert');
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(page.locator('app-success-overlay')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('registration-save-error.png'), fullPage: true });
    expect((await request.get(`${documents}/users/${uid}`, { headers })).status()).toBe(404);
    await request.delete(lock, { headers });
    await page.reload();
    await expectRestored(page);
    await expect(page.getByRole('button', { name: 'Avatar 4', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: 'Weiter', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Konto erfolgreich erstellt!');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/chat$/);
  });
});

test('unavailable draft storage prevents signup and explains how to retry', async ({ page }) => {
  await fillRegistration(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'dabubble.registration.v1') throw new Error('Storage unavailable');
      original.call(this, key, value);
    };
  });
  let requests = 0;
  page.on('request', (request) => {
    if (request.url().includes('accounts:signUp')) requests++;
  });
  await page.getByRole('button', { name: 'Weiter zur Avatar-Auswahl' }).click();
  await expect(page.getByRole('alert')).toContainText('Sitzungsspeicher');
  expect(requests).toBe(0);
});

test('logout from another tab clears the incomplete registration draft', async ({
  page,
  context,
}) => {
  await startRegistration(page);
  await page.getByRole('button', { name: 'Avatar 2', exact: true }).click();
  const second = await context.newPage();
  await second.goto('/#/chat');
  await leaveAccount(second);
  await expect(page).toHaveURL(/\/anmeldung$/);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), draftKey)).toBeNull();
  await expect(page.getByRole('link', { name: 'Registrierung fortsetzen' })).toHaveCount(0);
  await second.close();
});
