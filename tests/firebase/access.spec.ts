/**
 * Exercises guest and simulated Google access, session persistence, provider errors and data-preserving logout in emulators.
 *
 * @packageDocumentation
 */

import { randomUUID } from 'node:crypto';
import { test, expect } from '../browser-fixture';
import { createChannel, send } from './chat-helpers';
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

test.use({ emulatedFirebase: true });

for (const width of [1440, 375, 320]) {
  test.describe(`new access ${width}px`, () => {
    test.use({ viewport: { width, height: 932 }, hasTouch: width < 768 });

    test('guest persists after reload and upgrades with the same UID and chat data', async ({
      page,
    }, info) => {
      await startGuest(page);
      const guest = await identity(page);
      expect(guest.isAnonymous).toBe(true);
      await page.reload();
      await expect(page.locator('app-live-header .guest-label')).toBeVisible();
      expect(await identity(page)).toEqual(guest);
      await page.goto('/#/vorschau/channels/entwicklerteam');
      await expect(page.getByLabel('Nachrichtenentwurf', { exact: true })).toBeDisabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: info.outputPath(`guest-${width}.png`), fullPage: true });
      await page.goto('/#/chat');
      await createChannel(page, 'Upgrade ' + randomUUID());
      await send(page, 'Gastdaten bleiben nach der Umwandlung');
      const roomUrl = page.url();
      await page.goto('/#/zugang/gast');
      const upgrade = page.getByRole('link', { name: 'Konto erstellen', exact: true });
      if (width < 768) await upgrade.tap();
      else {
        await upgrade.focus();
        await page.keyboard.press('Enter');
      }
      const email = `guest-upgrade-${randomUUID()}@example.test`;
      const password = randomUUID();
      await page.getByLabel('Name', { exact: true }).fill('Dauerhafter Gast');
      await page.getByLabel('E-Mail-Adresse', { exact: true }).fill(email);
      await page.getByLabel('Passwort', { exact: true }).fill(password);
      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: 'Weiter zur Avatar-Auswahl' }).click();
      await finishAvatar(page);
      expect(await identity(page)).toEqual({ uid: guest.uid, isAnonymous: false });
      await page.goto(roomUrl);
      await expect(page.locator('.bubble')).toContainText('Gastdaten bleiben nach der Umwandlung');
      await leaveAccount(page);
      await page.getByLabel('E-Mail-Adresse', { exact: true }).fill(email);
      await page.getByLabel('Passwort', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
      await expect(page).toHaveURL(/\/chat$/);
      expect((await identity(page)).uid).toBe(guest.uid);
      await page.goto(roomUrl);
      await expect(page.locator('.bubble')).toContainText('Gastdaten bleiben nach der Umwandlung');
    });

    test('Google popup creates profile, persists and restores same account', async ({
      page,
      context,
    }, info) => {
      await enableEmulatorPopup(context);
      await page.goto('/#/anmeldung');
      const button = page.getByRole('button', { name: 'Anmelden mit Google' });
      await expect(button).toBeEnabled();
      await button.hover();
      expect(await button.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none');
      await button.focus();
      expect(await button.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
      await page.screenshot({ path: info.outputPath(`login-${width}.png`), fullPage: true });
      if (width < 768) await button.tap();
      else await page.keyboard.press('Enter');
      await expect(page.getByRole('button', { name: 'Google-Fenster öffnen' })).toBeDisabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: info.outputPath(`google-confirm-${width}.png`),
        fullPage: true,
      });
      const email = `google-${randomUUID()}@example.test`;
      const popup = await openGoogle(page);
      await expect(page.getByRole('button', { name: 'Google wird geöffnet…' })).toBeDisabled();
      await chooseGoogle(popup, email);
      await finishAvatar(page, 'Google Test');
      const user = await identity(page);
      expect(user.isAnonymous).toBe(false);
      await page.reload();
      await expect(
        page.getByRole('button', { name: 'Profilmenü für Google Test öffnen' }),
      ).toBeVisible();
      await page.screenshot({ path: info.outputPath(`google-account-${width}.png`) });
      expect(await identity(page)).toEqual(user);
      await leaveAccount(page);
      await page.getByRole('button', { name: 'Anmelden mit Google' }).click();
      await chooseGoogle(await openGoogle(page), email);
      await expect(page).toHaveURL(/\/chat$/);
      expect(await identity(page)).toEqual(user);
    });
  });
}

