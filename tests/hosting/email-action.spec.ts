import { test, expect } from '../browser-fixture';

test.use({ emulatedFirebase: true, staticHosting: true, trace: 'off' });

for (const width of [1440, 320]) {
  test(`${width}px: synthetic action links retain parameters and reject other mail actions safely`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 932 });
    let resetRequests = 0;
    page.on('request', (request) => {
      if (request.url().includes('accounts:resetPassword')) resetRequests++;
    });
    const parameters = new URLSearchParams({
      mode: 'resetPassword',
      oobCode: 'DABUBBLE-TEST-KEIN-RESET-CODE',
      apiKey: 'synthetic-key',
      continueUrl: 'https://example.invalid/foreign?next=1#fragment',
      lang: 'de',
    });
    // Include a misleading hash to confirm that Firebase's actual root query takes precedence.
    for (const entry of ['/', '/index.html']) {
      await page.goto(entry + '?' + parameters + '#/anmeldung');
      for (const reload of [false, true]) {
        if (reload) await page.reload();
        await expect(page.getByRole('alert')).toContainText('ungültig');
        const url = new URL(page.url());
        expect(url.search).toBe('');
        expect(new URL(url.hash.slice(1), url).searchParams.toString()).toBe(parameters.toString());
        await expect(
          page.getByRole('button', { name: 'Passwort ändern', exact: true }),
        ).toBeDisabled();
      }
    }
    for (const mode of [
      'verifyEmail',
      'recoverEmail',
      'verifyAndChangeEmail',
      'signIn',
      'unknown',
    ]) {
      const before = resetRequests;
      await page.goto('/?' + new URLSearchParams({ mode, oobCode: 'synthetic' }));
      for (const reload of [false, true]) {
        if (reload) await page.reload();
        await expect(page.getByRole('alert')).toContainText(
          'E-Mail-Aktion wird in DaBubble noch nicht unterstützt',
        );
        await page.getByLabel('Neues Passwort', { exact: true }).fill('Synthetic input only');
        await expect(page.getByRole('alert')).toContainText(
          'E-Mail-Aktion wird in DaBubble noch nicht unterstützt',
        );
        await expect(
          page.getByRole('button', { name: 'Passwort ändern', exact: true }),
        ).toBeDisabled();
        expect(resetRequests).toBe(before);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: info.outputPath(`unsupported-action-${width}.png`),
      fullPage: true,
    });
    await page.goto('/?mode=resetPassword');
    await expect(page.getByRole('alert')).toContainText('ungültig');
    await page.screenshot({ path: info.outputPath(`missing-code-${width}.png`), fullPage: true });
  });
}
