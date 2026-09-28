import { test, expect } from '../browser-fixture';
import {
  createChannel,
  selectInvitee,
  noOverflow,
  registerChatUser,
  revealActions,
  secondUser,
  send,
} from './chat-helpers';

test.use({ emulatedFirebase: true });

for (const width of [1440, 320]) {
  test.describe(`checklist ${width}px`, () => {
    test.use({ viewport: { width, height: 932 }, hasTouch: width < 768 });

    test('empty channel feedback, accessible navigation and safe message editors', async ({
      page,
    }, info) => {
      await registerChatUser(page, 'Prüfung ' + Date.now());
      await page
        .locator('app-live-sidebar')
        .getByRole('button', { name: 'Channel erstellen', exact: true })
        .click();
      const name = page.getByLabel('Channel-Name', { exact: true });
      await name.fill('Test');
      await name.clear();
      await page.getByLabel('Beschreibung (optional)').focus();
      await expect(page.locator('#channel-error')).toContainText('Channel-Namen');
      await expect(name).toHaveAttribute('aria-invalid', 'true');
      await expect(page.locator('app-live-channel-dialog form')).toHaveAttribute('novalidate', '');
      await expect(page.getByRole('button', { name: 'Erstellen', exact: true })).toBeDisabled();
      await page.keyboard.press('Escape');
      const channel = 'Audit ' + Date.now();
      await createChannel(page, channel);
      await expect(
        page.locator('app-live-sidebar a.active').filter({ hasText: channel }),
      ).toHaveAttribute('aria-current', 'page');
      await send(page, 'Gleichzeitig im Channel und Thread bearbeiten');
      const message = await revealActions(page, 'Gleichzeitig im Channel und Thread bearbeiten');
      await message.getByRole('button', { name: 'Nachricht bearbeiten', exact: true }).click();
      await message.getByRole('button', { name: 'Im Thread antworten' }).click();
      const root = page.locator('.live-thread article').first();
      if (width < 768)
        await root.getByRole('button', { name: 'Nachrichtenaktionen', exact: true }).tap();
      else await root.hover();
      await root.getByRole('button', { name: 'Nachricht bearbeiten', exact: true }).click();
      const ids = await page
        .locator('textarea[id^=edit-]')
        .evaluateAll((fields) => fields.map((field) => field.id));
      expect(new Set(ids).size).toBe(ids.length);
      await expect(
        root.getByRole('textbox', { name: 'Nachricht bearbeiten', exact: true }),
      ).toBeVisible();
      await noOverflow(page, info, 'editors-' + width);
    });

    test('members invite multiple people, live search filters and channel conflicts show field feedback', async ({
      page,
      browser,
      baseURL,
    }, info) => {
      test.setTimeout(120000);
      const suffix = Date.now(),
        alice = 'Alice ' + suffix,
        bob = 'Bob ' + suffix,
        carol = 'Carol ' + suffix;
      const second = await secondUser(browser, baseURL!, width);
      const third = await secondUser(browser, baseURL!, width);
      try {
        await registerChatUser(second.page, bob);
        await registerChatUser(third.page, carol);
        await registerChatUser(page, alice);
        const channel = 'Gruppe ' + suffix;
        await createChannel(page, channel);
        const roomURL = page.url();
        await page.getByRole('button', { name: /Mitglieder verwalten/ }).click();
        await page.getByRole('button', { name: 'Mitglieder hinzufügen', exact: true }).click();
        await expect(page.locator('app-live-members-dialog .action-error')).toBeHidden();
        await selectInvitee(page, bob);
        await selectInvitee(page, carol);
        await page
          .getByRole('button', { name: 'Hinzufügen', exact: true })
          .scrollIntoViewIfNeeded();
        expect(
          await page
            .getByRole('dialog')
            .evaluate((dialog) => dialog.getBoundingClientRect().bottom),
        ).toBeLessThanOrEqual(932);
        await noOverflow(page, info, 'multiple-members-' + width);
        await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
        await expect(page.getByRole('status')).toContainText('Mitglieder hinzugefügt');
        await page.keyboard.press('Escape');
        await second.page.goto(roomURL);
        await third.page.goto(roomURL);
        await expect(
          second.page.getByRole('heading', { name: channel, exact: true }),
        ).toBeVisible();
        await expect(third.page.getByRole('heading', { name: channel, exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Gesprächsdetails' }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.locator('#channel-error')).toBeHidden();
        await noOverflow(page, info, 'channel-details-' + width);
        await page.getByRole('button', { name: 'Bearbeiten: Beschreibung', exact: true }).click();
        await expect(page.getByLabel('Beschreibung (optional)')).toBeFocused();
        await second.page.getByRole('button', { name: 'Gesprächsdetails' }).click();
        await second.page
          .getByRole('button', { name: 'Bearbeiten: Beschreibung', exact: true })
          .click();
        await second.page
          .getByLabel('Beschreibung (optional)')
          .fill('Beschreibung von einem Mitglied');
        await second.page
          .getByRole('button', { name: 'Speichern: Beschreibung', exact: true })
          .click();
        await expect(
          second.page.getByRole('button', { name: 'Bearbeiten: Beschreibung', exact: true }),
        ).toBeFocused();
        await expect(page.getByLabel('Beschreibung (optional)')).toHaveValue(
          'Beschreibung von einem Mitglied',
        );
        await page.getByLabel('Beschreibung (optional)').fill('Mein ungespeicherter Entwurf');
        await second.page
          .getByRole('button', { name: 'Bearbeiten: Beschreibung', exact: true })
          .click();
        await second.page.getByLabel('Beschreibung (optional)').fill('Zweites Update');
        await second.page
          .getByRole('button', { name: 'Speichern: Beschreibung', exact: true })
          .click();
        await expect(second.page.locator('.description')).toHaveText('Zweites Update');
        await expect(page.getByLabel('Beschreibung (optional)')).toHaveValue(
          'Mein ungespeicherter Entwurf',
        );
        await second.page.keyboard.press('Escape');
        await page.keyboard.press('Escape');
        await third.page.getByRole('button', { name: 'Gesprächsdetails' }).click();
        await third.page.getByRole('button', { name: 'Channel verlassen', exact: true }).click();
        await third.page.getByRole('button', { name: 'Austritt bestätigen' }).click();
        await expect(third.page).toHaveURL(/\/chat$/);
        await second.page.getByRole('button', { name: /Mitglieder verwalten/ }).click();
        await second.page
          .getByRole('button', { name: 'Mitglieder hinzufügen', exact: true })
          .click();
        await selectInvitee(second.page, carol);
        await second.page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
        await expect(second.page.getByRole('status')).toContainText('Mitglieder hinzugefügt');
        await second.page.keyboard.press('Escape');
        await page.goto('/#/chat');
        await expect(
          page.locator('app-live-sidebar').getByRole('link', { name: channel, exact: true }),
        ).toBeVisible();
        const search = page
          .getByLabel('Devspace durchsuchen', { exact: true })
          .filter({ visible: true });
        await search.fill('#Gruppe ' + suffix);
        await expect(page.locator('.results:visible').getByRole('link')).toHaveCount(1);
        await search.fill('@' + carol);
        await expect(page.locator('.results:visible').getByRole('button')).toHaveCount(1);
        await expect(page.locator('.results:visible')).toContainText(carol);
        await search.fill('Echtzeitfund');
        await expect(page.locator('.results:visible')).toContainText('Keine Treffer');
        await send(second.page, 'Echtzeitfund mit 😀');
        await expect(
          second.page.locator('.bubble').filter({ hasText: 'Echtzeitfund mit 😀' }),
        ).toBeVisible();
        await expect(page.locator('.results:visible')).toContainText('Echtzeitfund mit 😀');
        await expect(page.locator('.results:visible')).toContainText(channel);
        await page
          .locator('.results:visible')
          .getByRole('button', { name: /Echtzeitfund/ })
          .click();
        await expect(page.locator('.bubble')).toContainText('Echtzeitfund mit 😀');
        await noOverflow(page, info, 'search-result-' + width);
        await page.goto('/#/chat/neue-nachricht');
        const recipient = page.getByLabel('Empfänger', { exact: true });
        await recipient.fill('#');
        await expect(
          page.locator('.results').getByRole('link', { name: '# ' + channel, exact: true }),
        ).toBeVisible();
        await recipient.fill('@' + carol);
        await expect(page.locator('.results').getByRole('button')).toHaveCount(1);
        await page.locator('.results').getByRole('button', { name: carol, exact: true }).click();
        await expect(page.getByLabel('Nachricht schreiben', { exact: true })).toBeFocused();
        await page.goto('/#/chat');
        await createChannel(page, 'Belegt ' + suffix);
        await page.goto(roomURL);
        await page.getByRole('button', { name: 'Gesprächsdetails' }).click();
        await page.getByRole('button', { name: 'Bearbeiten: Channel-Name', exact: true }).click();
        await page.getByLabel('Channel-Name', { exact: true }).fill('Belegt ' + suffix);
        await page.getByRole('button', { name: 'Speichern: Channel-Name', exact: true }).click();
        await expect(page.locator('#channel-error')).toContainText('bereits vergeben');
        await noOverflow(page, info, 'duplicate-rename-' + width);
        expect(second.errors).toEqual([]);
        expect(third.errors).toEqual([]);
      } finally {
        await second.context.close();
        await third.context.close();
      }
    });
  });
}