test('confirmed guest logout preserves Auth, profile, membership and messages; a new guest cannot access them', async ({
  page,
  request,
}) => {
  await startGuest(page);
  const { uid } = await identity(page);
  const before = (await emulatorAccounts(request)).map((account) => account.localId).sort();
  expect(before).toContain(uid);
  await createChannel(page, 'Retained ' + randomUUID());
  await send(page, 'Nach Abmeldung gespeichert');
  const roomUrl = page.url();
  const roomId = new URL(roomUrl).hash.split('/').pop()!;
  let deletions = 0;
  page.on('request', (entry) => {
    if (entry.url().includes('accounts:delete')) deletions++;
  });
  for (const collection of ['users', 'directory']) {
    const profile = await request.get(
      `http://127.0.0.1:8080/v1/projects/demo-dabubble-auth/databases/(default)/documents/${collection}/${uid}`,
      { headers: { Authorization: 'Bearer owner' } },
    );
    expect(profile.status()).toBe(200);
  }
  await endGuest(page);
  const after = (await emulatorAccounts(request)).map((account) => account.localId).sort();
  expect(after).toEqual(before);
  expect(deletions).toBe(0);
  const documents =
    'http://127.0.0.1:8080/v1/projects/demo-dabubble-auth/databases/(default)/documents/';
  for (const path of [
    `users/${uid}`,
    `directory/${uid}`,
    `conversations/${roomId}`,
    `conversations/${roomId}/messages`,
  ])
    expect(
      (
        await request.get(documents + path, { headers: { Authorization: 'Bearer owner' } })
      ).status(),
    ).toBe(200);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Gäste-Login' })).toBeEnabled();
  await startGuest(page);
  expect((await identity(page)).uid).not.toBe(uid);
  await page.goto(roomUrl);
  await expect(page.getByRole('heading', { name: 'Gespräch nicht verfügbar' })).toBeVisible();
});

test('upgrading a guest updates a second tab; subsequent logout cannot delete the permanent account', async ({
  page,
  context,
  request,
}) => {
  await startGuest(page);
  const original = await identity(page);
  const second = await context.newPage();
  await second.goto('/#/chat');
  await expect(second.locator('app-live-header .guest-label')).toBeVisible();
  await page.goto('/#/registrierung');
  await page.getByLabel('Name', { exact: true }).fill('Zwei Tabs');
  await page
    .getByLabel('E-Mail-Adresse', { exact: true })
    .fill(`tabs-guest-${randomUUID()}@example.test`);
  await page.getByLabel('Passwort', { exact: true }).fill(randomUUID());
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Weiter zur Avatar-Auswahl' }).click();
  await finishAvatar(page);
  await expect(second.locator('app-live-header .guest-label')).toBeHidden();
  expect(await identity(second)).toEqual({ uid: original.uid, isAnonymous: false });
  await second.goto('/#/chat');
  await leaveAccount(second);
  await expect(page).toHaveURL(/\/anmeldung$/);
  expect((await emulatorAccounts(request)).some((entry) => entry.localId === original.uid)).toBe(
    true,
  );
  await second.close();
});

test('Google provider error returns actionable feedback and preserves the guest', async ({
  page,
  context,
}) => {
  await enableEmulatorPopup(context);
  await startGuest(page);
  const original = await identity(page);
  await page.goto('/#/zugang/google');
  await page.route('**/accounts:signInWithIdp?*', (route) =>
    route.fulfill({ status: 400, json: { error: { message: 'OPERATION_NOT_ALLOWED' } } }),
  );
  await chooseGoogle(await openGoogle(page), `disabled-provider-${randomUUID()}@example.test`);
  await expect(page.getByRole('alert')).toContainText('noch nicht aktiviert');
  await expect(page.getByRole('button', { name: 'Google-Fenster öffnen' })).toBeEnabled();
  expect(await identity(page)).toEqual(original);
});

test('Google cancellation and blocked popup leave guest intact; guest can then link Google', async ({
  page,
  context,
}, info) => {
  await enableEmulatorPopup(context);
  await startGuest(page);
  const guest = await identity(page);
  await createChannel(page, 'Google upgrade ' + randomUUID());
  await send(page, 'Gastdaten bleiben mit Google');
  const roomUrl = page.url();
  await page.goto('/#/zugang/google');
  await (await openGoogle(page)).close();
  await expect(page.getByRole('alert')).toContainText('abgebrochen', { timeout: 15000 });
  expect(await identity(page)).toEqual(guest);
  await page.screenshot({ path: info.outputPath('google-canceled.png') });
  await page.evaluate(() => {
    window.open = () => null;
  });
  await page.getByRole('button', { name: 'Google-Fenster öffnen' }).click();
  await expect(page.getByRole('alert')).toContainText('blockiert');
  expect(await identity(page)).toEqual(guest);
  await page.reload();
  await chooseGoogle(await openGoogle(page), `guest-google-${randomUUID()}@example.test`);
  await finishAvatar(page);
  expect(await identity(page)).toEqual({ uid: guest.uid, isAnonymous: false });
  await page.goto(roomUrl);
  await expect(page.locator('.bubble')).toContainText('Gastdaten bleiben mit Google');
});
