import { test, expect, installAppRoutes } from '../browser-fixture';
import {
  registerChatUser,
  createChannel,
  selectInvitee,
  send,
  revealActions,
} from '../firebase/chat-helpers';
import { startGuest, identity } from '../firebase/access-helpers';
import type { Page, TestInfo } from '@playwright/test';

test.use({ emulatedFirebase: true, staticHosting: true, hasTouch: true });

async function directAndReload(page: Page, url: string, text: string) {
  await page.goto('about:blank');
  expect((await page.goto(url))?.status()).toBe(200);
  await expect(page.getByText(text, { exact: true })).toBeVisible();
  expect((await page.reload())?.status()).toBe(200);
  await expect(page.getByText(text, { exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
  expect(new URL(page.url()).hash).toMatch(/^#\/chat\/(channels|direkt)\//);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function screenshot(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(name + '.png'), fullPage: true });
}

for (const width of [1440, 375, 320]) {
  test(`static host ${width}px: real channel/DM/thread deep links, guest session and membership`, async ({
    page,
    browser,
    baseURL,
  }, info) => {
    await page.setViewportSize({ width, height: 932 });
    const other = await browser.newContext({
      baseURL,
      viewport: { width, height: 932 },
      hasTouch: true,
      permissions: ['local-network-access'],
    });
    const errors: string[] = [];
    await installAppRoutes(other, true, baseURL, errors, false, true);
    const b = await other.newPage();
    b.on('pageerror', (error) => errors.push(error.message));
    const name = 'Routing ' + Date.now();
    try {
      await registerChatUser(page, name);
      await startGuest(b);
      const guest = await identity(b);
      await createChannel(b, 'Privat ' + Date.now());
      const privateUrl = b.url();
      await page.goto(privateUrl);
      await expect(page.getByRole('heading', { name: 'Gespräch nicht verfügbar' })).toBeVisible();
      await page.goto('/#/chat');
      await createChannel(page, name);
      const channel = page.url();
      await b.goto(channel);
      await expect(b.getByRole('heading', { name: 'Gespräch nicht verfügbar' })).toBeVisible();
      // The regular user joins the guest's channel only through an explicit invitation.
      await b.goto(privateUrl);
      await b.getByRole('button', { name: /Mitglieder verwalten/ }).click();
      await b.getByRole('button', { name: 'Mitglieder hinzufügen', exact: true }).click();
      await selectInvitee(b, name);
      await b.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
      await expect(b.getByRole('status')).toContainText('Mitglieder hinzugefügt');
      await b.keyboard.press('Escape');
      await expect(b.getByRole('dialog')).toBeHidden();
      await page.goto(privateUrl);
      await expect(page.getByRole('heading', { name: /^Privat / })).toBeVisible();
      await send(b, 'Direkt geladener Gastchannel');
      await expect(b.getByText('Direkt geladener Gastchannel', { exact: true })).toBeVisible();
      await directAndReload(page, privateUrl, 'Direkt geladener Gastchannel');
      await directAndReload(b, privateUrl, 'Direkt geladener Gastchannel');
      expect(await identity(b)).toEqual(guest);
      const article = await revealActions(page, 'Direkt geladener Gastchannel');
      await article.getByRole('button', { name: 'Im Thread antworten' }).click();
      await send(page, 'Thread über Hash-Link', true);
      const thread = page.url();
      await directAndReload(page, thread, 'Thread über Hash-Link');
      await screenshot(page, info, 'channel-thread-' + width);
      await page.getByRole('button', { name: 'Thread schließen' }).click();
      await expect(page).not.toHaveURL(/thread=/);
      await page.goto('/#/chat/neue-nachricht');
      await page.getByLabel('Empfänger', { exact: true }).fill('@' + name);
      await page.locator('.results').getByRole('button', { name, exact: true }).click();
      await send(page, 'Private eigene Direktnachricht');
      const dm = page.url();
      await directAndReload(page, dm, 'Private eigene Direktnachricht');
      await b.goto(dm);
      await expect(b.getByRole('heading', { name: 'Gespräch nicht verfügbar' })).toBeVisible();
      const dmArticle = await revealActions(page, 'Private eigene Direktnachricht');
      await dmArticle.getByRole('button', { name: 'Im Thread antworten' }).click();
      await send(page, 'DM-Thread per Direktlink', true);
      const dmThread = page.url();
      await directAndReload(page, dmThread, 'DM-Thread per Direktlink');
      await screenshot(page, info, 'dm-thread-' + width);
      await page.goto('/#/chat');
      await page.goto(privateUrl);
      await page.goBack();
      await expect(page).toHaveURL(/#\/chat$/);
      await page.goForward();
      await expect(page).toHaveURL(privateUrl);
      await page.getByRole('button', { name: 'Gesprächsdetails' }).tap();
      await expect(page.getByRole('dialog')).toBeVisible();
      if (width < 768) await page.goBack();
      else await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toBeHidden();
      expect(errors).toEqual([]);
    } finally {
      await other.close();
    }
  });
}
