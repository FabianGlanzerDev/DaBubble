import { test, expect } from './browser-fixture';

test.use({ hasTouch: true });

for (const width of [320, 375, 430]) {
  test(`${width}px touch: search, thread, dialogs and browser history`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 932 });
    await page.goto('/vorschau');
    const menu = page.getByRole('navigation', { name: 'Arbeitsbereich', exact: true });
    const search = page.locator('#mobile-workspace-search');
    await search.tap();
    await search.fill('@');
    await expect(page).toHaveURL(/view=search/);
    await expect(menu).toBeHidden();
    await expect(search).toBeFocused();
    await expect(page.locator('.mobile-expanded .results a')).toHaveCount(6);
    await page.goBack();
    await expect(menu).toBeVisible();
    await search.fill('#');
    await expect(page).toHaveURL(/view=search/);
    await page.getByRole('button', { name: 'Suche schließen' }).tap();
    await expect(menu).toBeVisible();
    await menu.getByRole('link', { name: 'Entwicklerteam', exact: true }).tap();
    await page
      .getByRole('button', { name: '2 Antworten – statische Thread-Vorschau öffnen' })
      .tap();
    const thread = page.getByRole('region', { name: 'Thread-Ansicht', exact: true });
    await expect(thread).toBeVisible();
    await expect(page.getByRole('region', { name: 'Chat-Ansicht', exact: true })).toBeHidden();
    await expect(thread.getByRole('textbox', { name: 'Antwortentwurf' })).toBeInViewport();
    await thread.getByRole('textbox', { name: 'Antwortentwurf' }).fill('Lokaler Threadentwurf');
    await page.screenshot({ path: info.outputPath('mobile-thread.png'), animations: 'disabled' });
    await page.goBack();
    await expect(thread).toBeHidden();
    await page.goForward();
    await expect(thread).toBeVisible();
    await thread.getByRole('button', { name: 'Thread schließen' }).tap();
    await expect(thread).toBeHidden();
    await page.getByRole('button', { name: 'Channel-Details öffnen' }).tap();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/dialog=/);
    await expect.poll(() => dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.goBack();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Channel-Details öffnen' })).toBeFocused();
    await page.getByRole('button', { name: /Profilmenü/ }).tap();
    await expect(dialog).toBeVisible();
    await expect
      .poll(async () =>
        Math.round((await dialog.boundingBox())!.y + (await dialog.boundingBox())!.height),
      )
      .toBe(932);
    await page.getByRole('button', { name: 'Profil', exact: true }).tap();
    await expect(dialog).toHaveAccessibleName('Profil');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await page.goBack();
    await expect(menu).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}

test('mobile keyboard navigation, direct thread entry and short viewport keep controls reachable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/vorschau/channels/entwicklerteam?view=thread');
  const thread = page.getByRole('region', { name: 'Thread-Ansicht', exact: true });
  await expect(thread.getByRole('textbox')).toBeInViewport();
  await thread.getByRole('button', { name: 'Thread schließen' }).focus();
  await expect(thread.getByRole('button', { name: 'Thread schließen' })).toHaveCSS(
    'outline-style',
    'solid',
  );
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/channels\/entwicklerteam$/);
  await page.getByRole('link', { name: 'Zurück zum Menü' }).focus();
  await page.keyboard.press('Enter');
  const search = page.locator('#mobile-workspace-search');
  await search.fill('@Noah');
  await page.keyboard.press('ArrowDown');
  await expect(
    page.locator('.mobile-expanded .results').getByRole('link', { name: 'Noah Braun' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/direkt\/noah-braun$/);
  await expect(page.getByRole('textbox', { name: 'Nachrichtenentwurf' })).toBeInViewport();
});

test('touch exposes message actions, local edit, mentions and reachable thread reactions', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/vorschau/channels/entwicklerteam');
  const own = page.locator('app-conversation .message.own');
  await own.locator('.bubble').tap();
  await own.getByRole('button', { name: 'Weitere Nachrichtenaktionen' }).tap();
  await own.getByRole('button', { name: 'Nachricht bearbeiten' }).tap();
  await own.getByRole('textbox').fill('Nur ein lokaler Entwurf');
  await expect(own.getByRole('button', { name: 'Speichern' })).toBeDisabled();
  await page.screenshot({ path: info.outputPath('mobile-message-edit.png') });
  await own.getByRole('button', { name: 'Abbrechen' }).tap();
  const composer = page.locator('app-conversation app-message-composer');
  await composer.getByRole('textbox').fill('@So');
  await composer.getByRole('button', { name: '@Sofia Müller', exact: true }).tap();
  await expect(composer.getByRole('textbox')).toHaveValue('@Sofia Müller ');
  await page.goto('/vorschau/channels/entwicklerteam?view=thread');
  const first = page.locator('app-thread-panel .message').first();
  await first.locator('.bubble').tap();
  await page.screenshot({ path: info.outputPath('mobile-thread-actions.png') });
  await first.getByRole('button', { name: 'Beispielreaktion Haken ansehen' }).tap();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('Beispielreaktionen');
  await page.goBack();
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test('mobile intro animates its original centered logo, reveals the word and docks before login', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/intro?replay=true');
  const started = Date.now();
  const brand = page.locator('.animated-brand');
  await expect(brand).toBeVisible();
  const frames = [];
  for (const time of [0, 2300, 4700]) {
    await page.waitForTimeout(Math.max(0, time - (Date.now() - started)));
    frames.push(
      await brand.evaluate((el) => ({
        width: el.getBoundingClientRect().width,
        top: el.getBoundingClientRect().top,
        opacity: getComputedStyle(el.querySelector('.word-clip span')!).opacity,
      })),
    );
    await page.screenshot({ path: info.outputPath(`mobile-intro-${time}.png`) });
  }
  expect(frames[0]!.width).toBeLessThan(85);
  expect(frames[0]!.top).toBeGreaterThan(420);
  expect(frames[0]!.opacity).toBe('0');
  expect(frames[1]!.width).toBeCloseTo(240, 0);
  expect(frames[1]!.opacity).toBe('1');
  expect(frames[2]!.top).toBeLessThan(130);
  await expect(page).toHaveURL(/\/anmeldung$/);
  expect(Date.now() - started).toBeGreaterThan(4700);
  const finalBrand = page.locator('app-public-layout header app-brand');
  await expect(finalBrand).toBeVisible();
  expect((await finalBrand.boundingBox())!.y).toBeCloseTo(72, 0);
  await finalBrand.getByRole('link').tap();
  await expect(page).toHaveURL(/\/intro\?replay=true$/);
  await page.getByRole('link', { name: 'Zur Anmeldung', exact: true }).tap();
  await expect(page).toHaveURL(/\/anmeldung$/);
});
