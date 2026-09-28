/**
 * Checks real reaction grouping, recent emoji choices, mentions and responsive chat presentation using emulator data.
 *
 * @packageDocumentation
 */

import { test, expect } from '../browser-fixture';
import { createChannel, noOverflow, registerChatUser, revealActions, send } from './chat-helpers';

test.use({ emulatedFirebase: true, hasTouch: true });

test('emoji limits, names, recent choices, mentions and layout from 320 to 1920px', async ({
  page,
}, info) => {
  const name = 'L'.repeat(60) + Date.now(),
    channel = 'Design ' + Date.now();
  await page.setViewportSize({ width: 430, height: 932 });
  await registerChatUser(page, name);
  await createChannel(page, channel);
  const field = page.getByLabel('Nachricht schreiben', { exact: true });
  await field.fill('@' + name);
  await expect
    .poll(() => page.locator('.mentions').evaluate((list) => list.scrollWidth <= list.clientWidth))
    .toBe(true);
  await page
    .locator('.mentions')
    .getByRole('button', { name: '@' + name, exact: true })
    .click();
  await field.press('Enter');
  await expect(
    page.locator('.bubble').getByRole('button', { name: '@' + name, exact: true }),
  ).toBeVisible();
  const message = await revealActions(page, '@' + name);
  for (const emoji of [
    '✅',
    '🙌',
    '😀',
    '👍',
    '👏',
    '❤️',
    '😎',
    '🤔',
    '🚀',
    '🤓',
    '🎉',
    '😂',
    '😊',
    '🔥',
    '💡',
    '👀',
    '💪',
    '🙏',
    '😢',
    '🎯',
  ]) {
    await message.getByRole('button', { name: 'Reaktion hinzufügen' }).tap();
    await page.getByRole('button', { name: 'Emoji ' + emoji, exact: true }).tap();
    await expect(page.getByRole('dialog')).toBeHidden();
  }
  await expect(message.locator('.reactions button[aria-pressed=true]:visible')).toHaveCount(7);
  await message.getByRole('button', { name: '+13 weitere', exact: true }).tap();
  await expect(message.locator('.reactions button[aria-pressed=true]:visible')).toHaveCount(20);
  await message.getByRole('button', { name: 'Weniger', exact: true }).tap();
  await expect(message.locator('.message-actions button').filter({ hasText: '🎯' })).toBeVisible();
  await message.getByRole('button', { name: 'Wer hat reagiert?' }).tap();
  await expect(page.getByRole('dialog')).toContainText(name);
  await noOverflow(page, info, 'reaction-people-430');
  await page.keyboard.press('Escape');
  await message
    .locator('.bubble')
    .getByRole('button', { name: '@' + name, exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText(name);
  await noOverflow(page, info, 'profile-430');
  await page.keyboard.press('Escape');
  await send(page, 'Langer Text ' + 'W'.repeat(120));
  for (const width of [320, 375, 430, 1920]) {
    await page.setViewportSize({ width, height: 932 });
    await noOverflow(page, info, 'messages-' + width);
    await message.getByRole('button', { name: /^(Im Thread antworten|\d+ Antworten)$/ }).click();
    const reply = page.getByLabel('Antwort schreiben', { exact: true });
    await reply.fill('#');
    await page
      .locator('.live-thread .mentions')
      .getByRole('button', { name: '#' + channel, exact: true })
      .click();
    await expect(reply).toHaveValue('#' + channel + ' ');
    await reply.fill('@' + name);
    await page
      .locator('.live-thread .mentions')
      .getByRole('button', { name: '@' + name, exact: true })
      .click();
    await expect(reply).toHaveValue('@' + name + ' ');
    await send(page, 'Antwort bei ' + width + ' px', true);
    await expect(
      page.locator('.live-thread .reactions button[aria-pressed=true]:visible'),
    ).toHaveCount(7);
    await noOverflow(page, info, 'thread-' + width);
    await page.getByRole('button', { name: 'Thread schließen' }).click();
  }
  await expect(message.locator('.reactions button[aria-pressed=true]:visible')).toHaveCount(20);
  await page.getByRole('button', { name: 'Menü einklappen' }).click();
  await expect(page.getByRole('button', { name: 'Menü ausklappen' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await noOverflow(page, info, 'hidden-menu-1920');
});
