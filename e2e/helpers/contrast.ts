import { expect, type Locator, type Page } from "@playwright/test";

type Rgb = [number, number, number];

function parseRgb(color: string): Rgb {
  const match = color.match(/[\d.]+/g);
  if (!match || match.length < 3) {
    throw new Error(`Nie można sparsować koloru: ${color}`);
  }

  return [Number(match[0]), Number(match[1]), Number(match[2])];
}

function relativeLuminance([r, g, b]: Rgb): number {
  const channels = [r, g, b].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(foreground: Rgb, background: Rgb): number {
  const fg = relativeLuminance(foreground) + 0.05;
  const bg = relativeLuminance(background) + 0.05;
  return fg > bg ? fg / bg : bg / fg;
}

async function readContrast(locator: Locator): Promise<{ ratio: number; backgroundColor: string; color: string }> {
  const { backgroundColor, color } = await locator.evaluate((element) => {
    const styles = window.getComputedStyle(element);
    return {
      backgroundColor: styles.backgroundColor,
      color: styles.color
    };
  });

  return {
    ratio: contrastRatio(parseRgb(color), parseRgb(backgroundColor)),
    backgroundColor,
    color
  };
}

export async function assertInputContrast(page: Page, selector: string, minRatio = 4.5): Promise<void> {
  await assertAllInputsContrast(page, selector, minRatio);
}

export async function assertAllInputsContrast(
  page: Page,
  selector: string,
  minRatio = 4.5
): Promise<void> {
  const inputs = page.locator(selector);
  const count = await inputs.count();
  expect(count, `Brak elementów dla selektora ${selector}`).toBeGreaterThan(0);

  for (let index = 0; index < count; index += 1) {
    const input = inputs.nth(index);
    await expect(input).toBeVisible();
    const { ratio, backgroundColor, color } = await readContrast(input);
    expect(
      ratio,
      `${selector}[${index}] contrast ${ratio.toFixed(2)} (bg: ${backgroundColor}, color: ${color})`
    ).toBeGreaterThanOrEqual(minRatio);
  }
}

export async function assertLocatorContrast(locator: Locator, minRatio = 4.5): Promise<void> {
  await expect(locator).toBeVisible();
  const { ratio, backgroundColor, color } = await readContrast(locator);
  expect(ratio, `contrast ${ratio.toFixed(2)} (bg: ${backgroundColor}, color: ${color})`).toBeGreaterThanOrEqual(
    minRatio
  );
}
