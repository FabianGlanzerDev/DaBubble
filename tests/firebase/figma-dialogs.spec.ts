import { test, expect } from '../browser-fixture';
import { mkdir } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { createChannel, registerChatUser, secondUser, selectInvitee } from './chat-helpers';

test.use({ emulatedFirebase: true, hasTouch: true });
const output = 'tmp/figma-finish/screenshots';

/** Waits for fonts, checks page and dialog overflow, and records stable rendered Figma-comparison screenshots. */
async function capture(page: Page, name: string): Promise<void> {
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(page.viewportSize()!.width);
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible()) {
    await expect.poll(() => dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await dialog.screenshot({ path: `${output}/${name}-dialog.png`, animations: 'disabled' });
  }
  await page.screenshot({ path: `${output}/${name}.png`, animations: 'disabled' });
}

test('Figma: real profile, member picker and channel dialogs at desktop and mobile reference sizes', async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(120000);
  await mkdir(output, { recursive: true });
  const second = await secondUser(browser, baseURL!, 430);
  const person = 'Steffen ' + Date.now().toString().slice(-4);
  try {
    await registerChatUser(second.page, person);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await registerChatUser(page, 'Frederik Beck');
    await createChannel(page, 'Entwicklerteam ' + Date.now().toString().slice(-5));
    const channelURL = page.url();
    for (const width of [1920, 430, 375, 320]) {
      await page.setViewportSize({ width, height: width === 1920 ? 1080 : 932 });
      await page.goto(channelURL);
      await page.getByRole('button', { name: 'Gesprächsdetails' }).click();
      await expect(page.getByRole('dialog')).toHaveAccessibleName(/Entwicklerteam/);
      if (width < 768)
        await expect(page.locator('.mobile-members app-live-member-list')).toBeVisible();
      await capture(page, `channel-${width}`);
      await page.getByRole('button', { name: 'Bearbeiten: Channel-Name', exact: true }).click();
      await expect(page.getByLabel('Channel-Name', { exact: true })).toBeFocused();
      await capture(page, `channel-edit-${width}`);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: /^Mitglieder verwalten/ }).click();
      await capture(page, `members-${width}`);
      const add = page.getByRole('button', { name: 'Mitglieder hinzufügen', exact: true });
      await add.hover();
      await expect(add).toHaveCSS('background-color', 'rgb(236, 238, 254)');
      await page.keyboard.press('Tab');
      await add.focus();
      await expect(add).toHaveCSS('outline-style', 'solid');
      await page.keyboard.press('Enter');
      await expect(page.getByRole('button', { name: 'Hinzufügen', exact: true })).toBeDisabled();
      await capture(page, `invite-empty-${width}`);
      const query = page.getByRole('textbox', { name: 'Leute hinzufügen', exact: true });
      await query.fill(person);
      await capture(page, `invite-search-${width}`);
      await page
        .getByRole('list', { name: 'Passende Personen' })
        .getByRole('button', { name: person })
        .focus();
      await page.keyboard.press('Enter');
      await expect(query).toBeFocused();
      await expect(page.getByRole('button', { name: 'Hinzufügen', exact: true })).toBeEnabled();
      await capture(page, `invite-selected-${width}`);
      await page.getByRole('button', { name: person + ' aus Auswahl entfernen' }).tap();
      await expect(page.getByRole('button', { name: 'Hinzufügen', exact: true })).toBeDisabled();
      if (width < 768) {
        await page.goBack();
        await expect(page.getByRole('dialog')).toBeHidden();
      } else await page.keyboard.press('Escape');
      await page.getByRole('button', { name: /^Profilmenü für/ }).click();
      await page.getByRole('button', { name: 'Profil', exact: true }).click();
      await capture(page, `own-profile-${width}`);
      await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
      await capture(page, `profile-edit-${width}`);
      await page.getByRole('button', { name: 'Avatar ändern' }).hover();
      await expect(page.getByRole('button', { name: 'Avatar ändern' })).toHaveCSS(
        'outline-color',
        'rgb(236, 238, 254)',
      );
      await page.screenshot({
        path: `${output}/profile-edit-hover-${width}.png`,
        animations: 'disabled',
      });
      await page.keyboard.press('Escape');
    }
    await page.getByRole('button', { name: /^Mitglieder verwalten/ }).tap();
    await page.getByRole('button', { name: 'Mitglieder hinzufügen', exact: true }).tap();
    await selectInvitee(page, person);
    await page.getByRole('button', { name: 'Hinzufügen', exact: true }).tap();
    await expect(page.getByRole('status')).toContainText('Mitglieder hinzugefügt');
    await page.keyboard.press('Escape');
    for (const width of [1920, 430, 375, 320]) {
      await page.setViewportSize({ width, height: width === 1920 ? 1080 : 932 });
      await page.getByRole('button', { name: 'Gesprächsdetails' }).click();
      await capture(page, `channel-members-${width}`);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: /^Mitglieder verwalten/ }).click();
      await capture(page, `members-saved-${width}`);
      await page.getByRole('dialog').getByRole('button', { name: person, exact: true }).tap();
      await expect(page.getByRole('dialog')).toContainText('Online');
      await expect(page.getByRole('dialog')).toContainText('Nicht freigegeben');
      await capture(page, `foreign-profile-${width}`);
      if (width === 320) {
        await page
          .getByRole('dialog')
          .getByRole('button', { name: 'Nachricht', exact: true })
          .tap();
        await expect(page).toHaveURL(/\/chat\/direkt\//);
        await expect(page.getByRole('dialog')).toBeHidden();
        await expect(page.getByRole('heading', { name: person, exact: true })).toBeVisible();
      } else await page.keyboard.press('Escape');
    }
    await expect(second.page.locator('app-live-sidebar')).toContainText('Entwicklerteam');
    expect(second.errors).toEqual([]);
  } finally {
    await second.context.close();
  }
});
