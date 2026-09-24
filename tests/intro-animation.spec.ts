import { test, expect } from './browser-fixture';

test('intro expands, reveals name, docks and routes after five seconds', async ({ page }, info) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/intro');
  const brand = page.locator('.animated-brand');
  await expect(brand).toBeVisible();
  const started = Date.now();
  const frames: Record<string, unknown>[] = [];
  for (const time of [0, 700, 1700, 2300, 3700, 4300]) {
    await page.waitForTimeout(Math.max(0, time - (Date.now() - started)));
    const frame = await brand.evaluate((el) => {
      const word = el.querySelector('.word-clip span')!;
      const rect = el.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, opacity: getComputedStyle(word).opacity };
    });
    frames.push({ time, ...frame });
    await page.screenshot({ path: info.outputPath(`intro-${time}.png`) });
  }
  expect(Number(frames[0]!['width'])).toBeLessThan(120);
  expect(Number(frames[3]!['width'])).toBeCloseTo(280, 0);
  expect(Number(frames[0]!['opacity'])).toBe(0);
  expect(Number(frames[3]!['opacity'])).toBe(1);
  expect(Number(frames[5]!['x'])).toBeLessThan(Number(frames[3]!['x']));
  await expect(page).toHaveURL(/\/anmeldung$/, { timeout: 2000 });
  expect(Date.now() - started).toBeGreaterThan(4700);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await page.screenshot({ path: info.outputPath('intro-finished.png') });
  await info.attach('intro-frames', {
    body: JSON.stringify(frames, null, 2),
    contentType: 'application/json',
  });
  await page.goto('/intro');
  await expect(page).toHaveURL(/\/anmeldung$/);
});

test('each logo activation replays the intro before login even after it has played', async ({
  page,
}) => {
  await page.goto('/anmeldung');
  await page.evaluate(() => localStorage.setItem('dabubble-intro-played', 'true'));
  for (const activation of ['click', 'keyboard']) {
    const logo = page.getByRole('link', { name: 'DaBubble – Intro erneut abspielen' });
    if (activation === 'click') await logo.click();
    else {
      await logo.focus();
      await page.keyboard.press('Enter');
    }
    await expect(page).toHaveURL(/\/intro\?replay=true$/);
    await expect(page.locator('.animated-brand')).toBeVisible();
    await page.waitForTimeout(2300);
    await expect(page.locator('.word-clip span')).toHaveCSS('opacity', '1');
    await expect(page).toHaveURL(/\/intro\?replay=true$/);
    await expect(page).toHaveURL(/\/anmeldung$/, { timeout: 4000 });
    await expect(page.getByRole('heading', { name: 'Anmeldung', exact: true })).toBeFocused();
  }
});

test('intro remains usable without storage and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get: () => {
        throw new Error('Storage disabled');
      },
    });
  });
  await page.goto('/intro');
  await expect(page).toHaveURL(/\/anmeldung$/);
  await expect(page.getByRole('heading', { name: 'Anmeldung', exact: true })).toBeVisible();
});

test('confirmation animations are explicitly previews and use accessible dialogs', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/meldungen-vorschau');
  for (const [button, image] of [
    ['Konto-Overlay animieren', '03B'],
    ['E-Mail-Overlay animieren', '04B'],
    ['Anmelden-Overlay animieren', '05B'],
  ]) {
    await page.getByRole('button', { name: button }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toHaveAccessibleName('Animationsbeispiel');
    await expect(dialog).toContainText('Kein Konto erstellt');
    await page.waitForTimeout(550);
    await page.screenshot({ path: info.outputPath(`${image}-confirmation.png`) });
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: button })).toBeFocused();
  }
});
