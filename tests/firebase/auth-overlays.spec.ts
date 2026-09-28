import { test, expect } from '../browser-fixture';
import { randomUUID } from 'node:crypto';
import type { APIRequestContext, Page } from '@playwright/test';
import { identity, startGuest } from './access-helpers';
import { captureOverlay } from './overlay-evidence';

test.use({ emulatedFirebase: true, trace: 'off' });
const authEndpoint = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';

async function createAccount(request: APIRequestContext): Promise<string> {
  const email = `overlay-${randomUUID()}@example.test`;
  const response = await request.post(`${authEndpoint}/accounts:signUp?key=demo-emulator-key`, {
    data: { email, password: randomUUID(), returnSecureToken: true },
  });
  expect(response.status()).toBe(200);
  return email;
}

async function requestReset(page: Page, email: string): Promise<void> {
  await page.goto('/#/passwort-reset');
  await page.locator('#reset-email').fill(email);
  await page.getByRole('button', { name: 'E-Mail senden', exact: true }).click();
}

async function resetLink(request: APIRequestContext, email: string): Promise<string> {
  const response = await request.get(
    'http://127.0.0.1:9099/emulator/v1/projects/demo-dabubble-auth/oobCodes',
  );
  const records = (await response.json()) as {
    oobCodes: { email: string; oobLink: string; requestType: string }[];
  };
  const record = records.oobCodes.find(
    (entry) => entry.email === email && entry.requestType === 'PASSWORD_RESET',
  );
  expect(!!record).toBe(true);
  return '/?' + new URL(record!.oobLink).searchParams;
}

async function fillNewPassword(page: Page): Promise<void> {
  const password = randomUUID();
  await page.getByLabel('Neues Passwort', { exact: true }).fill(password);
  await page.getByLabel('Neues Kennwort bestätigen', { exact: true }).fill(password);
}

for (const width of [1920, 430, 375, 320]) {
  test.describe(`real reset overlays ${width}px`, () => {
    test.use({ viewport: { width, height: width === 1920 ? 1080 : 932 }, hasTouch: true });
    test('accepted email request and confirmed password change show the two Figma overlays', async ({
      page,
      request,
    }, info) => {
      const email = await createAccount(request);
      await requestReset(page, email);
      await expect(page.locator('app-success-overlay .confirmation')).toHaveText('E-Mail gesendet');
      await captureOverlay(page, info, 'email');
      // The message does not attest inbox delivery or disclose account existence.
      await expect(page.getByRole('status')).toContainText('Wenn ein Konto');
      await page.keyboard.press('Escape');
      await expect(page.locator('app-success-overlay')).toHaveCount(0);
      await expect(
        page.getByRole('link', { name: 'Zur Anmeldung', exact: true }).last(),
      ).toBeFocused();
      const link = await resetLink(request, email);
      await page.goto(link);
      await fillNewPassword(page);
      await page.getByRole('button', { name: 'Passwort ändern', exact: true }).tap();
      await expect(page.locator('app-success-overlay .confirmation')).toHaveText('Anmelden');
      await captureOverlay(page, info, 'signin');
      await expect(page.getByRole('status')).toContainText('Dein Passwort wurde geändert');
      // Automatic dismissal preserves the existing explicit navigation to the login form.
      await expect(page.locator('app-success-overlay')).toHaveCount(0);
      await expect(
        page.getByRole('link', { name: 'Zur Anmeldung', exact: true }).last(),
      ).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/#\/anmeldung$/);
      await page.goto(link);
      await expect(page.getByRole('alert')).toContainText('ungültig');
      await expect(page.locator('app-success-overlay')).toHaveCount(0);
      await page.screenshot({ path: info.outputPath('used-code-error.png'), fullPage: true });
    });
  });
}

