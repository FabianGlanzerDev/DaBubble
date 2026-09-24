import { test, expect } from '../browser-fixture';
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test.use({ emulatedFirebase: true });
const password = randomUUID(); // Generated per local emulator run; never stored in the repository.

async function register(page: Page, email: string, name: string, avatar = 3): Promise<void> {
  await page.goto('/registrierung');
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('E-Mail-Adresse', { exact: true }).fill(email);
  await page.getByLabel('Passwort', { exact: true }).fill(password);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Weiter zur Avatar-Auswahl' }).click();
  await expect(page).toHaveURL(/\/avatar-auswahl$/);
  await page.getByRole('button', { name: `Avatar ${avatar}`, exact: true }).click();
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByRole('button', { name: `Profilmenü für ${name} öffnen` })).toBeVisible();
}

async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Profilmenü für/ }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page).toHaveURL(/\/anmeldung$/);
}

async function login(page: Page, email: string, secret = password): Promise<void> {
  await page.goto('/anmeldung');
  await page.getByLabel('E-Mail-Adresse', { exact: true }).fill(email);
  await page.getByLabel('Passwort', { exact: true }).fill(secret);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
}

for (const width of [1280, 375]) {
  test(`${width}px: two separate accounts register, persist sessions, edit profiles, logout and sign in again`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 932 });
    const suffix = Date.now();
    const alice = `alice-${suffix}@example.test`,
      bob = `bob-${suffix}@example.test`;
    await register(page, alice, 'Alice Test');
    await page.reload();
    await expect(page).toHaveURL(/\/chat$/);
    await expect(
      page.getByRole('button', { name: 'Profilmenü für Alice Test öffnen' }),
    ).toBeVisible();
    await page.getByRole('button', { name: /^Profilmenü für/ }).click();
    await page.getByRole('button', { name: 'Profil', exact: true }).click();
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
    await page.getByLabel('Vollständiger Name', { exact: true }).fill('Alice Aktualisiert');
    await page.getByRole('button', { name: 'Avatar ändern' }).click();
    await page.getByRole('button', { name: 'Avatar 6', exact: true }).click();
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(
      page.getByRole('dialog').getByRole('heading', { name: 'Profil', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('dialog')).toContainText('Alice Aktualisiert');
    await page.screenshot({ path: info.outputPath('saved-profile.png') });
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('button', { name: 'Profilmenü für Alice Aktualisiert öffnen' }),
    ).toBeVisible();
    await page.reload();
    await expect(page.locator('.profile app-avatar-image img')).toHaveAttribute(
      'src',
      /avatar-option-4.svg$/,
    );
    await logout(page);
    await page.goto('/chat/channels/entwicklerteam');
    await expect(page).toHaveURL(/\/anmeldung\?/);
    await register(page, bob, 'Bob Test', 2);
    await logout(page);
    await login(page, alice);
    await expect(page).toHaveURL(/\/chat$/);
    await expect(
      page.getByRole('button', { name: 'Profilmenü für Alice Aktualisiert öffnen' }),
    ).toBeVisible();
    await logout(page);
    await login(page, bob);
    await expect(page).toHaveURL(/\/chat$/);
    await expect(
      page.getByRole('button', { name: 'Profilmenü für Bob Test öffnen' }),
    ).toBeVisible();
  });
}

test('duplicate email and invalid credentials produce field errors; repeated submit creates one account', async ({
  page,
}) => {
  const email = `duplicate-${Date.now()}@example.test`;
  let registrations = 0;
  page.on('request', (request) => {
    if (request.url().includes('accounts:signUp')) registrations++;
  });
  await page.route('**/accounts:signUp?*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fallback();
  });
  await page.goto('/registrierung');
  await page.getByLabel('Name', { exact: true }).fill('Duplicate Test');
  await page.getByLabel('E-Mail-Adresse', { exact: true }).fill(email);
  await page.getByLabel('Passwort', { exact: true }).fill(password);
  await page.getByRole('checkbox').check();
  await expect(page.getByRole('button', { name: 'Weiter zur Avatar-Auswahl' })).toBeEnabled();
  await page.locator('form').evaluate((form: HTMLFormElement) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(page.getByRole('button', { name: 'Weiter zur Avatar-Auswahl' })).toBeDisabled();
  await expect(page).toHaveURL(/\/avatar-auswahl$/);
  expect(registrations).toBe(1);
  await page.reload();
  await page.getByLabel('Name', { exact: true }).fill('Resumed Test');
  await page.getByRole('button', { name: 'Avatar 1', exact: true }).click();
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await expect(page).toHaveURL(/\/chat$/);
  await logout(page);
  await registerUntilSubmit(page, email);
  await expect(page.locator('#auth-email-error')).toHaveText(
    'Diese E-Mail-Adresse wird bereits verwendet.',
  );
  await login(page, email, randomUUID());
  await expect(page.locator('#auth-password-error')).toContainText(
    'E-Mail-Adresse oder Passwort ist nicht korrekt.',
  );
  await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeEnabled();
});

