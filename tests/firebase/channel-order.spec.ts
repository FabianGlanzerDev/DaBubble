import { randomUUID } from 'node:crypto';
import { test, expect } from '../browser-fixture';
import { createChannel, registerChatUser, noOverflow } from './chat-helpers';

test.use({ emulatedFirebase: true });

for (const width of [1920, 430]) {
  test(`Figma Note 7: new channels stay last after rename and reload at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: width === 1920 ? 1080 : 932 });
    await registerChatUser(page, 'Channel-Reihenfolge');
    const suffix = randomUUID().slice(0, 8);
    const first = 'Zulu ' + suffix;
    const last = 'Alpha ' + suffix;
    const renamed = 'Aardvark ' + suffix;
    await createChannel(page, first);
    const firstUrl = page.url();
    await page.goto('/#/chat');
    await createChannel(page, last);
    await page.goto('/#/chat');
    const channels = page.locator('#live-channels a');
    await expect(channels).toHaveText([first, last]);
    await page.goto(firstUrl);
    await page.getByRole('button', { name: 'Gesprächsdetails' }).click();
    await page.getByRole('button', { name: 'Bearbeiten: Channel-Name', exact: true }).click();
    await page.getByLabel('Channel-Name', { exact: true }).fill(renamed);
    await page.getByRole('button', { name: 'Speichern: Channel-Name', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText(renamed);
    await page.keyboard.press('Escape');
    await page.goto('/#/chat');
    await page.reload();
    await expect(channels).toHaveText([renamed, last]);
    await noOverflow(page, info, 'channel-order');
  });
}
