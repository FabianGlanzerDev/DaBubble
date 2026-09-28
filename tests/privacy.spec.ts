import { test, expect } from './browser-fixture';

for (const width of [1440, 375, 320]) {
  test.describe(`privacy ${width}px`, () => {
    test.use({ viewport: { width, height: 900 }, hasTouch: width < 768 });

    test('public notice and deletion request remain readable and never claim automatic deletion', async ({
      page,
    }, info) => {
      await page.goto('/#/datenschutz');
      const notice = page.locator('app-privacy-notice');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Datenschutz');
      await expect(notice.locator('h2')).toHaveCount(8);
      await expect(notice.locator('.draft, .open, aside')).toHaveCount(0);
      await expect(notice).not.toContainText('Offene Angaben');
      await expect(notice).not.toContainText('Unbestätigte Einstellungen');
      await expect(notice).not.toContainText('Entwurf zur Prüfung');
      await expect(notice).toContainText(
        'Es gibt keine Schaltfläche zur Kontolöschung in der App.',
      );
      await expect(notice).toContainText(
        'Erst nach deiner ausdrücklichen Bestätigung und mit den erforderlichen Verwaltungsrechten',
      );
      await expect(notice).toContainText('Wenn du Google ausdrücklich als Anmeldemethode wählst');
      await expect(notice).toContainText('Google-Passwort wird nicht an DaBubble übermittelt');
      await expect(notice).toContainText(
        'Eine restlose Löschung aus allen Systemen wird deshalb nicht zugesagt.',
      );
      await expect(notice).toContainText(
        'Die Kennung allein beweist nicht, dass das Konto dir gehört.',
      );
      await expect(notice).toContainText(
        'Registrierung ist für diesen Nachweis nicht erforderlich',
      );
      await expect(notice).toContainText('Einzelfall');
      await expect(notice.locator('address')).toContainText('8750 Judenburg, Österreich');

      const request = page.getByRole('link', { name: 'Löschanfrage per E-Mail vorbereiten' });
      const href = new URL((await request.getAttribute('href'))!);
      expect(href.protocol).toBe('mailto:');
      expect(href.pathname).toBe('fabsdev@gmx.at');
      expect(href.searchParams.get('subject')).toBe('DaBubble – Löschanfrage');
      expect(href.searchParams.get('body')).toContain('Diese Anfrage bestätigt keine Löschung');
      await request.focus();
      await expect(request).toBeFocused();
      expect(await request.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
      // Inspect activation without sending an email or opening an OS mail client.
      await request.evaluate((el) =>
        el.addEventListener('click', (event) => {
          event.preventDefault();
          el.setAttribute('data-request-activated', 'true');
        }),
      );
      if (width < 768) await request.tap();
      else await page.keyboard.press('Enter');
      await expect(request).toHaveAttribute('data-request-activated', 'true');
      await expect(page).toHaveURL(/\/datenschutz$/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: info.outputPath(`privacy-request-${width}.png`) });
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: info.outputPath(`privacy-${width}.png`), fullPage: true });
      const back = page.getByRole('link', { name: 'Zur Anmeldung', exact: true });
      if (width < 768) await back.tap();
      else await back.click();
      await expect(page).toHaveURL(/\/anmeldung$/);
    });
  });
}
