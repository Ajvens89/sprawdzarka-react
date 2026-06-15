import { describe, expect, it } from "vitest";
import { isValidEan13, LEGACY_PRODUCTS, lookupEanInCatalog } from "./scanner";

describe("isValidEan13", () => {
  it("akceptuje poprawny kod z katalogu", () => {
    expect(isValidEan13(LEGACY_PRODUCTS[0].ean)).toBe(true);
  });

  it("odrzuca błędną sumę kontrolną", () => {
    expect(isValidEan13("5900000000000")).toBe(false);
  });
});

describe("lookupEanInCatalog", () => {
  const sample = LEGACY_PRODUCTS[0];

  it("znajduje produkt po poprawnym EAN", () => {
    expect(lookupEanInCatalog(sample.ean, LEGACY_PRODUCTS)).toEqual({
      type: "found",
      product: sample
    });
  });

  it("normalizuje wpisany kod", () => {
    const formatted = `${sample.ean.slice(0, 3)}-${sample.ean.slice(3)}`;
    const result = lookupEanInCatalog(formatted, LEGACY_PRODUCTS);
    expect(result.type).toBe("found");
  });

  it("zwraca invalid dla błędnej sumy kontrolnej", () => {
    expect(lookupEanInCatalog("5900000000000", LEGACY_PRODUCTS)).toEqual({ type: "invalid" });
  });

  it("zwraca not_found dla poprawnego, ale nieznanego kodu", () => {
    expect(lookupEanInCatalog("5900000000008", LEGACY_PRODUCTS)).toEqual({
      type: "not_found",
      ean: "5900000000008"
    });
  });
});
