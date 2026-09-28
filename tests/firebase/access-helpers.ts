import { expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';

interface EmulatorAccount {
  localId: string;
  providerUserInfo?: { providerId: string }[];
  passwordHash?: string;
}

export async function emulatorAccounts(request: APIRequestContext): Promise<EmulatorAccount[]> {
  const accounts: EmulatorAccount[] = [];
  let nextPageToken = '';
  do {
    const response = await request.get(
      'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-dabubble-auth/accounts:batchGet',
      { headers: { Authorization: 'Bearer owner' }, params: { maxResults: 1000, nextPageToken } },
    );
    expect(response.status()).toBe(200);
    const data = (await response.json()) as { users?: EmulatorAccount[]; nextPageToken?: string };
    accounts.push(...(data.users ?? []));
    nextPageToken = data.nextPageToken ?? '';
  } while (nextPageToken);
  return accounts;
}

/** Only the emulator's popup helper scripts may use the network, never cloud Auth/Firestore. */
export async function enableEmulatorPopup(context: BrowserContext): Promise<void> {
  await context.route('https://apis.google.com/**', (route) => route.continue());
  await context.route('https://unpkg.com/material-components-web@10/**', (route) =>
    route.fulfill({
      body: '',
      contentType:
        route.request().resourceType() === 'script' ? 'application/javascript' : 'text/css',
    }),
  );
  await context.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
}

export async function openGoogle(page: Page): Promise<Page> {
  await page.getByRole('checkbox').check();
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Google-Fenster öffnen' }).click();
  const window = await popup;
  await expect(window).toHaveURL(/^http:\/\/127\.0\.0\.1:9099\/emulator\/auth\/handler/);
  return window;
}

export async function chooseGoogle(
  popup: Page,
  email: string,
  name = 'Google Test',
): Promise<void> {
  const saved = popup.locator('.js-reuse-account').filter({ hasText: email });
  if (await saved.count()) await saved.click();
  else {
    await popup.getByRole('button', { name: 'Add new account' }).click();
    await popup.locator('#email-input').fill(email);
    await popup.locator('#display-name-input').fill(name);
    await popup.locator('#sign-in').click();
  }
}

export async function identity(page: Page): Promise<{ uid: string; isAnonymous: boolean }> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('firebaseLocalStorageDb');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Auth persistence unavailable'));
    });
    try {
      return await new Promise<{ uid: string; isAnonymous: boolean }>((resolve, reject) => {
        const request = database
          .transaction('firebaseLocalStorage')
          .objectStore('firebaseLocalStorage')
          .getAll();
        request.onsuccess = () => {
          const value = request.result.find((entry: { fbase_key: string }) =>
            entry.fbase_key.startsWith('firebase:authUser:'),
          )?.value;
          if (!value) reject(new Error('No persisted account'));
          else resolve({ uid: value.uid, isAnonymous: value.isAnonymous });
        };
        request.onerror = () => reject(new Error('Cannot read auth identity'));
      });
    } finally {
      database.close();
    }
  });
}

export async function finishAvatar(page: Page, name = 'Google Test'): Promise<void> {
  await expect(page).toHaveURL(/\/avatar-auswahl$/);
  const field = page.getByLabel('Name', { exact: true });
  if (await field.count()) await field.fill(name);
  await page.getByRole('button', { name: 'Avatar 2', exact: true }).click();
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await expect(page).toHaveURL(/\/chat$/);
}

export async function leaveAccount(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Profilmenü für/ }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page).toHaveURL(/\/anmeldung$/);
}

export async function startGuest(page: Page): Promise<void> {
  await page.goto('/#/anmeldung');
  await page.getByRole('button', { name: 'Gäste-Login' }).click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.locator('app-live-header .guest-label')).toHaveText('Gast');
  await expect(page.locator('.chat-error')).toBeHidden();
  await expect(page.getByText('Gespräche werden geladen…', { exact: true })).toBeHidden();
}

export async function endGuest(page: Page): Promise<void> {
  await page.goto('/#/zugang/gast');
  await expect(page.getByRole('button', { name: 'Als Gast abmelden' })).toBeDisabled();
  await page.getByRole('checkbox', { name: /ohne Kontoumwandlung abmelden/ }).check();
  await page.getByRole('button', { name: 'Als Gast abmelden' }).click();
  await expect(page).toHaveURL(/\/anmeldung$/);
}

export async function editGuestProfile(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: /^Profilmenü für/ }).click();
  await page.getByRole('button', { name: 'Profil', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Keine E-Mail-Adresse (Gastkonto)');
  await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
  await page.getByLabel('Vollständiger Name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Avatar ändern' }).click();
  await page.getByRole('button', { name: 'Avatar 5', exact: true }).click();
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { level: 3 })).toHaveText(name);
  await page.getByRole('button', { name: 'Dialog schließen' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}
