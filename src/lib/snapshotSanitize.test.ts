import { describe, expect, it } from "vitest";
import { sanitizeStockOverrides } from "./snapshotSanitize";

describe("sanitizeStockOverrides", () => {
  it("normalizuje klucze EAN i odrzuca niepoprawne wpisy", () => {
    expect(
      sanitizeStockOverrides({
        "5902983494492": 5,
        "590-298-3494492": 2,
        "abc": 9,
        "123": 4
      })
    ).toEqual({
      "5902983494492": 2
    });
  });

  it("zaokrągla w dół ujemne wartości do zera", () => {
    expect(sanitizeStockOverrides({ "5902983494492": -3.7 })).toEqual({
      "5902983494492": 0
    });
  });

  it("zwraca pusty obiekt dla nieobiektowych danych", () => {
    expect(sanitizeStockOverrides(null)).toEqual({});
    expect(sanitizeStockOverrides("x")).toEqual({});
  });
});
