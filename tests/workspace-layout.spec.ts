import { test, expect } from './browser-fixture';

test('four desktop layouts reclaim space and keep thread controls keyboard accessible', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/#/vorschau/channels/entwicklerteam');
  await page.evaluate(() => document.fonts.ready);
  const main = page.getByRole('region', { name: 'Chat-Ansicht', exact: true });
  const menu = page.getByRole('navigation', { name: 'Arbeitsbereich', exact: true });
  const thread = page.getByRole('complementary', { name: 'Vorgesehener Thread-Bereich' });
  /** Measures the currently rendered main panel to compare available space before and after layout toggles. */
  const width = async () => (await main.boundingBox())!.width;
  const fullWidth = await width();
  await page.screenshot({ path: testInfo.outputPath('06-menu-and-thread.png') });

  await page.getByRole('button', { name: 'Menü einklappen' }).click();
  await expect(menu).toBeHidden();
  expect(await width()).toBeGreaterThan(fullWidth + 300);
  await expect(thread).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('07-hidden-menu.png') });

  await page.getByRole('button', { name: 'Menü ausklappen' }).click();
  await thread.getByRole('button', { name: 'Thread schließen' }).focus();
  await page.keyboard.press('Enter');
  await expect(thread).toBeHidden();
  const threadSwitch = page.getByRole('button', { name: 'Thread anzeigen' });
  await expect(threadSwitch).toBeFocused();
  await expect(threadSwitch).toHaveAttribute('aria-expanded', 'false');
  const noThreadWidth = await width();
  expect(noThreadWidth).toBeGreaterThan(fullWidth + 400);
  await page.screenshot({ path: testInfo.outputPath('08-hidden-thread.png') });

  await page.getByRole('button', { name: 'Menü einklappen' }).click();
  await expect(menu).toBeHidden();
  expect(await width()).toBeGreaterThan(noThreadWidth + 300);
  await page.screenshot({ path: testInfo.outputPath('09-hidden-both.png') });
  await page
    .getByRole('button', { name: '2 Antworten – statische Thread-Vorschau öffnen' })
    .click();
  await expect(thread).toBeVisible();
  await expect(thread.getByRole('heading', { name: 'Thread', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Thread ausblenden' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await expect(
    page.getByRole('button', { name: 'Nachricht senden – noch nicht verfügbar', exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole('searchbox')).toBeEnabled();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(
    page.getByRole('button', { name: 'Nachricht senden – noch nicht verfügbar', exact: true }),
  ).toBeInViewport();
  await expect(
    thread.getByRole('button', { name: 'Antwort senden – noch nicht verfügbar', exact: true }),
  ).toBeInViewport();
});

test('mobile reply link opens the layout preview, composer and return navigation stay reachable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/#/vorschau/channels/entwicklerteam');
  await page
    .getByRole('button', { name: '2 Antworten – statische Thread-Vorschau öffnen' })
    .click();
  const details = page.getByRole('region', { name: 'Thread-Ansicht', exact: true });
  await expect(page).toHaveURL(/view=thread/);
  await expect(details.getByRole('heading', { name: 'Thread', exact: true })).toBeFocused();
  const reply = details.getByRole('textbox', { name: 'Antwortentwurf' });
  await reply.scrollIntoViewIfNeeded();
  await expect(reply).toBeInViewport();
  await expect(reply).toBeEnabled();
  await details.getByRole('button', { name: 'Thread schließen' }).click();
  await expect(details).toBeHidden();
  const composer = page.getByRole('textbox', { name: 'Nachrichtenentwurf' });
  await composer.scrollIntoViewIfNeeded();
  await expect(composer).toBeInViewport();
  await page.getByRole('link', { name: 'Zurück zum Menü' }).click();
  const group = page.getByRole('button', { name: 'Direktnachrichten', exact: true });
  await group.click();
  await expect(group).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('link', { name: 'Noah Braun', exact: true })).toBeHidden();
  await group.click();
  await page.getByRole('link', { name: 'Steffen Hoffmann', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Steffen Hoffmann');
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(568);
});

test('earlier preview links retain a destination after adopting the reference names', async ({
  page,
}) => {
  for (const [oldPath, destination] of [
    ['channels/allgemein', 'channels/entwicklerteam'],
    ['channels/projekt', 'channels/entwicklerteam'],
    ['direkt/beispielkontakt', 'direkt/noah-braun'],
  ]) {
    await page.goto(`/#/vorschau/${oldPath}`);
    await expect(page).toHaveURL(`http://dabubble.test/#/vorschau/${destination}`);
  }
});
