import { test, expect } from '../browser-fixture';
import { identity } from './access-helpers';

test.use({ emulatedFirebase: true });

for (const width of [1440, 320]) {
  test(`guest ${width}px: actual cloud ADMIN_ONLY_OPERATION response has actionable feedback and retry`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 932 });
    await page.goto('/#/anmeldung');
    let requests = 0;
    await page.route('**/accounts:signUp?*', (route) => {
      requests++;
      return route.fulfill({
        status: 400,
        json: { error: { code: 400, message: 'ADMIN_ONLY_OPERATION' } },
      });
    });
    await page.getByRole('button', { name: 'Gäste-Login' }).click();
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Der Gastzugang ist noch nicht aktiviert');
    await expect(alert).toContainText('kontaktiere den Betreiber');
    await expect(alert).not.toContainText('Die Aktion konnte nicht abgeschlossen werden');
    await expect(page).toHaveURL(/\/anmeldung$/);
    await expect(page.getByRole('button', { name: 'Gäste-Login' })).toBeEnabled();
    await expect(identity(page)).rejects.toThrow('No persisted account');
    expect(requests).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({
      path: info.outputPath(`guest-admin-restricted-${width}.png`),
      fullPage: true,
    });
    await page.unroute('**/accounts:signUp?*');
    await page.getByRole('button', { name: 'Gäste-Login' }).click();
    await expect(page).toHaveURL(/\/chat$/);
    await expect(page.locator('app-live-header .guest-label')).toBeVisible();
    expect((await identity(page)).isAnonymous).toBe(true);
  });
}

test('unknown guest errors show a useful action and only a safe SDK code', async ({ page }) => {
  await page.goto('/#/anmeldung');
  await page.route('**/accounts:signUp?*', (route) =>
    route.fulfill({
      status: 400,
      json: { error: { message: 'UNEXPECTED_PROVIDER_RESPONSE : private-payload' } },
    }),
  );
  await page.getByRole('button', { name: 'Gäste-Login' }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Der Gastzugang konnte nicht geöffnet werden.');
  await expect(alert).toContainText('Fehlercode: auth/');
  await expect(alert).not.toContainText('private-payload');
  await expect(alert).not.toContainText('Die Aktion konnte nicht abgeschlossen werden');
});
