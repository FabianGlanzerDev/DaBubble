import { test, expect } from './browser-fixture';

test('buttons, icons, links and fields expose reference hover and focus states', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/vorschau/channels/entwicklerteam');
  const contact = page.getByRole('link', { name: 'Sofia Müller', exact: true });
  await contact.hover();
  await expect(contact).toHaveCSS('background-color', 'rgb(236, 238, 254)');
  await expect(contact).toHaveCSS('color', 'rgb(68, 77, 242)');
  const plus = page.getByRole('button', { name: 'Channel erstellen', exact: true });
  await plus.hover();
  await expect(plus).toHaveCSS('background-color', 'rgb(236, 238, 254)');
  await plus.click();
  const name = page.getByLabel('Channel-Name', { exact: true });
  await name.hover();
  await expect(name).toHaveCSS('border-top-color', 'rgb(121, 126, 243)');
  await name.focus();
  await expect(name).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.locator('.profile').click();
  const profile = page.getByRole('button', { name: 'Profil', exact: true });
  await profile.hover();
  await expect(profile).toHaveCSS('color', 'rgb(83, 90, 241)');
  await page.screenshot({ path: info.outputPath('settings-hover.png') });
  await profile.click();
  await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
  const cancel = page.getByRole('button', { name: 'Abbrechen', exact: true });
  await cancel.hover();
  await expect(cancel).toHaveCSS('background-color', 'rgb(83, 90, 241)');
  await expect(cancel).toHaveCSS('color', 'rgb(255, 255, 255)');
  await page.screenshot({ path: info.outputPath('secondary-hover.png') });
});

test('mobile channel, member, edit and emoji dialogs stay within 320px', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/vorschau/channels/entwicklerteam');
  await page.getByRole('button', { name: 'Channel-Details öffnen' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('320-channel.png') });
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Channel-Details öffnen' }).click();
  await dialog.getByRole('button', { name: 'Mitgliederübersicht öffnen' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('320-members.png') });
  await dialog.getByRole('button', { name: 'Mitgliederübersicht öffnen' }).click();
  await expect(dialog).toHaveAccessibleName('Mitglieder');
  await dialog.getByRole('button', { name: 'Mitglieder hinzufügen' }).click();
  await page.getByLabel('Beispielmitglieder suchen').fill('Steffen');
  await dialog.getByRole('button', { name: 'Steffen Hoffmann', exact: true }).click();
  await expect.poll(() => dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('320-member-chip.png') });
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  const composer = page.locator('app-conversation app-message-composer');
  await composer.getByRole('textbox').fill('@So');
  await composer.getByRole('button', { name: '@Sofia Müller', exact: true }).click();
  await expect(composer.getByRole('textbox')).toHaveValue('@Sofia Müller ');
  await composer.getByRole('button', { name: 'Emoji in Entwurf einfügen' }).click();
  await expect.poll(() => dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('320-emoji.png') });
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
