import { randomUUID } from 'node:crypto';
import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect } from '../browser-fixture';
import { identity, startGuest, finishAvatar } from './access-helpers';
import { createChannel, send, secondUser, noOverflow } from './chat-helpers';
import { emulatorConfig } from './emulator-config';

test.use({ emulatedFirebase: true, hasTouch: true });

async function account(page: Page, name: string) {
  const email = `switch-${randomUUID()}@example.test`,
    password = randomUUID();
  await page.goto('/#/registrierung');
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('E-Mail-Adresse', { exact: true }).fill(email);
  await page.getByLabel('Passwort', { exact: true }).fill(password);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Weiter zur Avatar-Auswahl' }).click();
  await finishAvatar(page);
  return { ...(await identity(page)), email, password, name };
}

async function submit(page: Page, email: string, password: string) {
  await page.getByLabel('E-Mail-Adresse', { exact: true }).fill(email);
  await page.getByLabel('Passwort', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
}

async function retainedData(request: APIRequestContext, uid: string, conversation: string) {
  const root =
    'http://127.0.0.1:8080/v1/projects/demo-dabubble-auth/databases/(default)/documents/';
  const headers = { Authorization: 'Bearer owner' };
  const profile = await request.get(root + 'users/' + uid, { headers });
  const room = await request.get(root + 'conversations/' + conversation, { headers });
  const messages = await request.get(root + 'conversations/' + conversation + '/messages', {
    headers,
  });
  expect([profile.status(), room.status(), messages.status()]).toEqual([200, 200, 200]);
  return {
    profile: (await profile.json()).fields,
    room: (await room.json()).fields,
    messages: (await messages.json()).documents,
  };
}

test('regular persisted session: restore, wrong credentials, same account and account switch preserve both chats', async ({
  page,
  context,
  browser,
  baseURL,
  request,
}, info) => {
  test.setTimeout(120000);
  const other = await secondUser(browser, baseURL!, 1440);
  try {
    const a = await account(page, 'Regulär A');
    await createChannel(page, 'Daten bleiben ' + randomUUID().slice(0, 8));
    await send(page, 'Unveränderte Nachricht von A');
    const conversation = page.url().split('/').at(-1)!;
    const before = await retainedData(request, a.uid, conversation);
    const b = await account(other.page, 'Regulär B');
    await createChannel(other.page, 'Konto B ' + randomUUID().slice(0, 8));
    await send(other.page, 'Unveränderte Nachricht von B');
    const roomB = other.page.url().split('/').at(-1)!;
    const dataB = await retainedData(request, b.uid, roomB);
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/firebase-config.json', async (route) => {
      await waiting;
      await route.fulfill({ json: emulatorConfig });
    });
    // A hash-only navigation keeps the running SDK; restoration requires a fresh document.
    await page.goto('about:blank');
    await page.goto('/#/anmeldung');
    await expect(page.getByText('Gespeicherte Anmeldung wird geprüft…')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeDisabled();
    await expect(page.getByLabel('E-Mail-Adresse', { exact: true })).toBeDisabled();
    release();
    const notice = page.getByRole('region', { name: 'Aktuelle Anmeldung' });
    await expect(notice).toHaveAttribute('data-session-kind', 'regular');
    await expect(notice).toHaveAttribute('data-session-uid', a.uid);
    await expect(notice).toContainText('Eine Sitzung ist noch aktiv.');
    await expect(notice).not.toContainText('Gastzugang');
    await page.reload();
    await expect(notice).toHaveAttribute('data-session-uid', a.uid);
    await submit(page, b.email, randomUUID());
    await expect(page.locator('#auth-password-error')).toContainText('nicht korrekt');
    expect(await identity(page)).toEqual({ uid: a.uid, isAnonymous: false });
    await submit(page, a.email, a.password);
    await expect(page).toHaveURL(/\/chat$/);
    expect((await identity(page)).uid).toBe(a.uid);
    const secondTab = await context.newPage();
    await secondTab.goto('/#/anmeldung');
    await page.goto('/#/anmeldung');
    await submit(page, b.email, b.password);
    await expect(page).toHaveURL(/\/chat$/);
    await expect(secondTab.locator('app-session-notice section')).toHaveAttribute(
      'data-session-uid',
      b.uid,
    );
    expect(await identity(page)).toEqual({ uid: b.uid, isAnonymous: false });
    expect(await retainedData(request, a.uid, conversation)).toEqual(before);
    await page.goto('/#/anmeldung');
    await expect(notice).toHaveAttribute('data-session-uid', b.uid);
    await noOverflow(page, info, 'regular-restored-login');
    await page.getByRole('heading', { name: 'Anmeldung', exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: info.outputPath('regular-restored-login.png'), fullPage: true });
    await page.getByRole('button', { name: 'Abmelden', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(notice).toHaveCount(0);
    await expect(page.getByLabel('E-Mail-Adresse', { exact: true })).toBeFocused();
    await expect(secondTab.locator('app-session-notice section')).toHaveCount(0);
    await submit(page, a.email, a.password);
    await expect(page).toHaveURL(/\/chat$/);
    await page.goto('/#/chat/channels/' + conversation);
    await expect(page.getByText('Unveränderte Nachricht von A', { exact: true })).toBeVisible();
    expect(await retainedData(request, a.uid, conversation)).toEqual(before);
    await secondTab.close();
    expect(await retainedData(request, b.uid, roomB)).toEqual(dataB);
  } finally {
    await other.context.close();
  }
});

for (const width of [375, 320]) {
  test(`guest ${width}px: consent, cancel, failed and successful switch retain guest data`, async ({
    page,
    browser,
    baseURL,
    request,
  }, info) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 932 });
    const other = await secondUser(browser, baseURL!, width);
    try {
      const regular = await account(other.page, 'Dauerhaftes Zielkonto');
      await startGuest(page);
      const guest = await identity(page);
      await createChannel(page, 'Gast bleibt ' + randomUUID().slice(0, 8));
      await send(page, 'Gastnachricht bleibt erhalten');
      const conversation = page.url().split('/').at(-1)!;
      const before = await retainedData(request, guest.uid, conversation);
      await page.goto('/#/anmeldung');
      await page.reload();
      const notice = page.getByRole('region', { name: 'Aktuelle Anmeldung' });
      await expect(notice).toHaveAttribute('data-session-kind', 'guest');
      await expect(notice).toHaveAttribute('data-session-uid', guest.uid);
      await submit(page, regular.email, regular.password);
      await expect(page.getByRole('alert')).toContainText('Bitte bestätige');
      expect(await identity(page)).toEqual(guest);
      await page.getByRole('link', { name: 'Mit diesem Konto zum Chat' }).click();
      await expect(page).toHaveURL(/\/chat$/);
      expect(await identity(page)).toEqual(guest);
      await page.goto('/#/anmeldung');
      await page
        .getByRole('checkbox', { name: /Ich möchte zu einem bestehenden Konto wechseln/ })
        .tap();
      await submit(page, regular.email, randomUUID());
      await expect(page.locator('#auth-password-error')).toContainText('nicht korrekt');
      expect(await identity(page)).toEqual(guest);
      await noOverflow(page, info, 'guest-account-switch-warning');
      await page.getByRole('heading', { name: 'Anmeldung', exact: true }).click();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: info.outputPath('guest-account-switch-warning.png'),
        fullPage: true,
      });
      await submit(page, regular.email, regular.password);
      await expect(page).toHaveURL(/\/chat$/);
      expect(await identity(page)).toEqual({ uid: regular.uid, isAnonymous: false });
      expect(await retainedData(request, guest.uid, conversation)).toEqual(before);
      await page.reload();
      await expect(page).toHaveURL(/\/chat$/);
      await page.goto('/#/anmeldung');
      await expect(notice).toHaveAttribute('data-session-kind', 'regular');
      await expect(page.getByRole('checkbox')).toHaveCount(0);
    } finally {
      await other.context.close();
    }
  });
}
