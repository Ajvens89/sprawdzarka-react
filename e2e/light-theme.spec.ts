import { test } from "@playwright/test";
import { assertInputContrast } from "./helpers/contrast";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("sprawdzarka-theme", "light");
  });
});

test.describe("jasny motyw — czytelność pól", () => {
  test("Bistro — pola wsadu i wyniku", async ({ page }) => {
    await page.goto("/sprzedaz/bistro");
    await page.waitForSelector(".bp-input", { timeout: 15_000 });
    await assertInputContrast(page, ".bp-input");
  });

  test("Ceny rynkowe — ustawienia tolerancji", async ({ page }) => {
    await page.goto("/ceny/rynek");
    await page.waitForSelector(".price-advisor-setting input[type='number']", { timeout: 15_000 });
    await assertInputContrast(page, ".price-advisor-setting input[type='number']");
  });

  test("Koszty i marże — pola numeryczne w tabeli", async ({ page }) => {
    await page.goto("/ceny/koszty");
    await page.waitForSelector(".price-advisor-setting input[type='number']", { timeout: 15_000 });
    await assertInputContrast(page, ".price-advisor-setting input[type='number']");
  });
});
