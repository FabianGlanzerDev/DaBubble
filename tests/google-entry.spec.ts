/**
 * Checks Google entry and explicit linking consent in the public UI without opening a real provider session.
 *
 * @packageDocumentation
 */

import { readFile } from 'node:fs/promises';
import { test, expect } from './browser-fixture';

for (const width of [1440, 320]) {
  test.describe(`Google entry in Cloud build ${width}px`, () => {
    test.use({ viewport: { width, height: 932 }, hasTouch: width < 768 });

    test('Google is enabled, requests explicit confirmation and protects account linking', async ({
      page,
    }, info) => {
      const configuration = JSON.parse(await readFile('public/firebase-config.json', 'utf8'));
      expect(configuration.firebase.projectId).toBe('YOUR_FIREBASE_PROJECT_ID');
      expect(configuration.emulators).toBe(false);
      // Real configuration, but browser-fixture rejects any external network request.
      await page.route('**/firebase-config.json', (route) =>
        route.fulfill({ json: configuration }),
      );
      await page.goto('/#/anmeldung');
      await expect(page.getByRole('button', { name: 'Gäste-Login', exact: true })).toBeEnabled();
      const google = page.getByRole('button', { name: 'Anmelden mit Google' });
      await expect(google).toBeEnabled();
      await google.focus();
      await expect(google).toBeFocused();
      expect(await google.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
      await page.screenshot({ path: info.outputPath(`login-${width}.png`), fullPage: true });
      if (width < 768) await google.tap();
      else await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/zugang\/google$/);
      const open = page.getByRole('button', { name: 'Google-Fenster öffnen' });
      await expect(open).toBeDisabled();
      await page.getByRole('checkbox').check();
      await expect(open).toBeEnabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      await page.screenshot({
        path: info.outputPath(`google-confirm-${width}.png`),
        fullPage: true,
      });
      // OAuth itself is exercised in the emulator and separately with a real test account.
      await page.getByRole('link', { name: 'Abbrechen', exact: true }).click();
      await expect(page).toHaveURL(/\/anmeldung$/);
      await page.goto('/#/zugang/verknuepfen');
      await expect(page.getByText('Bitte melde dich zuerst', { exact: false })).toBeVisible();
      await expect(open).toHaveCount(0);
    });
  });
}
