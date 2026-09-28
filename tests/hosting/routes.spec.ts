/**
 * Checks direct entry, reload and safe parameter handling for public and protected hash routes without server rewrites.
 *
 * @packageDocumentation
 */

import { test, expect } from '../browser-fixture';
import { writeFile } from 'node:fs/promises';

test.use({ emulatedFirebase: true, staticHosting: true, hasTouch: true });

// Every route in app.routes.ts, including aliases, denied protected routes and both dynamic kinds.
const routes = [
  ['/', '/intro'],
  ['/intro', '/intro'],
  ['/anmeldung', '/anmeldung'],
  ['/registrierung', '/registrierung'],
  ['/avatar-vorschau', '/avatar-vorschau'],
  ['/avatar-auswahl', '/anmeldung'],
  ['/passwort-reset', '/passwort-reset'],
  ['/passwort-reset/neues-passwort', '/passwort-reset/neues-passwort'],
  ['/zugang/google', '/zugang/google'],
  ['/zugang/gast', '/anmeldung'],
  ['/zugang/verknuepfen', '/zugang/verknuepfen'],
  ['/zugang/unbekannt', '/zugang/unbekannt'],
  ['/impressum', '/impressum'],
  ['/datenschutz', '/datenschutz'],
  ['/meldungen-vorschau', '/meldungen-vorschau'],
  ['/vorschau', '/vorschau'],
  ['/vorschau/neue-nachricht', '/vorschau/neue-nachricht'],
  ['/vorschau/channels/allgemein', '/vorschau/channels/entwicklerteam'],
  ['/vorschau/channels/projekt', '/vorschau/channels/entwicklerteam'],
  ['/vorschau/channels/entwicklerteam', '/vorschau/channels/entwicklerteam'],
  ['/vorschau/channels/office-team', '/vorschau/channels/office-team'],
  ['/vorschau/direkt/beispielkontakt', '/vorschau/direkt/noah-braun'],
  ['/vorschau/direkt/noah-braun', '/vorschau/direkt/noah-braun'],
  ['/vorschau/direkt/sofia-mueller', '/vorschau/direkt/sofia-mueller'],
  ['/vorschau/channels/unbekannt', '/vorschau/channels/unbekannt'],
  ['/vorschau/direkt/unbekannt', '/vorschau/direkt/unbekannt'],
  ['/chat', '/anmeldung'],
  ['/chat/neue-nachricht', '/anmeldung'],
  ['/chat/channels/test-private', '/anmeldung'],
  ['/chat/direkt/test-private', '/anmeldung'],
  ['/unbekannt', '/unbekannt'],
] as const;

for (const width of [1440, 430, 375, 320]) {
  test(`static host ${width}px: every public route, aliases and protected links direct + reload`, async ({
    page,
    request,
  }, info) => {
    test.setTimeout(240000);
    await page.setViewportSize({ width, height: 932 });
    expect((await request.get('/anmeldung')).status()).toBe(404);
    expect((await request.get('/chat/channels/test-private')).status()).toBe(404);
    const checks: object[] = [];
    for (const [path, destination] of routes) {
      for (const operation of ['direct', 'reload']) {
        const expectedRoute = destination;
        if (operation === 'direct') await page.goto('about:blank');
        const response =
          operation === 'direct' ? await page.goto('/#' + path) : await page.reload();
        expect(response?.status(), path).toBe(200);
        expect(new URL(response!.url()).pathname).toBe('/');
        await expect.poll(() => new URL(page.url()).hash.split('?')[0]).toBe('#' + expectedRoute);
        await expect(page.locator('[data-page-heading]:visible').first()).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          path,
        ).toBe(true);
        if (path.startsWith('/chat') || path === '/avatar-auswahl') {
          expect(
            new URL(new URL(page.url()).hash.slice(1), page.url()).searchParams.get('returnUrl'),
          ).toBe(path);
          await expect(page.getByRole('button', { name: /^Profilmenü für/ })).toHaveCount(0);
        }
        checks.push({ path, destination: expectedRoute, operation, http: 200 });
      }
    }
    await page.goto('/#/anmeldung');
    await page.screenshot({ path: info.outputPath(`login-${width}.png`), fullPage: true });
    const register = page.getByRole('link', { name: 'Konto erstellen', exact: true });
    await expect(register).toHaveAttribute('href', '#/registrierung');
    await register.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/registrierung$/);
    await page.goBack();
    await expect(page).toHaveURL(/#\/anmeldung$/);
    await page.goForward();
    await expect(page).toHaveURL(/#\/registrierung$/);
    await page.getByRole('link', { name: 'Zum Hauptinhalt' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
    await expect(page).toHaveURL(/#\/registrierung$/);
    await writeFile(info.outputPath('routes.json'), JSON.stringify({ width, checks }, null, 2));
  });
}

test('root action parameters, invalid modes, index.html and hostile continueUrl stay inside the app', async ({
  page,
}) => {
  const parameters = new URLSearchParams({
    mode: 'resetPassword',
    oobCode: 'synthetic+code/&=',
    lang: 'de',
    apiKey: 'synthetic-key',
    continueUrl: 'https://example.invalid/steal?next=1#fragment',
  });
  for (const entry of ['/', '/index.html']) {
    await page.goto(entry + '?' + parameters);
    await expect(page.getByRole('alert')).toContainText('ungültig');
    const route = new URL(new URL(page.url()).hash.slice(1), page.url());
    expect(route.pathname).toBe('/passwort-reset/neues-passwort');
    expect(route.searchParams.toString()).toBe(parameters.toString());
    expect(new URL(page.url()).search).toBe('');
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('ungültig');
  }
  await page.goto('/?mode=verifyEmail&oobCode=synthetic');
  await expect(page.getByRole('alert')).toContainText(
    'E-Mail-Aktion wird in DaBubble noch nicht unterstützt',
  );
  await page.goto('/index.html#/anmeldung');
  await expect(page).toHaveURL('http://127.0.0.1:4302/#/anmeldung');
});

test('a second reset hash in the same document verifies the new code', async ({ page }) => {
  await page.goto('/#/passwort-reset/neues-passwort?mode=resetPassword&oobCode=first-invalid');
  await expect(page.getByRole('alert')).toContainText('ungültig');
  const verification = page.waitForRequest(
    (request) =>
      request.url().includes('accounts:resetPassword') &&
      request.postDataJSON()?.oobCode === 'second-invalid',
  );
  await page.goto('/#/passwort-reset/neues-passwort?mode=resetPassword&oobCode=second-invalid');
  await verification;
  await expect(page.getByRole('alert')).toContainText('ungültig');
});
