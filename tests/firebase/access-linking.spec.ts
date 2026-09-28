import { randomUUID } from 'node:crypto';
import { test, expect } from '../browser-fixture';
import {
  chooseGoogle,
  enableEmulatorPopup,
  emulatorAccounts,
  finishAvatar,
  identity,
  leaveAccount,
  openGoogle,
  startGuest,
  endGuest,
} from './access-helpers';
import { createChannel, send } from './chat-helpers';
import type { Page } from '@playwright/test';

test.use({ emulatedFirebase: true });

async function passwordAccount(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/#/registrierung');
  await page.getByLabel('Name', { exact: true }).fill('Bestehendes Konto');
  await page.getByLabel('E-Mail-Adresse', { exact: true }).fill(email);
  await page.getByLabel('Passwort', { exact: true }).fill(password);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Weiter zur Avatar-Auswahl' }).click();
  await finishAvatar(page);
}

test('explicit Google linking preserves UID, profile, channel history and password login; collisions leave guest intact', async ({
  page,
  context,
}) => {
  await enableEmulatorPopup(context);
  const email = `link-${randomUUID()}@example.test`,
    password = randomUUID();
  await passwordAccount(page, email, password);
  const original = await identity(page);
  await createChannel(page, `test-${randomUUID()}`);
  const roomUrl = page.url();
  await send(page, 'Dieser Chat muss erhalten bleiben.');
  await page.getByRole('button', { name: /^Profilmenü für/ }).click();
  await page.getByRole('link', { name: 'Google verknüpfen' }).click();
  await expect(page.getByRole('button', { name: 'Google-Fenster öffnen' })).toBeDisabled();
  await chooseGoogle(await openGoogle(page), email, 'Nicht das Firestore-Profil');
  await expect(page.getByRole('status')).toContainText('zusätzliche Anmeldemethode');
  expect(await identity(page)).toEqual(original);
  await page.getByRole('link', { name: 'Zum Arbeitsbereich' }).click();
  await page.goto(roomUrl);
  await expect(page.getByText('Dieser Chat muss erhalten bleiben.', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Profilmenü für Bestehendes Konto öffnen' }),
  ).toBeVisible();
  await leaveAccount(page);
  await page.getByLabel('E-Mail-Adresse', { exact: true }).fill(email);
  await page.getByLabel('Passwort', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page).toHaveURL(/\/chat$/);
  expect(await identity(page)).toEqual(original);
  await leaveAccount(page);
  await startGuest(page);
  const guest = await identity(page);
  await page.goto('/#/registrierung');
  await page.getByLabel('Name', { exact: true }).fill('Gast Kollision');
  await page.getByLabel('E-Mail-Adresse', { exact: true }).fill(email);
  await page.getByLabel('Passwort', { exact: true }).fill(randomUUID());
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Weiter zur Avatar-Auswahl' }).click();
  await expect(
    page.getByText('Diese E-Mail-Adresse wird bereits verwendet.', { exact: true }),
  ).toBeVisible();
  expect(await identity(page)).toEqual(guest);
  await page.goto('/#/zugang/google');
  await chooseGoogle(await openGoogle(page), email);
  await expect(page.getByRole('alert')).toContainText('bereits zu einem anderen DaBubble-Konto');
  expect(await identity(page)).toEqual(guest);
  await endGuest(page);
  await page.getByRole('button', { name: 'Anmelden mit Google' }).click();
  await chooseGoogle(await openGoogle(page), email);
  await expect(page).toHaveURL(/\/chat$/);
  expect(await identity(page)).toEqual(original);
  await page.goto(roomUrl);
  await expect(page.getByText('Dieser Chat muss erhalten bleiben.', { exact: true })).toBeVisible();
});

test('confirmed Google sign-in can reuse the same-email password UID without overwriting Firestore', async ({
  page,
  context,
  request,
}) => {
  await enableEmulatorPopup(context);
  const email = `same-email-${randomUUID()}@gmail.com`;
  await passwordAccount(page, email, randomUUID());
  const original = await identity(page);
  await createChannel(page, `same-${randomUUID()}`);
  await send(page, 'Vor der Google-Zuordnung');
  const roomUrl = page.url();
  await leaveAccount(page);
  await page.getByRole('button', { name: 'Anmelden mit Google' }).click();
  await expect(
    page.getByText(/Firebase dich einem bestehenden DaBubble-Konto zuordnen/),
  ).toBeVisible();
  await chooseGoogle(await openGoogle(page), email, 'Anderer Google Name');
  await expect(page).toHaveURL(/\/chat$/);
  expect(await identity(page)).toEqual(original);
  const authAccount = (await emulatorAccounts(request)).find(
    (entry) => entry.localId === original.uid,
  );
  expect(authAccount?.providerUserInfo?.map((provider) => provider.providerId)).toEqual([
    'google.com',
  ]);
  expect(authAccount?.passwordHash).toBeUndefined();
  await page.goto(roomUrl);
  await expect(page.getByText('Vor der Google-Zuordnung', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Profilmenü für Bestehendes Konto öffnen' }),
  ).toBeVisible();
});

test('guest creation errors and duplicate submits recover; canceling signout preserves the session', async ({
  page,
  request,
}) => {
  await page.goto('/#/anmeldung');
  await page.route('**/accounts:signUp?*', (route) =>
    route.fulfill({ status: 400, json: { error: { message: 'OPERATION_NOT_ALLOWED' } } }),
  );
  await page.getByRole('button', { name: 'Gäste-Login' }).click();
  await expect(page.getByRole('alert')).toContainText('noch nicht aktiviert');
  await page.unroute('**/accounts:signUp?*');
  let requests = 0;
  await page.route('**/accounts:signUp?*', async (route) => {
    requests++;
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fallback();
  });
  await page.getByRole('button', { name: 'Gäste-Login' }).dblclick();
  await expect(page.locator('app-live-header .guest-label')).toBeVisible();
  expect(requests).toBe(1);
  const guest = await identity(page);
  await page.goto('/#/zugang/gast');
  await expect(page.getByRole('button', { name: 'Als Gast abmelden' })).toBeDisabled();
  await page.getByRole('link', { name: 'Abbrechen', exact: true }).click();
  await expect(page).toHaveURL(/\/chat$/);
  expect(await identity(page)).toEqual(guest);
  await endGuest(page);
  expect((await emulatorAccounts(request)).some((entry) => entry.localId === guest.uid)).toBe(true);
});
