import { randomUUID } from 'node:crypto';
import { test, expect } from '../browser-fixture';
import { identity, leaveAccount } from './access-helpers';
import { registerChatUser } from './chat-helpers';

test.use({ emulatedFirebase: true });

test('logout cancels a login response already in flight in another tab', async ({
  page,
  context,
  request,
}, info) => {
  const email = `late-login-${randomUUID()}@example.test`,
    password = randomUUID();
  const created = await request.post(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-emulator-key',
    { data: { email, password, returnSecureToken: true } },
  );
  expect(created.status()).toBe(200);
  await registerChatUser(page, 'Logout race');
  const before = await identity(page);
  const second = await context.newPage();
  await second.goto('/#/anmeldung');
  await expect(second).toHaveURL(/\/anmeldung$/);
  await expect(second.locator('[data-session-uid]')).toHaveAttribute(
    'data-session-uid',
    before.uid,
  );
  let release!: () => void, received!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  const arrived = new Promise<void>((resolve) => (received = resolve));
  await second.route('**/accounts:signInWithPassword?*', async (route) => {
    const response = await route.fetch();
    received();
    await held;
    await route.fulfill({ response });
  });
  await second.getByLabel('E-Mail-Adresse', { exact: true }).fill(email);
  await second.getByLabel('Passwort', { exact: true }).fill(password);
  await second.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await arrived;
  await leaveAccount(page);
  await expect(page.locator('[data-session-uid]')).toHaveCount(0);
  release();
  await expect(second.getByRole('button', { name: 'Anmelden', exact: true })).toBeEnabled();
  await expect(second.getByRole('alert')).toContainText('diesen Anmeldeversuch beendet');
  await expect(page.locator('[data-session-uid]')).toHaveCount(0);
  await expect(second.locator('[data-session-uid]')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeEnabled();
  await expect(page.locator('[data-session-uid]')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('signed-out.png'), fullPage: true });
  await second.getByLabel('E-Mail-Adresse', { exact: true }).fill(email);
  await second.getByLabel('Passwort', { exact: true }).fill(password);
  await second.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(second).toHaveURL(/\/chat$/);
  await expect(page.locator('[data-session-uid]')).toHaveAttribute(
    'data-session-uid',
    (await identity(second)).uid,
  );
  await second.close();
});
