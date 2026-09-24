import { test, expect } from './browser-fixture';
import type { Page, TestInfo } from '@playwright/test';

async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
}

async function dismiss(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
}

test('channel dialogs: local drafts, duplicate feedback, member selection, keyboard and backdrop', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/vorschau/channels/entwicklerteam');
  const create = page.getByRole('button', { name: 'Channel erstellen', exact: true });
  await create.click();
  let dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAccessibleName('Channel erstellen');
  await expect(dialog.getByRole('button', { name: 'Weiter zur Mitgliederauswahl' })).toBeDisabled();
  await capture(page, info, '37-channel-create');
  await dialog.getByLabel('Channel-Name', { exact: true }).fill('Entwicklerteam');
  await dialog.getByLabel('Beschreibung').focus();
  await expect(dialog.locator('#channel-name-error')).toContainText('bereits');
  await dialog.getByLabel('Channel-Name', { exact: true }).fill('Designentwurf');
  await dialog.getByRole('button', { name: 'Weiter zur Mitgliederauswahl' }).click();
  await expect(dialog).toHaveAccessibleName('Leute hinzufügen');
  await capture(page, info, '38-channel-people');
  await dialog.getByLabel('Bestimmte Leute hinzufügen').check();
  await dialog.getByLabel('Beispielmitglieder suchen').fill('Sofia');
  await dialog.getByRole('button', { name: 'Sofia Müller', exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: 'Sofia Müller aus Auswahl entfernen' }),
  ).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Erstellen', exact: true })).toBeDisabled();
  await capture(page, info, '38-selected-member');
  await dismiss(page);
  await expect(create).toBeFocused();
  await expect(page.getByRole('link', { name: 'Designentwurf', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Channel-Details öffnen' }).click();
  await capture(page, info, 'channel-details');
  await dialog.getByRole('button', { name: /Bearbeiten.*Channel-Name/ }).click();
  await dialog.getByRole('button', { name: /Bearbeiten.*Beschreibung/ }).click();
  await dialog.getByLabel('Channel-Name', { exact: true }).fill('Nur ein Entwurf');
  await expect(dialog.getByRole('button', { name: 'Speichern', exact: true })).toHaveCount(2);
  await expect(
    dialog.getByRole('button', { name: 'Speichern', exact: true }).first(),
  ).toBeDisabled();
  await capture(page, info, 'channel-edit');
  await page.mouse.click(5, 5);
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Entwicklerteam');
});

test('profiles, member list, settings and avatar drafts preserve sample data', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/vorschau/channels/entwicklerteam');
  await page.locator('.profile').click();
  await capture(page, info, '64-profile-menu');
  await expect(page.getByRole('button', { name: 'Log out' })).toBeDisabled();
  await page.getByRole('button', { name: 'Profil', exact: true }).click();
  await capture(page, info, 'profile-own');
  await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
  await capture(page, info, '65-profile-edit');
  await page.getByLabel('Vollständiger Name').fill('');
  await expect(page.locator('#profile-error')).toHaveText('Bitte gib einen Namen ein.');
  await page.getByRole('button', { name: 'Avatar ändern' }).click();
  await page.getByRole('button', { name: 'Avatar 6', exact: true }).click();
  await capture(page, info, 'profile-avatar-edit');
  await expect(page.getByRole('button', { name: 'Speichern', exact: true })).toBeDisabled();
  await dismiss(page);
  await page.getByRole('button', { name: '3 Beispielmitglieder ansehen' }).click();
  await capture(page, info, '43-members');
  await page.getByRole('dialog').getByRole('button', { name: 'Mitglieder hinzufügen' }).click();
  await capture(page, info, '41-add-members');
  await page.getByLabel('Beispielmitglieder suchen').fill('Elise');
  await page.getByRole('button', { name: 'Elise Roth', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Hinzufügen', exact: true })).toBeDisabled();
  await capture(page, info, '41-add-members-selection');
  await dismiss(page);
  for (const [id, name] of [
    ['sofia-mueller', 'Sofia Müller'],
    ['noah-braun', 'Noah Braun'],
    ['elise-roth', 'Elise Roth'],
    ['elias-neumann', 'Elias Neumann'],
    ['steffen-hoffmann', 'Steffen Hoffmann'],
    ['frederik-beck', 'Frederik Beck'],
  ]) {
    await page.goto(`/vorschau/direkt/${id}`);
    await capture(page, info, `12-direct-${id}`);
    await page.locator('.title-button').click();
    await expect(
      page.getByRole('dialog').getByRole('heading', { name, exact: true }),
    ).toBeVisible();
    await capture(page, info, `65-profile-${id}`);
    if (id !== 'frederik-beck') {
      await page.getByRole('dialog').getByRole('link', { name: 'Nachricht', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeHidden();
      await expect(page).toHaveURL(new RegExp(`/direkt/${id}$`));
    } else await dismiss(page);
  }
});

test('message hover, edit layouts, reaction details, local emoji and mention drafts', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/vorschau/channels/entwicklerteam');
  const own = page.locator('app-conversation .message.own');
  await own.hover();
  await expect(own.locator('.message-actions')).toHaveCSS('opacity', '1');
  await capture(page, info, 'message-hover');
  await own.getByRole('button', { name: 'Weitere Nachrichtenaktionen' }).click();
  await capture(page, info, '76-message-options');
  await page.keyboard.press('Escape');
  await expect(own.locator('.message-options')).toBeHidden();
  await own.getByRole('button', { name: 'Weitere Nachrichtenaktionen' }).click();
  await page.locator('.date-divider').first().click();
  await expect(own.locator('.message-options')).toBeHidden();
  await own.hover();
  await own.getByRole('button', { name: 'Weitere Nachrichtenaktionen' }).click();
  await own.getByRole('button', { name: 'Nachricht bearbeiten' }).click();
  const edit = own.getByRole('textbox', { name: 'Beispielnachricht bearbeiten' });
  await edit.fill('Lokaler Bearbeitungsentwurf');
  await expect(own.getByRole('button', { name: 'Speichern' })).toBeDisabled();
  await capture(page, info, '13-edit-all');
  await page.getByRole('button', { name: 'Menü einklappen' }).click();
  await capture(page, info, '14-edit-menu-hidden');
  await page.getByRole('button', { name: 'Thread ausblenden' }).click();
  await capture(page, info, '16-edit-both-hidden');
  await page.getByRole('button', { name: 'Menü ausklappen' }).click();
  await capture(page, info, '15-edit-thread-hidden');
  await own.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(own.locator('.bubble')).toContainText('Lorem ipsum');
  await own.locator('.reaction').first().hover();
  await expect(own.getByRole('tooltip').first()).toBeVisible();
  await capture(page, info, 'reaction-hover');
  await own.locator('.reaction').first().click();
  await expect(page.getByRole('dialog').locator('.reaction')).toHaveCount(7);
  await capture(page, info, 'reactions-collapsed');
  await page.getByRole('button', { name: '3 weitere' }).click();
  await expect(page.getByRole('dialog').locator('.reaction')).toHaveCount(10);
  await capture(page, info, 'reactions-expanded');
  await page.getByRole('button', { name: 'Weniger anzeigen' }).click();
  await dismiss(page);
  const composer = page.locator('app-conversation app-message-composer');
  await composer.getByRole('textbox').fill('Ein Entwurf');
  await composer.getByRole('button', { name: 'Emoji in Entwurf einfügen' }).click();
  await capture(page, info, 'emoji-picker');
  await page.getByRole('button', { name: 'Lachen', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(composer.getByRole('textbox')).toHaveValue('Ein Entwurf 😀 ');
  await composer.getByRole('button', { name: 'Erwähnung in Entwurf einfügen' }).click();
  await capture(page, info, 'mention-picker');
  await composer.getByRole('button', { name: '@Sofia Müller', exact: true }).click();
  await expect(composer.getByRole('textbox')).toHaveValue('Ein Entwurf 😀 @Sofia Müller ');
  await expect(composer.getByRole('textbox')).toBeFocused();
  await page.reload();
  await expect(page.locator('app-conversation textarea')).toHaveValue('');
});

test('search, new-message navigation, form feedback and enabled button hover', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/vorschau/neue-nachricht');
  await capture(page, info, '11-new-message');
  const recipient = page.getByRole('searchbox', { name: 'Empfänger aus Designbeispielen wählen' });
  await recipient.fill('sofia.muel@beispiel.com');
  await capture(page, info, 'recipient-search');
  await recipient.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/direkt\/sofia-mueller$/);
  const search = page.getByRole('searchbox', { name: 'Devspace-Beispiele durchsuchen' });
  await search.fill('Angular');
  await capture(page, info, 'message-search');
  await page.locator('.results:visible a').click();
  await expect(page).toHaveURL(/channels\/entwicklerteam$/);
  await search.fill('#Office');
  await page.locator('.results:visible a').click();
  await capture(page, info, '10-office');
  await expect(page.locator('.thread-panel')).toBeHidden();
  await page.goto('/registrierung');
  await page.getByLabel('E-Mail-Adresse', { exact: true }).fill('falsch');
  await page.getByLabel('Passwort', { exact: true }).fill('kurz');
  await page.getByLabel('Name', { exact: true }).fill('Design Test');
  await expect(page.getByText('Bitte gib eine gültige E-Mail-Adresse ein.')).toBeVisible();
  await expect(page.getByText('Das Passwort muss mindestens 6 Zeichen lang sein.')).toBeVisible();
  await capture(page, info, 'register-errors');
  await page.getByLabel('E-Mail-Adresse', { exact: true }).fill('test@example.com');
  await page.getByLabel('Passwort', { exact: true }).fill('beispielpasswort');
  await page.getByRole('checkbox').check();
  const next = page.getByRole('button', { name: 'Weiter zur Avatar-Vorschau' });
  await expect(next).toBeEnabled();
  await next.hover();
  await expect(next).toHaveCSS('background-color', 'rgb(121, 126, 243)');
  await capture(page, info, 'register-enabled-hover');
  await next.click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Design Test');
  await expect(page.getByRole('button', { name: 'Weiter', exact: true })).toBeDisabled();
  await page.goto('/passwort-reset/neues-passwort');
  await page.getByLabel('Neues Passwort', { exact: true }).fill('beispielpasswort');
  await page.getByLabel('Neues Kennwort bestätigen').fill('anderes');
  await page.getByRole('heading', { level: 1 }).click();
  await expect(page.getByText('Die Passwörter stimmen nicht überein.')).toBeVisible();
  await capture(page, info, 'password-mismatch');
  await expect(page.getByRole('button', { name: 'Passwort ändern' })).toBeDisabled();
});

test('dialog keyboard focus stays inside, closes on Escape and returns to trigger at 320px', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/vorschau');
  await page.getByRole('button', { name: 'Channel erstellen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dialog schließen' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  const focusInside = await page.evaluate(() => !!document.activeElement?.closest('dialog'));
  expect(focusInside).toBe(true);
  await capture(page, info, '320-channel-create');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await dismiss(page);
  await expect(page.getByRole('button', { name: 'Channel erstellen', exact: true })).toBeFocused();
  await page.locator('.profile').click();
  await page.getByRole('button', { name: 'Profil', exact: true }).click();
  await capture(page, info, '320-profile');
  const dialog = page.getByRole('dialog');
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await dismiss(page);
});
