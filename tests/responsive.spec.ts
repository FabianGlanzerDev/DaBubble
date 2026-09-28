import { test, expect } from './browser-fixture';
import type { Page } from '@playwright/test';

/** Checks visible element bounds and document width, excluding intentional clipped and intro-animation content. */
async function expectNoOverflow(page: Page) {
  const overflowing = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    return Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((element) => {
        if (
          !element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) ||
          element.classList.contains('skip-link') ||
          element.closest('.animated-brand')
        )
          return false;
        const style = getComputedStyle(element);
        if (style.position === 'absolute' && (style.clipPath !== 'none' || style.clip !== 'auto'))
          return false;
        const rect = element.getBoundingClientRect();
        return rect.right > viewport + 1 || rect.left < -1;
      })
      .map((element) => `${element.tagName}.${element.className}`);
  });
  expect(overflowing, 'All visible elements fit horizontally').toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}

for (const width of [320, 375, 430, 768, 1024, 1440, 1920]) {
  test(`all routes fit at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 1920 ? 1080 : 932 });
    for (const route of [
      '/intro',
      '/anmeldung',
      '/registrierung',
      '/avatar-vorschau',
      '/passwort-reset',
      '/passwort-reset/neues-passwort',
      '/meldungen-vorschau',
      '/vorschau',
      '/vorschau/channels/entwicklerteam',
      '/vorschau/direkt/noah-braun',
      '/impressum',
      '/datenschutz',
      '/vorschau/channels/office-team',
      '/vorschau/neue-nachricht',
      '/unbekannt',
    ]) {
      await page.goto('/#' + route);
      await expect(page.locator('[data-page-heading]:visible').first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(280);
      await expectNoOverflow(page);
      const duplicates = await page.evaluate(() => {
        const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
        return ids.filter((id, index) => ids.indexOf(id) !== index);
      });
      expect(duplicates, 'Unique IDs for labels and aria-controls').toEqual([]);
      if (
        [320, 375, 430, 1440, 1920].includes(width) &&
        [
          '/intro',
          '/anmeldung',
          '/registrierung',
          '/avatar-vorschau',
          '/passwort-reset',
          '/passwort-reset/neues-passwort',
          '/meldungen-vorschau',
          '/vorschau',
          '/vorschau/channels/entwicklerteam',
        ].includes(route)
      ) {
        await page.screenshot({
          path: testInfo.outputPath(`${route.replaceAll('/', '-')}-${width}.png`),
          fullPage: true,
        });
      }
    }
  });
}

test('320px: menu and conversation are separate, back and thread work', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/#/vorschau');
  const menu = page.getByRole('navigation', { name: 'Arbeitsbereich', exact: true });
  await expect(menu).toBeVisible();
  await expect(page.getByRole('region', { name: 'Chat-Ansicht' })).toBeHidden();
  await menu.getByRole('link', { name: 'Entwicklerteam', exact: true }).click();
  await expect(menu).toBeHidden();
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page.getByRole('region', { name: 'Chat-Ansicht' })).toBeVisible();
  await page
    .getByRole('button', { name: '2 Antworten – statische Thread-Vorschau öffnen' })
    .click();
  await expect(
    page
      .getByRole('region', { name: 'Thread-Ansicht', exact: true })
      .getByRole('heading', { name: 'Thread', exact: true }),
  ).toBeVisible();
  await expectNoOverflow(page);
  await page.getByRole('link', { name: 'Zurück zum Menü' }).click();
  await expect(menu).toBeVisible();
  await expect(page.getByRole('region', { name: 'Chat-Ansicht' })).toBeHidden();
  await menu.getByRole('link', { name: 'Noah Braun', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Noah Braun');
  await page.goBack();
  await expect(menu).toBeVisible();
});

test('desktop collapsed menu becomes available after mobile resize', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/vorschau/channels/entwicklerteam');
  await page.getByRole('button', { name: 'Menü einklappen' }).click();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole('link', { name: 'Zurück zum Menü' }).click();
  await expect(page.getByRole('navigation', { name: 'Arbeitsbereich', exact: true })).toBeVisible();
  await expectNoOverflow(page);
});