async function registerUntilSubmit(page: Page, email: string): Promise<void> {
  await page.goto('/registrierung');
  await page.getByLabel('Name', { exact: true }).fill('Other Name');
  await page.getByLabel('E-Mail-Adresse', { exact: true }).fill(email);
  await page.getByLabel('Passwort', { exact: true }).fill(password);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Weiter zur Avatar-Auswahl' }).click();
}

for (const width of [1280, 430]) {
  test(`${width}px: real SDK reset request, token verification, password change and used-token rejection`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 932 });
    const email = `reset-${Date.now()}@example.test`;
    await register(page, email, 'Reset Test');
    await logout(page);
    await page.goto('/passwort-reset');
    await page.getByLabel('E-Mail-Adresse', { exact: true }).fill(email);
    await page.getByRole('button', { name: 'E-Mail senden', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Wenn ein Konto');
    const response = await page.request.get(
      'http://127.0.0.1:9099/emulator/v1/projects/demo-dabubble-auth/oobCodes',
    );
    const body = (await response.json()) as {
      oobCodes: { email: string; oobCode: string; requestType: string }[];
    };
    const code = body.oobCodes.find(
      (entry) => entry.email === email && entry.requestType === 'PASSWORD_RESET',
    )?.oobCode;
    expect(code).toBeTruthy();
    const destination = `/passwort-reset/neues-passwort?mode=resetPassword&oobCode=${encodeURIComponent(code!)}`;
    await page.goto(destination);
    const changedPassword = randomUUID();
    await page.getByLabel('Neues Passwort', { exact: true }).fill(changedPassword);
    await page.getByLabel('Neues Kennwort bestätigen', { exact: true }).fill(changedPassword);
    await page.getByRole('button', { name: 'Passwort ändern', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Dein Passwort wurde geändert');
    await login(page, email, changedPassword);
    await expect(page).toHaveURL(/\/chat$/);
    await logout(page);
    await login(page, email, password);
    await expect(page.locator('#auth-password-error')).toContainText('nicht korrekt');
    await page.goto(destination);
    await expect(page.getByRole('alert')).toContainText('ungültig oder wurde bereits verwendet');
    await expect(page.getByRole('button', { name: 'Passwort ändern', exact: true })).toBeDisabled();
  });
}

test('protected avatar route rejects anonymous users and invalid reset feedback fits 320px', async ({
  page,
}) => {
  await page.goto('/avatar-auswahl');
  await expect(page).toHaveURL(/\/anmeldung\?/);
  await page.goto('/passwort-reset/neues-passwort?oobCode=invalid&mode=resetPassword');
  await expect(page.getByRole('alert')).toContainText('ungültig');
  await page.setViewportSize({ width: 320, height: 720 });
  const size = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(size.scroll).toBeLessThanOrEqual(size.width);
});

test('logout revokes another open tab including a chat route with query parameters', async ({
  page,
  context,
}) => {
  await register(page, `tabs-${Date.now()}@example.test`, 'Tab Test');
  const second = await context.newPage();
  const errors: string[] = [];
  second.on('pageerror', (error) => errors.push(error.message));
  await second.goto('/chat?pane=main');
  await expect(
    second.getByRole('button', { name: 'Profilmenü für Tab Test öffnen' }),
  ).toBeVisible();
  await logout(page);
  await expect(second).toHaveURL(/\/anmeldung$/);
  await second.goto('/chat');
  await expect(second).toHaveURL(/\/anmeldung\?/);
  expect(errors).toEqual([]);
  await second.close();
});

test('malformed Firebase configuration fails closed without contacting a cloud project', async ({
  page,
}) => {
  await page.route('**/firebase-config.json', (route) =>
    route.fulfill({ json: { firebase: {}, emulators: false } }),
  );
  await page.goto('/chat');
  await expect(page).toHaveURL(/\/anmeldung\?/);
  await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeDisabled();
  await expect(page.locator('#auth-note')).toContainText('Webkonfiguration');
});

test('own profile dialogs and validation remain usable at 320px', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await register(page, `mobile-${Date.now()}@example.test`, 'Mobile Test');
  await page.getByRole('button', { name: /^Profilmenü für/ }).click();
  await page.getByRole('button', { name: 'Profil', exact: true }).click();
  await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
  await page.getByLabel('Vollständiger Name', { exact: true }).fill('');
  await expect(page.getByRole('button', { name: 'Speichern', exact: true })).toBeDisabled();
  await expect(page.locator('#profile-error')).toHaveText('Bitte gib einen Namen ein.');
  await page.getByLabel('Vollständiger Name', { exact: true }).fill('x'.repeat(81));
  await expect(page.locator('#profile-error')).toContainText('höchstens 80');
  await page.getByLabel('Vollständiger Name', { exact: true }).fill('Mobiles Profil');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Bearbeiten', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('Mobiles Profil');
  const dimensions = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    dialog: document.querySelector('dialog')!.getBoundingClientRect().right,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
  expect(dimensions.dialog).toBeLessThanOrEqual(dimensions.width);
  await page.screenshot({ path: info.outputPath('profile-320.png') });
});
