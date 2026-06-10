import { describe, expect, it } from "vitest";
import { APP_MODULES, findModuleByPath, LEGACY_ROUTE_REDIRECTS } from "./modules";

describe("LEGACY_ROUTE_REDIRECTS", () => {
  it("mapuje stare ścieżki magazynu na sprzedaż", () => {
    expect(LEGACY_ROUTE_REDIRECTS["/scanner"]).toBe("/sprzedaz/skanuj");
    expect(LEGACY_ROUTE_REDIRECTS["/magazyn/skanuj"]).toBe("/sprzedaz/skanuj");
    expect(LEGACY_ROUTE_REDIRECTS["/magazyn/produkty"]).toBe("/sprzedaz/produkty");
    expect(LEGACY_ROUTE_REDIRECTS["/magazyn/inwentaryzacja"]).toBe("/sprzedaz/inwentaryzacja");
  });

  it("mapuje stare moduły biznesowe", () => {
    expect(LEGACY_ROUTE_REDIRECTS["/bistro"]).toBe("/sprzedaz/bistro");
    expect(LEGACY_ROUTE_REDIRECTS["/orders"]).toBe("/sprzedaz/kasa");
    expect(LEGACY_ROUTE_REDIRECTS["/admin"]).toBe("/ceny/koszty");
    expect(LEGACY_ROUTE_REDIRECTS["/client-export"]).toBe("/raporty/klient");
  });
});

describe("findModuleByPath", () => {
  it("przypisuje trasy sprzedaży do modułu sprzedaz", () => {
    expect(findModuleByPath("/sprzedaz/skanuj")?.id).toBe("sprzedaz");
    expect(findModuleByPath("/sprzedaz/bistro")?.id).toBe("sprzedaz");
    expect(findModuleByPath("/sprzedaz/kasa")?.id).toBe("sprzedaz");
  });

  it("rozróżnia pozostałe moduły", () => {
    expect(findModuleByPath("/ceny/rynek")?.id).toBe("ceny");
    expect(findModuleByPath("/raporty/klient")?.id).toBe("raporty");
    expect(findModuleByPath("/ustawienia")?.id).toBe("ustawienia");
  });

  it("zwraca undefined dla nieznanego prefiksu", () => {
    expect(findModuleByPath("/nieistnieje/strona")).toBeUndefined();
  });
});

describe("APP_MODULES", () => {
  it("ma 4 moduły główne bez osobnego magazynu", () => {
    expect(APP_MODULES).toHaveLength(4);
    expect(APP_MODULES.map((module) => module.id)).toEqual(["sprzedaz", "ceny", "raporty", "ustawienia"]);
  });

  it("grupuje gry i bistro w sprzedaży", () => {
    const sprzedaz = APP_MODULES.find((module) => module.id === "sprzedaz");
    expect(sprzedaz?.links.some((link) => link.section === "Gry")).toBe(true);
    expect(sprzedaz?.links.some((link) => link.section === "Bistro")).toBe(true);
    expect(sprzedaz?.links.some((link) => link.label === "Koszty i marże")).toBe(false);
  });

  it("ma ikony w podmenu cen", () => {
    const ceny = APP_MODULES.find((module) => module.id === "ceny");
    expect(ceny?.links.every((link) => Boolean(link.icon))).toBe(true);
  });
});
