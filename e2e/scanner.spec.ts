import { test, expect } from "@playwright/test";
import { LEGACY_PRODUCTS } from "../src/lib/scanner";

const sampleEan = LEGACY_PRODUCTS[0]?.ean ?? "5902983494492";

test.describe("skaner EAN", () => {
  test("desktop — wpisanie kodu pokazuje wynik", async ({ page }) => {
    await page.goto("/sprzedaz/skanuj");
    await page.waitForSelector("#eanInput", { timeout: 15_000 });

    await page.fill("#eanInput", sampleEan);
    await page.getByRole("button", { name: "Sprawdź" }).click();

    await expect(page.locator(".result-card.found")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".result-title")).not.toBeEmpty();
  });

  test("mobile PWA — strona skanera aparatu się ładuje", async ({ page }) => {
    await page.goto("/sprzedaz/skanuj/aparat");
    await expect(page.locator(".mobile-scanner-page__title")).toHaveText("Skanuj aparatem");
    await expect(page.getByRole("link", { name: "Pełny widok" })).toBeVisible();
  });

  test("desktop — nieprawidłowy EAN pokazuje błąd", async ({ page }) => {
    await page.goto("/sprzedaz/skanuj");
    await page.waitForSelector("#eanInput", { timeout: 15_000 });

    await page.fill("#eanInput", "123");
    await page.getByRole("button", { name: "Sprawdź" }).click();

    await expect(page.locator(".result-card.not-found")).toBeVisible();
    await expect(page.locator(".not-found-msg")).toContainText("13-cyfrowy");
  });
});
