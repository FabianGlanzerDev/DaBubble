import { expect, type Browser, type Page, type TestInfo } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { installAppRoutes } from '../browser-fixture';

export async function registerChatUser(page: Page, name: string): Promise<void> {
  await page.goto('/#/registrierung');
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page
    .getByLabel('E-Mail-Adresse', { exact: true })
    .fill(`chat-${randomUUID()}@example.test`);
  await page.getByLabel('Passwort', { exact: true }).fill(randomUUID());
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Weiter zur Avatar-Auswahl' }).click();
  await page.getByRole('button', { name: 'Avatar 3', exact: true }).click();
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByText('Gespräche werden geladen…', { exact: true })).toBeHidden();
  await expect(page.locator('.chat-error')).toBeHidden();
}

export async function secondUser(browser: Browser, baseURL: string, width: number) {
  const context = await browser.newContext({
    baseURL,
    viewport: { width, height: 932 },
    hasTouch: width < 768,
    permissions: ['local-network-access'],
    serviceWorkers: 'block',
  });
  const errors: string[] = [];
  await installAppRoutes(context, true, baseURL, errors);
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (entry) => {
    if (entry.type() === 'error') errors.push(entry.text());
  });
  return { page, context, errors };
}

export async function createChannel(page: Page, name: string): Promise<void> {
  await page
    .locator('app-live-sidebar')
    .getByRole('button', { name: 'Channel erstellen', exact: true })
    .click();
  await page.getByLabel('Channel-Name', { exact: true }).fill(name);
  await page.getByLabel('Beschreibung (optional)').fill('Gemeinsam im Emulator geprüft');
  await page.getByRole('button', { name: 'Erstellen', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();
}

export async function send(page: Page, text: string, thread = false): Promise<void> {
  await expect(page.getByRole('dialog')).toBeHidden();
  const field = page.getByLabel(thread ? 'Antwort schreiben' : 'Nachricht schreiben', {
    exact: true,
  });
  await field.fill(text);
  await field.press('Enter');
  await expect(field).toHaveValue('');
}

export async function selectInvitee(page: Page, name: string): Promise<void> {
  await page.getByRole('textbox', { name: 'Leute hinzufügen', exact: true }).fill(name);
  await page
    .getByRole('list', { name: 'Passende Personen' })
    .getByRole('button', { name, exact: true })
    .click();
}

export async function noOverflow(page: Page, info: TestInfo, name: string): Promise<void> {
  const size = await page.evaluate(() => {
    const dialog = document.querySelector<HTMLDialogElement>('dialog[open]');
    return {
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      dialogRight: dialog?.getBoundingClientRect().right ?? 0,
    };
  });
  expect(size.scroll, name).toBeLessThanOrEqual(size.width);
  expect(size.dialogRight, name).toBeLessThanOrEqual(size.width);
  await page.screenshot({ path: info.outputPath(name + '.png'), animations: 'disabled' });
}

export async function revealActions(page: Page, text: string) {
  const article = page
    .locator('.main-panel article')
    .filter({ has: page.locator('.bubble', { hasText: text }) });
  if ((page.viewportSize()?.width ?? 1920) < 768) {
    const button = article.getByRole('button', { name: 'Nachrichtenaktionen', exact: true });
    if ((await button.getAttribute('aria-expanded')) !== 'true') await button.tap();
  } else await article.hover();
  const id = await article.getAttribute('data-message-id');
  return page.locator(`.main-panel article[data-message-id="${id}"]`);
}
