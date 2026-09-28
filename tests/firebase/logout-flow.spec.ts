import { randomUUID } from 'node:crypto';
import type { APIRequestContext, Page } from '@playwright/test';
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
import { createChannel, send, secondUser } from './chat-helpers';

test.use({ emulatedFirebase: true, hasTouch: true });

async function register(page: Page, name: string) {
  const email = `logout-${randomUUID()}@example.test`,
    password = randomUUID();
  await page.goto('/#/registrierung');
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('E-Mail-Adresse', { exact: true }).fill(email);
  await page.getByLabel('Passwort', { exact: true }).fill(password);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Weiter zur Avatar-Auswahl' }).click();
  await finishAvatar(page);
  return { email, password };
}

async function login(page: Page, email: string, password: string) {
  await page.getByLabel('E-Mail-Adresse', { exact: true }).fill(email);
  await page.getByLabel('Passwort', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page).toHaveURL(/\/chat$/);
}

async function storedUid(page: Page): Promise<string | null> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('firebaseLocalStorageDb');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<string | null>((resolve, reject) => {
        const request = db
          .transaction('firebaseLocalStorage')
          .objectStore('firebaseLocalStorage')
          .getAll();
        request.onsuccess = () =>
          resolve(
            request.result.find((entry: { fbase_key: string }) =>
              entry.fbase_key.startsWith('firebase:authUser:'),
            )?.value?.uid ?? null,
          );
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  });
}

async function dataSnapshot(request: APIRequestContext, uid: string, room: string) {
  const root =
    'http://127.0.0.1:8080/v1/projects/demo-dabubble-auth/databases/(default)/documents/';
  const result: Record<string, unknown> = {};
  for (const path of [
    `users/${uid}`,
    `directory/${uid}`,
    `conversations/${room}`,
    `conversations/${room}/messages`,
  ]) {
    const response = await request.get(root + path, { headers: { Authorization: 'Bearer owner' } });
    expect(response.status()).toBe(200);
    result[path] = await response.json();
  }
  return result;
}

async function normalLogin(page: Page) {
  await expect(page).toHaveURL(/\/anmeldung$/);
  await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeEnabled();
  await expect(page.getByRole('region', { name: 'Aktuelle Anmeldung' })).toHaveCount(0);
  await expect(page.getByText(/Angemeldet als/)).toHaveCount(0);
  await expect(page.getByLabel('E-Mail-Adresse', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Passwort', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('E-Mail-Adresse', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'false',
  );
  await expect(page.getByLabel('Passwort', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'false',
  );
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect.poll(() => storedUid(page)).toBeNull();
}

function withoutDirectorySyncTime(snapshot: Record<string, unknown>, uid: string) {
  const result = structuredClone(snapshot);
  const directory = result[`directory/${uid}`] as {
    updateTime?: string;
    fields: Record<string, unknown>;
  };
  // Entering the chat republishes the directory; account and chat content must stay intact.
  delete directory.updateTime;
  delete directory.fields['updatedAt'];
  return result;
}

for (const width of [1440, 320]) {
  for (const provider of ['password', 'google', 'guest'] as const) {
    test(`logout ${provider} ${width}px: real signout, clean form, reload, tabs and retained data`, async ({
      page,
      context,
      browser,
      baseURL,
      request,
    }, info) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width, height: 932 });
      await enableEmulatorPopup(context);
      const other = await secondUser(browser, baseURL!, width);
      try {
        const b = await register(other.page, 'Anderes Konto');
        const bUid = (await identity(other.page)).uid;
        let credentials = { email: `google-${randomUUID()}@example.test`, password: '' };
        if (provider === 'password') credentials = await register(page, 'Passwortkonto');
        if (provider === 'guest') await startGuest(page);
        if (provider === 'google') {
          await page.goto('/#/anmeldung');
          await page.getByRole('button', { name: 'Anmelden mit Google' }).click();
          await chooseGoogle(await openGoogle(page), credentials.email);
          await finishAvatar(page);
        }
        const a = await identity(page);
        await createChannel(page, `Logout ${randomUUID().slice(0, 8)}`);
        await send(page, 'Diese Nachricht bleibt nach Abmelden erhalten.');
        const roomUrl = page.url(),
          room = roomUrl.split('/').at(-1)!;
        const before = await dataSnapshot(request, a.uid, room);
        const tab = await context.newPage();
        await tab.goto('/#/anmeldung');
        await expect(tab.locator('[data-session-uid]')).toHaveAttribute('data-session-uid', a.uid);
        await tab.getByLabel('E-Mail-Adresse', { exact: true }).fill('ungueltig');
        await tab.getByLabel('Passwort', { exact: true }).fill('Nicht-speichern');
        await tab.getByRole('button', { name: 'Anmelden', exact: true }).click();
        if (provider === 'guest') await endGuest(page);
        else await leaveAccount(page);
        await normalLogin(page);
        await normalLogin(tab);
        await page.reload();
        await normalLogin(page);
        await page.goBack();
        await expect(page.getByRole('button', { name: /^Profilmenü für/ })).toHaveCount(0);
        await page.goto('/#/anmeldung');
        await normalLogin(page);
        await page.screenshot({
          path: info.outputPath(`logged-out-${provider}-${width}.png`),
          fullPage: true,
        });
        expect(await dataSnapshot(request, a.uid, room)).toEqual(before);
        expect((await emulatorAccounts(request)).some((u) => u.localId === a.uid)).toBe(true);
        if (provider === 'password') await login(page, credentials.email, credentials.password);
        if (provider === 'google') {
          await page.getByRole('button', { name: 'Anmelden mit Google' }).click();
          await chooseGoogle(await openGoogle(page), credentials.email);
          await expect(page).toHaveURL(/\/chat$/);
        }
        if (provider !== 'guest') {
          expect((await identity(page)).uid).toBe(a.uid);
          await page.goto(roomUrl);
          await expect(
            page.getByText('Diese Nachricht bleibt nach Abmelden erhalten.', { exact: true }),
          ).toBeVisible();
          await leaveAccount(page);
        } else {
          await startGuest(page);
          expect((await identity(page)).uid).not.toBe(a.uid);
          await endGuest(page);
        }
        await login(page, b.email, b.password);
        expect((await identity(page)).uid).toBe(bUid);
        await expect.poll(() => storedUid(tab)).toBe(bUid);
        expect(withoutDirectorySyncTime(await dataSnapshot(request, a.uid, room), a.uid)).toEqual(
          withoutDirectorySyncTime(before, a.uid),
        );
        await leaveAccount(page);
        await normalLogin(page);
        await normalLogin(tab);
        await tab.close();
      } finally {
        await other.context.close();
      }
    });
  }
}
