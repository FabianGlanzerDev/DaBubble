import { randomUUID } from 'node:crypto';
import { deleteApp } from 'firebase-admin/app';
import { test, expect } from '../browser-fixture';
import {
  registerChatUser,
  secondUser,
  createChannel,
  selectInvitee,
  send,
  noOverflow,
} from './chat-helpers';
import { connectDeletion } from '../../scripts/account-deletion/environment.mts';
import { inventory } from '../../scripts/account-deletion/inventory.mts';
import { deleteAccount } from '../../scripts/account-deletion/worker.mts';
import { startGuest, editGuestProfile, identity } from './access-helpers';
import type { Page, TestInfo } from '@playwright/test';
import type { DeletionContext } from '../../scripts/account-deletion/environment.mts';

test.use({ emulatedFirebase: true });

for (const width of [1440, 320]) {
  for (const anonymous of [false, true]) {
    test.describe(`account deletion ${anonymous ? 'guest' : 'regular'} ${width}px`, () => {
      test.use({ viewport: { width, height: 900 }, hasTouch: width < 768 });
      test('remaining member reads channel replies and the private archive after confirmed operator deletion', async ({
        page,
        browser,
        baseURL,
      }, info) => {
        test.setTimeout(120000);
        page.setDefaultTimeout(15000);
        const suffix = randomUUID().slice(0, 7),
          alice = 'Alice ' + suffix,
          bob = 'Bob ' + suffix;
        const other = await secondUser(browser, baseURL!, width);
        other.page.setDefaultTimeout(15000);
        const admin = connectDeletion('demo-dabubble-auth', true);
        try {
          await registerChatUser(page, bob);
          if (anonymous) {
            await startGuest(other.page);
            await editGuestProfile(other.page, alice);
          } else await registerChatUser(other.page, alice);
          const uid = (await admin.db.collection('directory').where('name', '==', alice).get())
            .docs[0]!.id;
          await createChannel(other.page, 'Deletion ' + suffix);
          const channelURL = other.page.url();
          await other.page.getByRole('button', { name: /Mitglieder verwalten/ }).click();
          await other.page
            .getByRole('button', { name: 'Mitglieder hinzufügen', exact: true })
            .click();
          await selectInvitee(other.page, bob);
          await other.page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
          await expect(other.page.getByRole('status')).toContainText('Mitglieder hinzugefügt');
          await other.page.keyboard.press('Escape');
          await expect(other.page.getByRole('dialog')).toBeHidden();
          await expect(
            other.page.getByRole('button', { name: /Mitglieder verwalten/ }),
          ).toBeFocused();
          await send(other.page, 'Remove my channel content');
          await expect(other.page.locator('.bubble')).toContainText('Remove my channel content');
          await page.goto(channelURL);
          await page.getByRole('button', { name: 'Im Thread antworten', exact: true }).click();
          await send(page, 'Keep my channel answer', true);
          await page.getByRole('button', { name: 'Thread schließen' }).click();

          await other.page.goto('/#/chat/neue-nachricht');
          await other.page.getByLabel('Empfänger', { exact: true }).fill('@' + bob);
          await other.page
            .locator('.results')
            .getByRole('button', { name: bob, exact: true })
            .click();
          await send(other.page, 'Remove my private content');
          await expect(other.page.locator('.bubble')).toContainText('Remove my private content');
          const oldDirect = other.page.url();
          await page.goto(oldDirect);
          await page.getByRole('button', { name: 'Im Thread antworten', exact: true }).click();
          await send(page, 'Keep my private answer', true);
          await page.getByRole('button', { name: 'Thread schließen' }).click();
          await send(page, 'Keep my private message');
          if (anonymous) await reviewGuest(other.page, admin, uid, alice, oldDirect, width, info);
          await other.context.close();
          await page.goto('/#/chat');

          const plan = await inventory(admin, uid);
          expect(plan.summary.foreignMessagesPreserved).toBeGreaterThanOrEqual(3);
          await deleteAccount(admin, uid, { uid, fingerprint: plan.fingerprint });
          await page.reload();
          await page
            .locator('app-live-sidebar')
            .getByRole('link', { name: 'Direktgespräch · Konto gelöscht', exact: true })
            .click();
          await expect(page).toHaveURL(/\/direkt\/archive_/);
          await expect(page.getByRole('heading', { level: 1 })).toHaveText(
            'Direktgespräch · Konto gelöscht',
          );
          await expect(page.getByRole('note')).toContainText('nur lesbar');
          await expect(page.getByLabel('Nachricht schreiben', { exact: true })).toHaveCount(0);
          await expect(
            page.getByRole('button', { name: 'Nachricht bearbeiten', exact: true }),
          ).toHaveCount(0);
          await expect(page.locator('.main-panel')).not.toContainText('Remove my private content');
          await expect(page.locator('.main-panel')).toContainText('Keep my private message');
          await expect(page.locator('.main-panel')).toContainText('Gelöschtes Konto');
          const thread = page.getByRole('button', { name: '1 Antworten', exact: true });
          await thread.focus();
          await expect(thread).toBeFocused();
          if (width < 768) await thread.tap();
          else await page.keyboard.press('Enter');
          await expect(page.locator('.live-thread')).toContainText('Keep my private answer');
          await expect(page.getByLabel('Antwort schreiben', { exact: true })).toHaveCount(0);
          await noOverflow(page, info, 'deleted-account-archive-thread-' + width);
          await page.goBack();
          await expect(page.locator('.live-thread')).toHaveCount(0);
          await noOverflow(page, info, 'deleted-account-archive-' + width);
          await page.goto(channelURL);
          await expect(page.locator('.main-panel')).not.toContainText('Remove my channel content');
          await page.getByRole('button', { name: '1 Antworten', exact: true }).click();
          await expect(page.locator('.live-thread')).toContainText('Keep my channel answer');
          await send(page, 'Channel remains usable', true);
          await noOverflow(page, info, 'deleted-account-channel-' + width);
          await page.goto(oldDirect);
          await expect(
            page.getByRole('heading', { name: 'Gespräch nicht verfügbar' }),
          ).toBeVisible();
          expect(other.errors).toEqual([]);
        } finally {
          await other.context.close();
          await deleteApp(admin.app);
        }
      });
    });
  }
}

