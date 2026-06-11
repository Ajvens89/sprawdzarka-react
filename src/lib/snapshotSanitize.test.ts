import { describe, expect, it } from "vitest";
import {
  sanitizeInventoryCounts,
  sanitizePriceEntries,
  sanitizePriceOverrides,
  sanitizePurchaseCosts,
  sanitizeStockOverrides
} from "./snapshotSanitize";

describe("sanitizeStockOverrides", () => {
  it("normalizuje klucze EAN i odrzuca niepoprawne wpisy", () => {
    expect(
      sanitizeStockOverrides({
        "5902983494492": 5,
        "590-298-3494492": 2,
        abc: 9,
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

describe("sanitizePriceOverrides", () => {
  it("odrzuca niepoprawne EAN i ceny <= 0", () => {
    expect(
      sanitizePriceOverrides({
        "5902983494492": 19.99,
        abc: 10,
        "1234567890123": 0
      })
    ).toEqual({
      "5902983494492": 19.99
    });
  });
});

describe("sanitizePurchaseCosts", () => {
  it("dopuszcza koszt zero", () => {
    expect(sanitizePurchaseCosts({ "5902983494492": 0 })).toEqual({
      "5902983494492": 0
    });
  });
});

describe("sanitizePriceEntries", () => {
  it("zachowuje wpisy z danymi rynkowymi", () => {
    expect(
      sanitizePriceEntries({
        "5902983494492": {
          marketPrice: "29.99",
          source: "test",
          checkedAt: "2026-01-01T10:00:00.000Z"
        }
      })
    ).toEqual({
      "5902983494492": {
        marketPrice: "29.99",
        source: "test",
        checkedAt: "2026-01-01T10:00:00.000Z",
        status: undefined
      }
    });
  });
});

describe("sanitizeInventoryCounts", () => {
  it("normalizuje ilości inwentaryzacji", () => {
    expect(sanitizeInventoryCounts({ "590-298-3494492": 4.9 })).toEqual({
      "5902983494492": 4
    });
  });
});
