/**
 * Exercises protected multi-user conversations, editing, threads, reactions and mobile recovery using local test accounts.
 *
 * @packageDocumentation
 */

import { test, expect } from '../browser-fixture';
import { startGuest, editGuestProfile } from './access-helpers';
import {
  createChannel,
  selectInvitee,
  noOverflow,
  registerChatUser,
  revealActions,
  secondUser,
  send,
} from './chat-helpers';

test.use({ emulatedFirebase: true, hasTouch: true });

for (const [width, guest] of [
  [1440, false],
  [375, false],
  [1440, true],
  [320, true],
] as const) {
  test.describe(`${width}px ${guest ? 'guest' : 'regular'} client`, () => {
    test.use({ hasTouch: width < 768 });
    test(`${width}px: two clients exchange channels, messages, threads, reactions and private messages`, async ({
      page,
      browser,
      baseURL,
    }, info) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width, height: 932 });
      const suffix = Date.now().toString().slice(-7),
        alice = 'Alice ' + suffix,
        bob = 'Bob ' + suffix;
      const team = 'Team ' + suffix;
      const second = await secondUser(browser, baseURL!, width);
      try {
        await registerChatUser(second.page, bob);
        if (guest) {
          await startGuest(page);
          await editGuestProfile(page, alice);
        } else await registerChatUser(page, alice);
        await noOverflow(page, info, 'menu-' + width);
        await createChannel(page, team);
        await expect(page.getByLabel('Nachricht schreiben', { exact: true })).toBeFocused();
        const roomURL = page.url();
        await second.page.goto(roomURL);
        await expect(
          second.page.getByRole('heading', { name: 'Gespräch nicht verfügbar' }),
        ).toBeVisible();
        await page.getByRole('button', { name: /Mitglieder verwalten/ }).click();
        await page.getByRole('button', { name: 'Mitglieder hinzufügen', exact: true }).click();
        await selectInvitee(page, bob);
        await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
        await expect(page.getByRole('status')).toContainText('Mitglieder hinzugefügt');
        await noOverflow(page, info, 'members-' + width);
        await page.keyboard.press('Escape');
        await expect(second.page.getByRole('heading', { name: team, exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: /Mitglieder verwalten/ })).toBeFocused();
        const field = page.getByLabel('Nachricht schreiben', { exact: true });
        await field.fill('Hallo Team');
        await field.locator('..').evaluate((form: HTMLFormElement) => {
          form.requestSubmit();
          form.requestSubmit();
        });
        await expect(second.page.locator('.bubble').filter({ hasText: 'Hallo Team' })).toHaveCount(
          1,
        );
        await expect(field).toHaveValue('');
        await send(second.page, 'Hallo Alice');
        await expect(page.locator('.bubble').filter({ hasText: 'Hallo Alice' })).toBeVisible();
        const own = await revealActions(page, 'Hallo Team');
        await own.getByRole('button', { name: 'Nachricht bearbeiten', exact: true }).click();
        await own
          .getByRole('textbox', { name: 'Nachricht bearbeiten', exact: true })
          .fill('Hallo Team aktualisiert');
        await own.getByRole('button', { name: 'Speichern', exact: true }).click();
        await expect(
          second.page.locator('.bubble').filter({ hasText: 'Hallo Team aktualisiert' }),
        ).toBeVisible();
        const received = await revealActions(second.page, 'Hallo Team aktualisiert');
        await expect(
          received.getByRole('button', { name: 'Nachricht bearbeiten', exact: true }),
        ).toHaveCount(0);
        await received.getByRole('button', { name: 'Mit ✅ reagieren', exact: true }).click();
        await expect(own.locator('app-live-reactions')).toContainText('✅ 1');
        await own.locator('app-live-reactions .reactions button').click();
        await expect(received.locator('app-live-reactions')).toContainText('✅ 2');
        await own.getByRole('button', { name: 'Im Thread antworten', exact: true }).click();
        await send(page, 'Antwort im Thread', true);
        await noOverflow(page, info, 'thread-' + width);
        await received.getByRole('button', { name: '1 Antworten', exact: true }).click();
        await expect(
          second.page.locator('.live-thread .bubble').filter({ hasText: 'Antwort im Thread' }),
        ).toBeVisible();
        await send(second.page, 'Zweite Antwort', true);
        await expect(
          page.locator('.live-thread .bubble').filter({ hasText: 'Zweite Antwort' }),
        ).toBeVisible();
        await page.goBack();
        await expect(page.locator('.live-thread')).toHaveCount(0);
        await second.page.getByRole('button', { name: 'Thread schließen' }).click();
        await noOverflow(page, info, 'conversation-' + width);
        await page.getByRole('button', { name: 'Gesprächsdetails' }).click();
        await page.getByRole('button', { name: 'Bearbeiten: Channel-Name', exact: true }).click();
        await page.getByLabel('Channel-Name', { exact: true }).fill(team + ' Neu');
        await page.getByRole('button', { name: 'Speichern: Channel-Name', exact: true }).click();
        await expect(
          second.page.getByRole('heading', { name: team + ' Neu', exact: true }),
        ).toBeVisible();
        await page.reload();
        await expect(
          page.locator('.bubble').filter({ hasText: 'Hallo Team aktualisiert' }),
        ).toBeVisible();
        await expect(page.locator('app-live-reactions')).toContainText(['✅ 2', '']);
        const deletion = await revealActions(page, 'Hallo Team aktualisiert');
        await deletion.getByRole('button', { name: 'Nachricht löschen', exact: true }).click();
        await deletion.getByRole('button', { name: 'Löschen bestätigen' }).click();
        await expect(second.page.getByText('Nachricht gelöscht', { exact: true })).toBeVisible();
        await page.goto('/#/chat/neue-nachricht');
        await page.getByLabel('Empfänger', { exact: true }).fill('@' + bob);
        await page.locator('.results').getByRole('button', { name: bob, exact: true }).click();
        await expect(page).toHaveURL(/\/chat\/direkt\/dm_/);
        await send(page, 'Private Nachricht');
        const directURL = page.url();
        await page.getByRole('button', { name: 'Gesprächsdetails' }).click();
        await page
          .getByRole('dialog')
          .getByRole('button', { name: 'Nachricht', exact: true })
          .click();
        await expect(page.getByRole('dialog')).toBeHidden();
        await second.page.goto('/#/chat');
        await second.page
          .locator('app-live-sidebar')
          .getByRole('link', { name: alice, exact: true })
          .click();
        await expect(second.page.locator('.bubble')).toContainText('Private Nachricht');
        await second.page.getByRole('button', { name: 'Im Thread antworten' }).click();
        await send(second.page, 'Private Thread-Antwort', true);
        await page.getByRole('button', { name: '1 Antworten' }).click();
        await expect(page.locator('.live-thread')).toContainText('Private Thread-Antwort');
        await page.getByRole('button', { name: 'Thread schließen' }).click();
        await noOverflow(page, info, 'direct-' + width);
        await page.goto('/#/chat');
        const search = page
          .getByLabel('Devspace durchsuchen', { exact: true })
          .filter({ visible: true });
        await search.fill('Private Thread-Antwort');
        await page
          .locator('.results:visible')
          .getByRole('button', { name: /Private Thread-Antwort/ })
          .click();
        await expect(page.locator('.live-thread')).toContainText('Private Thread-Antwort');
        await expect(page).toHaveURL(
          new RegExp(directURL.split('?')[0]!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\?'),
        );
        await page.goto(roomURL);
        await page.getByRole('button', { name: 'Gesprächsdetails' }).click();
        await page.getByRole('button', { name: 'Channel verlassen', exact: true }).click();
        await page.getByRole('button', { name: 'Austritt bestätigen' }).click();
        await expect(page).toHaveURL(/\/chat$/);
        await page.goto(roomURL);
        await expect(page.getByRole('heading', { name: 'Gespräch nicht verfügbar' })).toBeVisible();
        expect(second.errors).toEqual([]);
      } finally {
        await second.context.close();
      }
    });
  });
}

