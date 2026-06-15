import { useRef, useState } from "react";
import { DEFAULT_PRICE_CACHE_HOURS, isPriceEntryFresh } from "../../../lib/priceCheckCache";
import { fetchOnlinePrice, PriceCheckError } from "../../../lib/priceCheck";
import { sleep } from "../../../lib/marketPriceCompare";
import { useAppStore } from "../../../store/useAppStore";
import type { Product } from "../../../types/app";

function productTitle(product: Product): string {
  const record = product as unknown as Record<string, unknown>;
  const title = Object.entries(record).find(([key]) => key !== "ean" && key !== "cena")?.[1];
  return String(title ?? "");
}

export function useMarketPriceBatch(inStockProducts: Product[]) {
  const setPriceEntry = useAppStore((state) => state.setPriceEntry);
  const [compareProgress, setCompareProgress] = useState<{ done: number; total: number } | null>(null);
  const [compareStatus, setCompareStatus] = useState<{ type: "info" | "success" | "error"; message: string } | null>(
    null
  );
  const [skipFreshPrices, setSkipFreshPrices] = useState(true);
  const [forceRefreshPrices, setForceRefreshPrices] = useState(false);
  const compareCancelRef = useRef(false);

  const compareRunningRef = useRef(false);

  async function compareInStockPrices(): Promise<void> {
    if (compareRunningRef.current || compareProgress !== null) {
      return;
    }

    if (inStockProducts.length === 0) {
      setCompareStatus({ type: "error", message: "Brak produktów ze stanem większym niż 0." });
      return;
    }

    const latestEntries = useAppStore.getState().priceEntries;
    const productsToCheck = inStockProducts.filter((product) => {
      if (forceRefreshPrices) return true;
      if (!skipFreshPrices) return true;
      return !isPriceEntryFresh(latestEntries[product.ean], DEFAULT_PRICE_CACHE_HOURS);
    });
    const skippedFresh = inStockProducts.length - productsToCheck.length;

    if (productsToCheck.length === 0) {
      setCompareStatus({
        type: "info",
        message: `Wszystkie ${inStockProducts.length} produkty ze stanem mają świeże ceny (młodsze niż ${DEFAULT_PRICE_CACHE_HOURS} h).`
      });
      return;
    }

    if (
      !window.confirm(
        `Sprawdzę ceny online dla ${productsToCheck.length} produktów` +
          (skippedFresh > 0 ? ` (pominięto ${skippedFresh} ze świeżą ceną)` : "") +
          `. Kontynuować?`
      )
    ) {
      return;
    }

    setCompareStatus(null);
    setCompareProgress({ done: 0, total: productsToCheck.length });
    compareCancelRef.current = false;
    compareRunningRef.current = true;

    let checked = 0;
    let found = 0;
    let errors = 0;
    let cached = 0;

    try {
      for (let index = 0; index < productsToCheck.length; index += 1) {
        if (compareCancelRef.current) break;

        const product = productsToCheck[index];
        const previousEntry = useAppStore.getState().priceEntries[product.ean];

        try {
          const result = await fetchOnlinePrice({
            ean: product.ean,
            title: productTitle(product),
            currentPrice: product.cena,
            force: forceRefreshPrices
          });

          if (result.price) {
            found += 1;
            if (result.cached) cached += 1;
          } else {
            errors += 1;
          }

          setPriceEntry(product.ean, {
            marketPrice: result.price ? result.price.toFixed(2).replace(".", ",") : previousEntry?.marketPrice ?? "",
            source: result.source || previousEntry?.source || "",
            checkedAt: new Date().toLocaleString("pl-PL"),
            status: result.message
          });
        } catch (error) {
          errors += 1;
          const message =
            error instanceof PriceCheckError
              ? error.payload.message
              : "Błąd połączenia ze sprawdzaniem cen online.";
          setPriceEntry(product.ean, {
            marketPrice: previousEntry?.marketPrice ?? "",
            source: previousEntry?.source ?? "",
            checkedAt: new Date().toLocaleString("pl-PL"),
            status: message
          });
        }

        checked += 1;
        setCompareProgress({ done: checked, total: productsToCheck.length });

        if (index < productsToCheck.length - 1 && !compareCancelRef.current) {
          await sleep(900);
        }
      }

      const wasCancelled = compareCancelRef.current;
      setCompareStatus({
        type: wasCancelled ? "info" : "success",
        message: wasCancelled
          ? `Przerwano po ${checked} z ${productsToCheck.length}. Znaleziono: ${found}, błędy: ${errors}.`
          : `Sprawdzono ${checked}. Znaleziono: ${found}, błędy: ${errors}, cache: ${cached}, pominięto: ${skippedFresh}.`
      });
    } finally {
      setCompareProgress(null);
      compareRunningRef.current = false;
    }
  }

  function cancelCompareInStockPrices(): void {
    compareCancelRef.current = true;
  }

  return {
    compareProgress,
    compareStatus,
    setCompareStatus,
    skipFreshPrices,
    setSkipFreshPrices,
    forceRefreshPrices,
    setForceRefreshPrices,
    compareInStockPrices,
    cancelCompareInStockPrices
  };
}
