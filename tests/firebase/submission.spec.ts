import { test, expect } from '../browser-fixture';
import type { Page, TestInfo } from '@playwright/test';
import { identity, startGuest } from './access-helpers';
import { noOverflow } from './chat-helpers';

test.use({ emulatedFirebase: true });

async function authScreens(page: Page, info: TestInfo): Promise<void> {
  for (const route of [
    'registrierung',
    'passwort-reset',
    'passwort-reset/neues-passwort',
    'zugang/google',
  ]) {
    await page.goto('/#/' + route);
    await expect(page.locator('[data-page-heading]')).toBeVisible();
    await expect(page.locator('app-auth-note')).toHaveCount(0);
    await expect(page.getByText(/Hinweise & Vorschau|Lokaler Firebase-Emulator/)).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Vorschau|Ansicht ansehen/ })).toHaveCount(0);
    await noOverflow(page, info, route.replaceAll('/', '-'));
  }
}

for (const width of [1920, 430, 375, 320]) {
  test.describe(`submission presentation ${width}`, () => {
    test.use({ viewport: { width, height: width === 1920 ? 1080 : 932 }, hasTouch: width < 768 });

    test('real login has no preview and guest logout warns before access is lost', async ({
      page,
    }, info) => {
      await authScreens(page, info);
      await page.goto('/#/anmeldung');
      await expect(page.getByRole('button', { name: 'Gäste-Login' })).toBeEnabled();
      await expect(page.getByRole('link', { name: /Vorschau/ })).toHaveCount(0);
      await expect(page.locator('app-auth-note')).toHaveCount(0);
      await noOverflow(page, info, 'login');
      await startGuest(page);
      const before = await identity(page);
      await expect(page.locator('.guest-banner')).toHaveCount(0);
      await page.getByRole('button', { name: /^Profilmenü für/ }).click();
      await expect(page.getByRole('dialog')).not.toContainText('Zugang verwalten');
      const logout = page.getByRole('link', { name: 'Log out', exact: true });
      await logout.focus();
      await expect(logout).toBeFocused();
      await noOverflow(page, info, 'guest-settings');
      await page.keyboard.press('Enter');
      await expect(page.getByRole('heading', { name: 'Als Gast abmelden?' })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Als Gast abmelden', exact: true }),
      ).toBeDisabled();
      await expect(page.locator('#guest-signout-warning')).toContainText(
        'Abmelden löscht keine Daten',
      );
      await noOverflow(page, info, 'guest-signout');
      await page.reload();
      expect(await identity(page)).toEqual(before);
      await page.getByRole('link', { name: 'Zurück zum Chat', exact: true }).click();
      await expect(page).toHaveURL(/\/chat$/);
      expect(await identity(page)).toEqual(before);
      await expect(page.locator('app-live-header .guest-label')).toHaveText('Gast');
    });
  });
}
