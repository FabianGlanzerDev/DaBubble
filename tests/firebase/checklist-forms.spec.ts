import { test, expect } from '../browser-fixture';

test.use({ emulatedFirebase: true });

for (const width of [1440, 320]) {
  test(`checklist forms ${width}px: empty and invalid fields use inline feedback without native alerts`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 932 });
    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.type());
      await dialog.dismiss();
    });
    await page.goto('/#/anmeldung');
    await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
    await expect(page.locator('#auth-email-error')).toContainText('E-Mail-Adresse ein');
    await expect(page.locator('#auth-password-error')).toContainText('Passwort ein');
    await page.goto('/#/registrierung');
    await page.getByLabel('Name', { exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('#register-name-error')).toContainText('Namen ein');
    await page.getByLabel('Name', { exact: true }).fill('N'.repeat(81));
    await expect(page.locator('#register-name-error')).toContainText('höchstens 80');
    await page.getByLabel('E-Mail-Adresse', { exact: true }).fill('ungueltig');
    await page.getByLabel('Passwort', { exact: true }).fill('x');
    await page.keyboard.press('Tab');
    await expect(page.locator('#auth-email-error')).toContainText('gültige E-Mail');
    await expect(page.locator('#auth-password-error')).toContainText('mindestens 6');
    await expect(page.getByRole('button', { name: 'Weiter zur Avatar-Auswahl' })).toBeDisabled();
    await expect(page.locator('form')).toHaveAttribute('novalidate', '');
    await page.screenshot({ path: info.outputPath('registration-errors-' + width + '.png') });
    await page.goto('/#/passwort-reset');
    await page.getByLabel('E-Mail-Adresse', { exact: true }).fill('ungueltig');
    await page.keyboard.press('Tab');
    await expect(page.locator('#reset-email-error')).toContainText('gültige E-Mail');
    await expect(page.getByRole('button', { name: 'E-Mail senden' })).toBeDisabled();
    expect(dialogs).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}
