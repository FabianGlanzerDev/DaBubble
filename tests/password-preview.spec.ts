import { test, expect } from './browser-fixture';

test('password layouts have separate routes without sending or changing anything', async ({
  page,
}) => {
  await page.goto('/anmeldung');
  await page.getByRole('link', { name: 'Passwort vergessen?' }).click();
  await expect(page).toHaveURL(/\/passwort-reset$/);
  await expect(page.getByLabel('E-Mail-Adresse', { exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'E-Mail senden', exact: true })).toBeDisabled();
  await expect(page.locator('#password-note')).toContainText('Es wird keine E-Mail gesendet.');
  await expect(page.locator('app-confirmation-message')).toHaveCount(0);

  const previewLink = page.getByRole('link', { name: 'Neues-Passwort-Ansicht ansehen' });
  await previewLink.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/passwort-reset\/neues-passwort$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page.getByLabel('Neues Passwort', { exact: true })).toBeEnabled();
  await expect(page.getByLabel('Neues Kennwort bestätigen', { exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Passwort ändern' })).toBeDisabled();
  await expect(page.locator('#password-note')).toContainText('Das Passwort wird nicht geändert.');
  await page.reload();
  await expect(page.getByLabel('Neues Passwort', { exact: true })).toBeEnabled();
  await page.getByRole('link', { name: 'Zur E-Mail-Anforderung', exact: true }).click();
  await expect(page).toHaveURL(/\/passwort-reset$/);
  await page.getByRole('link', { name: 'Zur Anmeldung', exact: true }).click();
  await expect(page).toHaveURL(/\/anmeldung$/);
});

test('confirmation examples are explicitly a design preview and create no session', async ({
  page,
}) => {
  await page.goto('/avatar-vorschau');
  await page.getByRole('link', { name: 'Bestätigungsmeldungen ansehen' }).click();
  await expect(page).toHaveURL(/\/meldungen-vorschau$/);
  await expect(
    page.getByText('Dies sind ausschließlich Gestaltungsbeispiele.', { exact: false }),
  ).toBeVisible();
  const messages = page.locator('app-confirmation-message');
  await expect(messages).toHaveText(['Konto erfolgreich erstellt!', 'E-Mail gesendet', 'Anmelden']);
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('link', { name: 'Zur Passwort-Vorschau' }).click();
  await page.getByRole('link', { name: 'Bestätigungsmeldungen ansehen' }).click();
  await expect(page).toHaveURL(/\/meldungen-vorschau$/);
  await page.goto('/chat');
  await expect(page).toHaveURL(/\/anmeldung\?/);
});