test.describe('mobile recovery', () => {
  test.use({ expectedOffline: true });
  test('320px touch, keyboard, dialogs, back navigation, emoji insertion, duplicate names and offline drafts', async ({
    page,
    context,
  }, info) => {
    await page.setViewportSize({ width: 320, height: 720 });
    const name = 'Mobil ' + Date.now();
    await registerChatUser(page, name);
    await createChannel(page, name);
    const room = page.url();
    await page.getByLabel('Nachricht schreiben', { exact: true }).fill('Text ');
    await page.getByRole('button', { name: 'Emoji einfügen' }).tap();
    await noOverflow(page, info, 'emoji-320');
    await page.getByRole('button', { name: 'Emoji ✅', exact: true }).tap();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByLabel('Nachricht schreiben', { exact: true })).toHaveValue('Text ✅');
    await page.getByLabel('Nachricht schreiben', { exact: true }).press('Enter');
    await page.getByRole('button', { name: 'Im Thread antworten' }).tap();
    await send(page, 'Mobilantwort', true);
    await noOverflow(page, info, 'thread-320');
    await page.goBack();
    await expect(page).toHaveURL(room);
    await page.getByRole('button', { name: 'Gesprächsdetails' }).tap();
    await noOverflow(page, info, 'channel-320');
    await page.goBack();
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.getByRole('link', { name: 'Zurück zum Menü' }).tap();
    await page
      .locator('app-live-sidebar')
      .getByRole('button', { name: 'Channel erstellen', exact: true })
      .tap();
    await page.getByLabel('Channel-Name', { exact: true }).fill(name);
    await page.getByRole('button', { name: 'Erstellen', exact: true }).tap();
    await expect(page.getByRole('alert').filter({ hasText: 'bereits vergeben' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.locator('app-live-sidebar').getByRole('link', { name, exact: true }).tap();
    await context.setOffline(true);
    await page.getByLabel('Nachricht schreiben', { exact: true }).fill('Offline Entwurf');
    await page.getByLabel('Nachricht schreiben', { exact: true }).press('Enter');
    await expect(page.locator('app-live-composer [role=alert]')).toContainText('offline');
    await expect(page.getByLabel('Nachricht schreiben', { exact: true })).toHaveValue(
      'Offline Entwurf',
    );
    await context.setOffline(false);
    await page.getByLabel('Nachricht schreiben', { exact: true }).press('Enter');
    await expect(page.getByLabel('Nachricht schreiben', { exact: true })).toHaveValue('');
    await noOverflow(page, info, 'conversation-320');
  });
});
