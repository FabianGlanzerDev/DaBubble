import { expect, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

/** Capture only rendered UI; never serialize action codes, credentials or browser storage. */
export async function captureOverlay(page: Page, info: TestInfo, name: string): Promise<void> {
  const status = page.locator('app-success-overlay [role="status"]');
  const bubble = status.locator('.confirmation');
  await expect(status).toBeVisible();
  await expect(status).toBeFocused();
  await expect(page.locator('app-public-layout')).toHaveAttribute('inert', '');
  await page.screenshot({ path: info.outputPath(`${name}-page.png`), animations: 'disabled' });
  await bubble.screenshot({ path: info.outputPath(`${name}-bubble.png`), animations: 'disabled' });
  const style = await bubble.evaluate((element) => {
    const box = element.getBoundingClientRect(),
      css = getComputedStyle(element);
    const label = getComputedStyle(element.querySelector('span')!);
    return {
      width: box.width,
      height: box.height,
      color: css.backgroundColor,
      radius: css.borderRadius,
      fontSize: label.fontSize,
      fontWeight: label.fontWeight,
      lineHeight: label.lineHeight,
      viewport: innerWidth,
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  expect(style.color).toBe('rgb(68, 77, 242)');
  expect(style.radius).toBe('30px 30px 0px');
  expect(style.fontWeight).toBe('700');
  expect(style.overflow).toBe(false);
  if (style.viewport >= 768) {
    expect(style.height).toBe(149);
    expect(style.fontSize).toBe('36px');
    expect(style.lineHeight).toBe('49px');
  }
  await writeFile(info.outputPath(`${name}-metrics.json`), JSON.stringify(style, null, 2));
}
