import { randomUUID } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../browser-fixture';
import { editGuestProfile, endGuest, identity, startGuest } from './access-helpers';
import {
  createChannel,
  noOverflow,
  registerChatUser,
  secondUser,
  selectInvitee,
  send,
} from './chat-helpers';

test.use({ emulatedFirebase: true });

/** Reveals message controls by touch or hover in the requested root or thread transcript. */
async function actions(page: Page, text: string, thread = false): Promise<Locator> {
  const container = thread ? '.live-thread' : '.main-panel';
  const article = page.locator(`${container} article`).filter({
    has: page.locator('.bubble').filter({ hasText: text }),
  });
  if (page.viewportSize()!.width < 768) {
    const trigger = article.getByRole('button', { name: 'Nachrichtenaktionen', exact: true });
    if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.tap();
  } else await article.hover();
  return article;
}

/** Keeps a stable message-ID locator while editing and asserts that the server-backed bubble updates. */
async function edit(page: Page, text: string, updated: string, thread = false): Promise<void> {
  const article = await actions(page, text, thread);
  const id = await article.getAttribute('data-message-id');
  const stable = page.locator(
    `${thread ? '.live-thread' : '.main-panel'} article[data-message-id="${id}"]`,
  );
  await article.getByRole('button', { name: 'Nachricht bearbeiten', exact: true }).click();
  await stable.getByRole('textbox', { name: 'Nachricht bearbeiten', exact: true }).fill(updated);
  await stable.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(stable.locator('.bubble')).toHaveText(updated);
}

/** Exercises both the message deletion action and its explicit confirmation in the emulator UI. */
async function remove(page: Page, text: string, thread = false): Promise<void> {
  const article = await actions(page, text, thread);
  await article.getByRole('button', { name: 'Nachricht löschen', exact: true }).click();
  await article.getByRole('button', { name: 'Löschen bestätigen' }).click();
}

for (const width of [1440, 320]) {
  test.describe(`live guest actions ${width}px`, () => {
    test.use({ viewport: { width, height: 932 }, hasTouch: width < 768 });
    test('guest edits and deletes own thread/DM content, retains other content and signs out without erasing data', async ({
      page,
      browser,
      baseURL,
    }, info) => {
      test.setTimeout(120000);
      const bob = 'Regular ' + randomUUID().slice(0, 8);
      const guestName = 'Guest ' + randomUUID().slice(0, 8);
      const other = await secondUser(browser, baseURL!, width);
      try {
        await registerChatUser(other.page, bob);
        await createChannel(other.page, 'Private ' + randomUUID());
        await send(other.page, 'Private regular content');
        const privateUrl = other.page.url();
        await startGuest(page);
        const original = await identity(page);
        await editGuestProfile(page, guestName);
        await page.reload();
        expect(await identity(page)).toEqual(original);
        await expect(
          page.getByRole('button', { name: `Profilmenü für ${guestName} öffnen` }),
        ).toBeVisible();
        await expect(page.locator('app-live-header app-avatar-image img')).toHaveAttribute(
          'src',
          /avatar-option-5.svg$/,
        );
        await page.goto(privateUrl);
        await expect(page.getByRole('heading', { name: 'Gespräch nicht verfügbar' })).toBeVisible();
        await expect(page.locator('.main-panel')).not.toContainText('Private regular content');
        await page.goto('/#/chat');
        await createChannel(page, 'Guest ' + randomUUID());
        const roomUrl = page.url();
        await page.getByRole('button', { name: /Mitglieder verwalten/ }).click();
        await page.getByRole('button', { name: 'Mitglieder hinzufügen', exact: true }).click();
        await selectInvitee(page, bob);
        await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
        await expect(page.getByRole('status')).toContainText('Mitglieder hinzugefügt');
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toBeHidden();
        await send(page, 'Guest root');
        const root = await actions(page, 'Guest root');
        await root.getByRole('button', { name: 'Mit ✅ reagieren', exact: true }).click();
        const reaction = root.locator('app-live-reactions .reactions button');
        await expect(reaction).toHaveText('✅ 1');
        await reaction.click();
        await expect(reaction).toHaveCount(0);
        await root.getByRole('button', { name: 'Im Thread antworten' }).click();
        await send(page, 'Guest reply', true);
        await edit(page, 'Guest reply', 'Guest reply edited', true);
        await other.page.goto(roomUrl);
        await other.page.getByRole('button', { name: '1 Antworten' }).click();
        await expect(other.page.locator('.live-thread')).toContainText('Guest reply edited');
        await send(other.page, 'Regular reply stays', true);
        const foreignReply = await actions(page, 'Regular reply stays', true);
        await expect(
          foreignReply.getByRole('button', { name: 'Nachricht bearbeiten', exact: true }),
        ).toHaveCount(0);
        await expect(
          foreignReply.getByRole('button', { name: 'Nachricht löschen', exact: true }),
        ).toHaveCount(0);
        await remove(page, 'Guest reply edited', true);
        await expect(other.page.locator('.live-thread')).not.toContainText('Guest reply edited');
        await expect(other.page.locator('.live-thread')).toContainText('Regular reply stays');
        await noOverflow(page, info, `guest-thread-${width}`);
        await page.goto('/#/chat/neue-nachricht');
        await page.getByLabel('Empfänger', { exact: true }).fill('@' + bob);
        await page.locator('.results').getByRole('button', { name: bob, exact: true }).click();
        await send(page, 'Guest direct');
        const directUrl = page.url();
        await edit(page, 'Guest direct', 'Guest direct edited');
        await other.page.goto(directUrl);
        await expect(other.page.locator('.bubble')).toContainText('Guest direct edited');
        await send(other.page, 'Regular direct stays');
        await remove(page, 'Guest direct edited');
        await expect(other.page.locator('.main-panel')).not.toContainText('Guest direct edited');
        await expect(other.page.locator('.main-panel')).toContainText('Regular direct stays');
        await noOverflow(page, info, `guest-direct-${width}`);
        await page.goto('/#/zugang/gast');
        await expect(page.getByRole('button', { name: 'Als Gast abmelden' })).toBeDisabled();
        await noOverflow(page, info, `guest-signout-${width}`);
        await page.screenshot({
          path: info.outputPath(`guest-signout-full-${width}.png`),
          fullPage: true,
        });
        await endGuest(page);
        await other.page.reload();
        await expect(other.page.locator('.main-panel')).toContainText('Regular direct stays');
        await other.page.goto(roomUrl);
        await expect(other.page.locator('.main-panel')).toContainText('Guest root');
        await other.page.getByRole('button', { name: '2 Antworten' }).click();
        await expect(other.page.locator('.live-thread')).toContainText('Regular reply stays');
        expect(other.errors).toEqual([]);
      } finally {
        await other.context.close();
      }
    });
  });
}
