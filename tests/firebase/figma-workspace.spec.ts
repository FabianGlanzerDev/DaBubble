import { randomUUID } from 'node:crypto';
import { test, expect } from '../browser-fixture';
import { createChannel, noOverflow, registerChatUser, secondUser, send } from './chat-helpers';
import { startGuest } from './access-helpers';

test.use({ emulatedFirebase: true });

for (const width of [1920, 430, 375, 320]) {
  test.describe(`Figma live workspace ${width}`, () => {
    test.use({ viewport: { width, height: width === 1920 ? 1080 : 932 }, hasTouch: width < 768 });

    test('direct conversation shows the real avatar and accurate empty states', async ({
      page,
      browser,
      baseURL,
    }, info) => {
      const other = await secondUser(browser, baseURL!, width);
      const name = 'Sofia ' + randomUUID().slice(0, 6);
      const ownName = 'Frederik ' + randomUUID().slice(0, 6);
      try {
        await registerChatUser(other.page, name);
        await registerChatUser(page, ownName);
        await page.goto('/#/chat/neue-nachricht');
        await page.getByLabel('Empfänger', { exact: true }).fill('@' + name);
        await page.locator('.results').getByRole('button', { name, exact: true }).click();
        await expect(page).toHaveURL(/\/chat\/direkt\//);
        await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
        await noOverflow(page, info, 'direct-empty');
        const title = page.locator('app-live-conversation .title-button');
        await expect(title.locator('app-avatar-image img')).toHaveAttribute(
          'src',
          /avatar-option-6.svg$/,
        );
        await expect(page.locator('.empty-conversation')).toContainText(
          'Diese Unterhaltung findet nur zwischen',
        );
        await expect(page.getByLabel('Nachricht schreiben', { exact: true })).toBeFocused();
        await page.keyboard.press('Tab');
        await title.focus();
        await expect(title).toHaveCSS('outline-style', 'solid');
        await page.keyboard.press('Enter');
        await expect(page.getByRole('dialog')).toContainText(name);
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toBeHidden();
        await send(page, 'Echte Nachricht nach dem Leerzustand');
        await expect(page.locator('.empty-conversation')).toBeHidden();
        await page.goto('/#/chat/neue-nachricht');
        await page.getByLabel('Empfänger', { exact: true }).fill('@' + ownName);
        await page.locator('.results').getByRole('button', { name: ownName, exact: true }).click();
        await expect(page.locator('.empty-conversation')).toContainText(
          'Dieser Raum ist nur für dich da',
        );
        await noOverflow(page, info, 'self-empty');
        await page.goto('/#/chat');
        await createChannel(page, 'Figma ' + randomUUID().slice(0, 8));
        await expect(page.locator('.empty-conversation')).toContainText(
          'Das ist der Anfang des Channels',
        );
        await noOverflow(page, info, 'channel-empty');
        expect(other.errors).toEqual([]);
      } finally {
        await other.context.close();
      }
    });

    if (width < 768)
      test('mobile live search is a separate view with back navigation and keyboard results', async ({
        page,
      }, info) => {
        if (width === 320) await startGuest(page);
        else await registerChatUser(page, 'Figma Suche ' + randomUUID().slice(0, 6));
        const channel = 'Suche ' + randomUUID().slice(0, 8);
        await createChannel(page, channel);
        await page.goto('/#/chat');
        const field = page.locator('#mobile-live-search');
        await field.tap();
        await field.fill('#');
        await expect(page.locator('.results:visible a').first()).toBeVisible();
        await noOverflow(page, info, 'channel-search');
        await expect(page).toHaveURL(/view=search/);
        await expect(page.locator('app-live-sidebar')).toBeHidden();
        const compose = page.locator('.mobile-compose');
        await expect(compose).toBeInViewport();
        if (width === 320) {
          const bounds = await compose.boundingBox();
          expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(932);
        }
        await field.press('ArrowDown');
        await expect(page.locator('.results:visible a').first()).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(page.locator('app-live-sidebar')).toBeVisible();
        await expect(field).toBeFocused();
        await field.fill('@');
        await noOverflow(page, info, 'people-search');
        await page.goBack();
        await expect(page.locator('app-live-sidebar')).toBeVisible();
        await page.goForward();
        await expect(page.getByRole('button', { name: 'Suche schließen' })).toBeVisible();
        await page.reload();
        await expect(page.getByRole('button', { name: 'Suche schließen' })).toBeVisible();
        await page.getByRole('button', { name: 'Suche schließen' }).tap();
        await expect(page.locator('app-live-sidebar')).toBeVisible();
        await field.fill('#' + channel);
        await page.locator('.results:visible a').tap();
        await expect(page.getByRole('heading', { name: channel, exact: true })).toBeVisible();
        await expect(page.getByLabel('Nachricht schreiben', { exact: true })).toBeFocused();
      });
  });
}
