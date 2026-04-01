import { useEffect, useMemo } from "react";
import { isFirebaseConfigured } from "../lib/firebase";
import { useAppStore } from "../store/useAppStore";

export function useLocalSaveFeedback(): void {
  const setSyncStatus = useAppStore((state) => state.setSyncStatus);
  const stockOverrides = useAppStore((state) => state.stockOverrides);
  const inventoryCounts = useAppStore((state) => state.inventoryCounts);
  const inventoryVerified = useAppStore((state) => state.inventoryVerified);
  const bistroProducts = useAppStore((state) => state.bistroProducts);

  const signature = useMemo(
    () =>
      JSON.stringify({
        stockOverrides,
        inventoryCounts,
        inventoryVerified,
        bistroProducts
      }),
    [stockOverrides, inventoryCounts, inventoryVerified, bistroProducts]
  );

  useEffect(() => {
    if (isFirebaseConfigured) return;

    setSyncStatus("saving", "· lokalnie");

    const timer = window.setTimeout(() => {
      setSyncStatus("saved", "· lokalnie");
    }, 250);

    return () => window.clearTimeout(timer);
  }, [setSyncStatus, signature]);
}