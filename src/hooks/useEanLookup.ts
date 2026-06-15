import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getResolvedProducts, lookupEanInCatalog } from "../lib/scanner";
import type { Product } from "../types/app";
import { useAppStore } from "../store/useAppStore";

export type EanResultState =
  | { type: "idle" }
  | { type: "found"; product: Product }
  | { type: "error"; title: string; message: string };

export type RecentEanScan = {
  ean: string;
  title: string;
  at: number;
};

type UseEanLookupOptions = {
  /** Gdy true, pusty input zwraca błąd zamiast idle (widok desktop). */
  emptyAsError?: boolean;
  maxRecent?: number;
};

function productTitle(product: Product): string {
  return product.tytuł;
}

function toResultState(
  lookup: ReturnType<typeof lookupEanInCatalog>,
  emptyAsError: boolean
): EanResultState {
  switch (lookup.type) {
    case "empty":
      return emptyAsError
        ? {
            type: "error",
            title: "✗ Brak kodu",
            message: "Wpisz 13-cyfrowy kod EAN."
          }
        : { type: "idle" };
    case "invalid":
      return {
        type: "error",
        title: "✗ Nieprawidłowy kod",
        message: "Wpisz poprawny 13-cyfrowy kod EAN."
      };
    case "not_found":
      return {
        type: "error",
        title: "✗ Nie znaleziono",
        message: `Kod EAN ${lookup.ean} nie istnieje w bazie produktów z targów.`
      };
    case "found":
      return { type: "found", product: lookup.product };
  }
}

export function useEanLookup(options: UseEanLookupOptions = {}) {
  const { emptyAsError = false, maxRecent = 5 } = options;
  const priceOverrides = useAppStore((state) => state.priceOverrides);
  const products = useMemo(() => getResolvedProducts(priceOverrides), [priceOverrides]);
  const productsRef = useRef(products);

  productsRef.current = products;

  const [result, setResult] = useState<EanResultState>({ type: "idle" });
  const [recentScans, setRecentScans] = useState<RecentEanScan[]>([]);

  useEffect(() => {
    if (result.type !== "found") return;

    const refreshedProduct = products.find((item) => item.ean === result.product.ean);
    if (refreshedProduct && refreshedProduct.cena !== result.product.cena) {
      setResult({ type: "found", product: refreshedProduct });
    }
  }, [products, result]);

  const lookup = useCallback(
    (raw: string) => {
      const lookupResult = lookupEanInCatalog(raw, productsRef.current);
      setResult(toResultState(lookupResult, emptyAsError));

      if (lookupResult.type === "found") {
        setRecentScans((current) => {
          const next = [
            { ean: lookupResult.product.ean, title: productTitle(lookupResult.product), at: Date.now() },
            ...current.filter((item) => item.ean !== lookupResult.product.ean)
          ];
          return next.slice(0, maxRecent);
        });
      }

      return lookupResult;
    },
    [emptyAsError, maxRecent]
  );

  const clearResult = useCallback(() => {
    setResult({ type: "idle" });
  }, []);

  return {
    result,
    setResult,
    clearResult,
    recentScans,
    lookup,
    products
  };
}