test('failed mail request shows no success; duplicate submit is prevented and retry succeeds', async ({
  page,
  request,
}, info) => {
  const email = await createAccount(request);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route('**/accounts:sendOobCode?*', async (route) => {
    requests++;
    await gate;
    await route.fulfill({
      status: 400,
      json: { error: { message: 'TOO_MANY_ATTEMPTS_TRY_LATER' } },
    });
  });
  await page.goto('/#/passwort-reset');
  await page.locator('#reset-email').fill(email);
  await page.locator('form').evaluate((form: HTMLFormElement) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(page.getByRole('button', { name: 'E-Mail wird angefordert…' })).toBeDisabled();
  await expect(page.locator('app-success-overlay')).toHaveCount(0);
  release();
  await expect(page.getByRole('alert')).toContainText('Zu viele Versuche');
  expect(requests).toBe(1);
  await expect(page.locator('app-success-overlay')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('email-request-error.png'), fullPage: true });
  await page.unroute('**/accounts:sendOobCode?*');
  await page.getByRole('button', { name: 'E-Mail senden', exact: true }).click();
  await expect(page.locator('app-success-overlay .confirmation')).toHaveText('E-Mail gesendet');
});

test('rejected password change shows no success; retry changes the password through the emulator', async ({
  page,
  request,
}, info) => {
  await page.setViewportSize({ width: 320, height: 932 });
  const email = await createAccount(request);
  await requestReset(page, email);
  await expect(page.locator('app-success-overlay .confirmation')).toBeVisible();
  await page.goto(await resetLink(request, email));
  await fillNewPassword(page);
  await page.route('**/accounts:resetPassword?*', async (route) => {
    if (!route.request().postDataJSON()?.newPassword) return route.fallback();
    await route.fulfill({ status: 400, json: { error: { message: 'WEAK_PASSWORD' } } });
  });
  await page.getByRole('button', { name: 'Passwort ändern', exact: true }).click();
  await expect(page.locator('#reset-password-error')).toContainText('Sicherheitsanforderungen');
  await expect(page.locator('app-success-overlay')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('password-change-error.png'), fullPage: true });
  await page.unroute('**/accounts:resetPassword?*');
  await fillNewPassword(page);
  await page.getByRole('button', { name: 'Passwort ändern', exact: true }).click();
  await expect(page.locator('app-success-overlay .confirmation')).toHaveText('Anmelden');
});

test('unknown email gets the same neutral confirmation without creating an account', async ({
  page,
}) => {
  await requestReset(page, `unknown-${randomUUID()}@example.test`);
  await expect(page.locator('app-success-overlay .confirmation')).toHaveText('E-Mail gesendet');
  await expect(page.getByRole('status')).toContainText('Wenn ein Konto');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Wenn ein Konto');
  await expect(page.locator('app-success-overlay')).toHaveCount(0);
});

test('failed guest conversion keeps the anonymous identity and shows no account confirmation', async ({
  page,
  request,
}, info) => {
  await page.setViewportSize({ width: 320, height: 932 });
  const occupiedEmail = await createAccount(request);
  await startGuest(page);
  const guest = await identity(page);
  await page.goto('/#/registrierung');
  await page.getByLabel('Name', { exact: true }).fill('Guest Upgrade');
  await page.getByLabel('E-Mail-Adresse', { exact: true }).fill(occupiedEmail);
  await page.getByLabel('Passwort', { exact: true }).fill(randomUUID());
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Weiter zur Avatar-Auswahl' }).click();
  await expect(page.locator('#auth-email-error')).toContainText('bereits verwendet');
  await expect(page.locator('app-success-overlay')).toHaveCount(0);
  expect(await identity(page)).toEqual(guest);
  await page.screenshot({ path: info.outputPath('guest-upgrade-error.png'), fullPage: true });
  await page.goto('/#/chat');
  await page.reload();
  await expect(page.locator('app-live-header .guest-label')).toHaveText('Gast');
  expect(await identity(page)).toEqual(guest);
});

test('reduced motion keeps the real confirmation accessible without sliding animation', async ({
  page,
  request,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await requestReset(page, await createAccount(request));
  const status = page.locator('app-success-overlay [role="status"]');
  await expect(status).toBeFocused();
  expect(await status.evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.locator('app-success-overlay')).toHaveCount(0);
});
