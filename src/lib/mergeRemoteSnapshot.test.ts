import { describe, expect, it } from "vitest";
import { mergeRemoteSnapshots, remoteHasMoreRecords, shouldPullRemoteSnapshot } from "./mergeRemoteSnapshot";
import type { RemoteSnapshot } from "../types/app";

describe("remoteHasMoreRecords", () => {
  it("wykrywa bogatszy zdalny snapshot", () => {
    expect(remoteHasMoreRecords({ a: 1, b: 2 }, { a: 1 })).toBe(true);
    expect(remoteHasMoreRecords({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
});

describe("shouldPullRemoteSnapshot", () => {
  const local: Omit<RemoteSnapshot, "updatedAt"> = {
    stock: { overrides: { "5902983494492": 1 } },
    prices: { overrides: {}, entries: {} },
    costs: { purchase: {}, vat: {} },
    inventory: { counts: {}, verified: {} },
    bistro: { products: [] }
  };

  it("pobiera gdy zdalna wersja jest nowsza", () => {
    const remote: RemoteSnapshot = { ...local, updatedAt: 5000 };
    expect(shouldPullRemoteSnapshot(remote, 1000, local)).toBe(true);
  });

  it("pobiera gdy zdalne koszty mają więcej wpisów", () => {
    const remote: RemoteSnapshot = {
      ...local,
      costs: { purchase: { "5902983494492": 10 }, vat: {} },
      updatedAt: 1000
    };
    expect(shouldPullRemoteSnapshot(remote, 2000, local)).toBe(true);
  });
});

describe("mergeRemoteSnapshots", () => {
  it("lokalne mapy wygrywają przy konflikcie klucza", () => {
    const remote: RemoteSnapshot = {
      stock: { overrides: { "5902983494492": 1 } },
      prices: { overrides: {}, entries: {} },
      costs: { purchase: { "5902983494492": 5 }, vat: {} },
      inventory: { counts: {}, verified: {} },
      bistro: { products: [] },
      updatedAt: 1000
    };

    const local: Omit<RemoteSnapshot, "updatedAt"> = {
      stock: { overrides: { "5902983494492": 9 } },
      prices: { overrides: {}, entries: {} },
      costs: { purchase: { "5902983494492": 12 }, vat: {} },
      inventory: { counts: {}, verified: {} },
      bistro: { products: [] }
    };

    const merged = mergeRemoteSnapshots(remote, local, 2000);
    expect(merged.stock?.overrides?.["5902983494492"]).toBe(9);
    expect(merged.costs?.purchase?.["5902983494492"]).toBe(12);
    expect(merged.updatedAt).toBe(2000);
  });

  it("scala zakupy bistro po id", () => {
    const merged = mergeRemoteSnapshots(
      {
        bistro: {
          products: [
            {
              id: "popcorn",
              name: "Popcorn",
              batchUnit: "g",
              portionQty: 100,
              portionPrice: 7,
              soldQty: 1,
              purchases: [{ id: "p1", date: "2026-01-01", qty: 1000, cost: 10, note: "" }]
            }
          ]
        },
        stock: { overrides: {} },
        prices: { overrides: {}, entries: {} },
        costs: { purchase: {}, vat: {} },
        inventory: { counts: {}, verified: {} },
        updatedAt: 1000
      },
      {
        bistro: {
          products: [
            {
              id: "popcorn",
              name: "Popcorn",
              batchUnit: "g",
              portionQty: 100,
              portionPrice: 7,
              soldQty: 3,
              purchases: [{ id: "p2", date: "2026-01-02", qty: 500, cost: 6, note: "dokup" }]
            }
          ]
        },
        stock: { overrides: {} },
        prices: { overrides: {}, entries: {} },
        costs: { purchase: {}, vat: {} },
        inventory: { counts: {}, verified: {} }
      }
    );

    const product = merged.bistro?.products?.find((item) => item.id === "popcorn");
    expect(product?.soldQty).toBe(3);
    expect(product?.purchases.map((purchase) => purchase.id).sort()).toEqual(["p1", "p2"]);
  });
});