/** Verifies guest ownership by a profile challenge, confirms logout preserves data and checks a new guest cannot reopen it. */
async function reviewGuest(
  page: Page,
  admin: DeletionContext,
  uid: string,
  name: string,
  directUrl: string,
  width: number,
  info: TestInfo,
): Promise<void> {
  // The operator chooses a fresh case-specific value and checks the preselected UID directly.
  const challenge = 'Anfrage ' + randomUUID().replaceAll('-', '');
  await editGuestProfile(page, challenge);
  expect((await admin.db.doc('users/' + uid).get()).get('name')).toBe(challenge);
  expect((await admin.auth.getUser(uid)).email).toBeUndefined();
  await editGuestProfile(page, name); // Restore only after the operator has observed the change.
  await page.goto('/#/zugang/gast');
  await page.getByText('Gastkennung für Löschanfragen', { exact: true }).click();
  await expect(page.locator('[data-guest-uid]')).toHaveText(uid);
  await expect(page.locator('#guest-signout-warning')).toContainText('dauerhaft den Zugang');
  await expect(page.locator('#guest-signout-warning')).toContainText('Abmelden löscht keine Daten');
  await expect(page.locator('.access-card')).toContainText('kein Nachweis der Kontoinhaberschaft');
  const signout = page.getByRole('button', { name: 'Als Gast abmelden', exact: true });
  await expect(signout).toBeDisabled();
  await expect(signout).toHaveAttribute('aria-describedby', 'guest-signout-warning');
  await page.getByRole('link', { name: 'Zurück zum Chat', exact: true }).click();
  expect((await identity(page)).uid).toBe(uid); // Cancel keeps the session.
  await page.goto('/#/zugang/gast');
  const checkbox = page.getByRole('checkbox', { name: /verliere dauerhaft den Zugang/ });
  await expect(page.locator('[data-page-heading]')).toBeFocused();
  await expect(checkbox).toBeEnabled();
  await page.keyboard.press('Tab');
  await checkbox.focus();
  await expect(checkbox).toBeFocused();
  expect(await checkbox.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
  if (width < 768) await checkbox.tap();
  else await page.keyboard.press('Space');
  await expect(signout).toBeEnabled();
  await checkbox.uncheck();
  await expect(signout).toBeDisabled();
  await checkbox.check();
  await page.getByRole('link', { name: 'Mit Google dauerhaft nutzen' }).click();
  await expect(page).toHaveURL(/\/zugang\/google$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/zugang\/gast$/);
  await expect(checkbox).not.toBeChecked();
  await expect(signout).toBeDisabled();
  await checkbox.check();
  await noOverflow(page, info, 'guest-deletion-warning-' + width);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: info.outputPath('guest-deletion-warning-full-' + width + '.png'),
    fullPage: true,
  });
  let authDeletes = 0;
  page.on('request', (request) => {
    if (request.url().includes('accounts:delete')) authDeletes++;
  });
  await signout.focus();
  if (width < 768) await signout.tap();
  else await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/anmeldung$/);
  expect(authDeletes).toBe(0);
  const retained = await inventory(admin, uid);
  expect(retained.summary.accountExists).toBe(true);
  expect(retained.summary.profileExists).toBe(true);
  expect(retained.summary.directoryExists).toBe(true);
  expect(retained.summary.ownMessages).toBeGreaterThanOrEqual(2);
  await startGuest(page);
  expect((await identity(page)).uid).not.toBe(uid);
  await page.goto(directUrl);
  await expect(page.getByRole('heading', { name: 'Gespräch nicht verfügbar' })).toBeVisible();
}
