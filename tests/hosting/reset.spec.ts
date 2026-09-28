import { test, expect } from '../browser-fixture';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { finishAvatar, identity, leaveAccount } from '../firebase/access-helpers';

test.use({ emulatedFirebase: true, staticHosting: true, hasTouch: true, trace: 'off' });

for (const width of [1440, 430, 375, 320]) {
  test(`${width}px: root action URL on a no-rewrite host: request, reload, change, login and used code`, async ({
    page,
    request,
    baseURL,
  }, info) => {
    await page.setViewportSize({ width, height: 932 });
    const email = `hash-reset-${randomUUID()}@example.test`;
    const password = randomUUID();
    await page.goto('/#/registrierung');
    await page.getByLabel('Name', { exact: true }).fill('Hash Reset');
    await page.getByLabel('E-Mail-Adresse', { exact: true }).fill(email);
    await page.getByLabel('Passwort', { exact: true }).fill(password);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Weiter zur Avatar-Auswahl' }).click();
    await finishAvatar(page);
    const originalIdentity = await identity(page);
    await leaveAccount(page);
    await page.goto('/#/passwort-reset');
    await page.locator('#reset-email').fill(email);
    const sent = page.waitForRequest((r) => r.url().includes('accounts:sendOobCode'), {
      timeout: 10000,
    });
    await page.getByRole('button', { name: 'E-Mail senden' }).tap();
    expect((await sent).postDataJSON().continueUrl).toBe(baseURL + '/#/anmeldung');
    await expect(page.getByRole('status')).toContainText('Wenn ein Konto');
    const response = await request.get(
      'http://127.0.0.1:9099/emulator/v1/projects/demo-dabubble-auth/oobCodes',
    );
    const records = (await response.json()) as {
      oobCodes: { email: string; oobCode: string; oobLink: string; requestType: string }[];
    };
    const record = records.oobCodes.find(
      (entry) => entry.email === email && entry.requestType === 'PASSWORD_RESET',
    );
    expect(!!record?.oobLink).toBe(true);
    const generated = new URL(record!.oobLink);
    expect(generated.pathname).toBe('/emulator/action');
    expect(generated.hash).toBe('');
    expect(generated.searchParams.get('oobCode') === record!.oobCode).toBe(true);
    expect(generated.searchParams.get('mode')).toBe('resetPassword');
    expect(generated.searchParams.get('continueUrl')).toBe(baseURL + '/#/anmeldung');
    // The emulator fixes its handler path. Reuse its generated query at our custom root handler.
    const actionUrl = '/?' + generated.searchParams;
    for (const navigate of [() => page.goto(actionUrl), () => page.reload()]) {
      const verified = page.waitForResponse(
        (r) => r.url().includes('accounts:resetPassword') && r.request().method() === 'POST',
      );
      expect((await navigate())?.status()).toBe(200);
      expect((await verified).status()).toBe(200);
      await expect(page.locator('form')).toHaveAttribute('aria-busy', 'false');
      await expect(page.getByRole('alert')).toHaveCount(0);
      await expect(page.locator('app-intro')).toHaveCount(0);
      const location = new URL(page.url());
      const routed = new URL(location.hash.slice(1), location);
      expect(location.search).toBe('');
      expect(routed.pathname).toBe('/passwort-reset/neues-passwort');
      expect(routed.searchParams.toString() === generated.searchParams.toString()).toBe(true);
    }
    await page.screenshot({ path: info.outputPath(`reset-ready-${width}.png`), fullPage: true });
    const changed = randomUUID();
    await page.getByLabel('Neues Passwort', { exact: true }).fill(changed);
    await page.getByLabel('Neues Kennwort bestätigen', { exact: true }).fill(randomUUID());
    const change = page.getByRole('button', { name: 'Passwort ändern', exact: true });
    await expect(change).toBeDisabled();
    await page.getByLabel('Neues Kennwort bestätigen', { exact: true }).fill(changed);
    await expect(change).toBeEnabled();
    await change.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toContainText('Dein Passwort wurde geändert');
    await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`reset-success-${width}.png`), fullPage: true });
    await page.getByRole('link', { name: 'Zur Anmeldung', exact: true }).last().click();
    await expect(page).toHaveURL(/#\/anmeldung$/);
    await page.getByLabel('E-Mail-Adresse', { exact: true }).fill(email);
    await page.getByLabel('Passwort', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
    await expect(page.locator('#auth-password-error')).toContainText('nicht korrekt');
    await page.getByLabel('Passwort', { exact: true }).fill(changed);
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
    await expect(page).toHaveURL(/#\/chat$/);
    expect(await identity(page)).toEqual(originalIdentity);
    await leaveAccount(page);
    await page.goto(actionUrl);
    await expect(page.getByRole('alert')).toContainText('ungültig oder wurde bereits verwendet');
    await page.getByLabel('Neues Passwort', { exact: true }).fill(randomUUID());
    await expect(page.getByRole('alert')).toContainText('ungültig oder wurde bereits verwendet');
    await expect(change).toBeDisabled();
    // No credentials, action codes, generated links or account addresses in the evidence file.
    await writeFile(
      info.outputPath('reset-evidence.json'),
      JSON.stringify(
        {
          width,
          environment: 'demo-dabubble-auth emulators',
          generatedHandler: generated.pathname,
          parameterNames: [...generated.searchParams.keys()].sort(),
          customHandler: '/',
          directAndReloadVerified: true,
          oldPasswordRejected: true,
          newPasswordAccepted: true,
          identityPreserved: true,
          usedCodeRejected: true,
          cloudMailDeliveryOrConsoleTemplateTested: false,
        },
        null,
        2,
      ),
    );
  });
}
