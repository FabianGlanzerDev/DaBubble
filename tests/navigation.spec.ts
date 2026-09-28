import { test, expect } from './browser-fixture';

test('intro, account navigation and unavailable forms', async ({ page }) => {
  await page.goto('/#/');
  await expect(page).toHaveURL(/\/intro$/);
  await expect(page).toHaveURL(/\/anmeldung$/, { timeout: 7000 });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Anmeldung');
  await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Anmelden mit Google' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Gäste-Login' })).toBeDisabled();
  await page.getByRole('link', { name: 'Konto erstellen', exact: true }).click();
  await expect(page).toHaveURL(/\/registrierung$/);
  await expect(page.getByLabel('Name', { exact: true })).toBeEnabled();
  await page.getByRole('link', { name: 'Zur Anmeldung', exact: true }).click();
  await page.getByRole('link', { name: 'Passwort vergessen?' }).click();
  await expect(page).toHaveURL(/\/passwort-reset$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Passwort zurücksetzen');
  await expect(page.getByRole('button', { name: 'E-Mail senden' })).toBeDisabled();
});

test('avatar preview navigation and selection do not register or persist an account', async ({
  page,
}) => {
  await page.goto('/#/registrierung');
  await expect(page.locator('app-auth-note')).toHaveCount(0);
  await page.goto('/#/avatar-vorschau');
  await expect(page).toHaveURL(/\/avatar-vorschau$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Wähle deinen Avatar');
  await expect(page.getByRole('button', { name: 'Weiter', exact: true })).toBeDisabled();
  const thirdAvatar = page.getByRole('button', { name: 'Avatar 3', exact: true });
  await thirdAvatar.focus();
  await page.keyboard.press('Space');
  await expect(thirdAvatar).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Avatar 1', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.reload();
  await expect(thirdAvatar).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('link', { name: 'Zur Registrierung' }).click();
  await expect(page).toHaveURL(/\/registrierung$/);
  await page.goto('/#/chat');
  await expect(page).toHaveURL(/\/anmeldung\?/);
});

test('protected deep links fail closed, preview creates no login', async ({ page }) => {
  await page.goto('/#/chat/channels/entwicklerteam');
  await expect(page).toHaveURL(/\/anmeldung\?returnUrl=/);
  await expect(page.getByRole('status')).toContainText('Chat-Ansicht ist geschützt');
  expect(new URL(new URL(page.url()).hash.slice(1), page.url()).searchParams.get('returnUrl')).toBe(
    '/chat/channels/entwicklerteam',
  );
  await expect(page.locator('app-auth-note')).toHaveCount(0);
  await page.goto('/#/vorschau');
  await expect(page).toHaveURL(/\/vorschau$/);
  await page.goto('/#/chat');
  await expect(page).toHaveURL(/\/anmeldung\?/);
});

test('desktop menu, active routes, history, direct links and thread region', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/vorschau');
  const menu = page.getByRole('navigation', { name: 'Arbeitsbereich', exact: true });
  const channels = page.getByRole('button', { name: 'Channels', exact: true });
  await channels.click();
  await expect(channels).toHaveAttribute('aria-expanded', 'false');
  await expect(menu.getByRole('link', { name: 'Entwicklerteam', exact: true })).toBeHidden();
  await channels.click();
  await menu.getByRole('link', { name: 'Entwicklerteam', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Entwicklerteam');
  await expect(menu.getByRole('link', { name: 'Entwicklerteam', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await menu.getByRole('link', { name: 'Sofia Müller', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sofia Müller');
  await menu.getByRole('link', { name: 'Noah Braun', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Noah Braun');
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sofia Müller');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sofia Müller');
  await page.getByRole('button', { name: 'Menü einklappen' }).click();
  await expect(menu).toBeHidden();
  await page.getByRole('button', { name: 'Menü ausklappen' }).click();
  await expect(menu).toBeVisible();
  await expect(
    page.getByRole('complementary', { name: 'Vorgesehener Thread-Bereich' }),
  ).toBeHidden();
  await expect(page.getByLabel('Nachrichtenentwurf', { exact: true })).toBeEnabled();
});

test('keyboard controls expose focus and expand state', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/vorschau/channels/entwicklerteam');
  await expect(
    page.getByRole('textbox', { name: 'Nachrichtenentwurf', exact: true }),
  ).toBeFocused();
  const toggle = page.getByRole('button', { name: 'Menü einklappen' });
  await toggle.focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Menü ausklappen' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Menü einklappen' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  const channels = page.getByRole('button', { name: 'Channels', exact: true });
  await expect(channels).toBeVisible();
  await channels.focus();
  await page.keyboard.press('Space');
  await expect(channels).toHaveAttribute('aria-expanded', 'false');
  expect(await channels.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe(
    'solid',
  );
  await page.keyboard.press('Enter');
  await expect(channels).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('link', { name: 'Entwicklerteam', exact: true })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Channel erstellen', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Entwicklerteam', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/vorschau\/channels\/entwicklerteam$/);
});

test('unknown routes and unknown conversations are explained', async ({ page }) => {
  await page.goto('/#/unbekannt');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Seite nicht gefunden');
  await page.goto('/#/vorschau/channels/unbekannt');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Eintrag nicht gefunden');
});

test('skip link focuses the visible main area without changing route', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  for (const path of ['/anmeldung', '/vorschau', '/vorschau/channels/entwicklerteam']) {
    await page.goto('/#' + path);
    if (path === '/anmeldung')
      await expect(page.getByRole('heading', { name: 'Anmeldung', exact: true })).toBeVisible();
    await expect(page.locator('[data-page-heading]:visible').first()).toBeVisible();
    await page.getByRole('link', { name: 'Zum Hauptinhalt' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
    expect(new URL(page.url()).hash).toBe('#' + path);
  }
});
