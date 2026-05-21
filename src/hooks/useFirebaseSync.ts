import { onValue, ref, set } from "firebase/database";
import { useEffect, useMemo, useRef } from "react";
import { database, firebasePath, isFirebaseConfigured } from "../lib/firebase";
import { useAppStore } from "../store/useAppStore";
import type { RemoteSnapshot } from "../types/app";

export function useFirebaseSync(isAuthenticated: boolean): void {
  const stockOverrides = useAppStore((state) => state.stockOverrides);
  const priceOverrides = useAppStore((state) => state.priceOverrides);
  const priceEntries = useAppStore((state) => state.priceEntries);
  const inventoryCounts = useAppStore((state) => state.inventoryCounts);
  const inventoryVerified = useAppStore((state) => state.inventoryVerified);
  const bistroProducts = useAppStore((state) => state.bistroProducts);
  const setSyncStatus = useAppStore((state) => state.setSyncStatus);
  const hydrateRemoteSnapshot = useAppStore((state) => state.hydrateRemoteSnapshot);

  const snapshot = useMemo<RemoteSnapshot>(
    () => ({
      stock: { overrides: stockOverrides },
      prices: { overrides: priceOverrides, entries: priceEntries },
      inventory: { counts: inventoryCounts, verified: inventoryVerified },
      bistro: { products: bistroProducts },
      updatedAt: Date.now()
    }),
    [bistroProducts, inventoryCounts, inventoryVerified, priceEntries, priceOverrides, stockOverrides]
  );

  const isHydratingRef = useRef(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    const db = database;

    if (!isFirebaseConfigured || !db || !isAuthenticated) {
      setSyncStatus("saved", isFirebaseConfigured ? "· offline" : "· lokalnie");
      return;
    }

    const snapshotRef = ref(db, firebasePath);

    const unsubscribe = onValue(snapshotRef, (firebaseSnapshot) => {
      const data = firebaseSnapshot.val() as RemoteSnapshot | null;

      if (!data) {
        initializedRef.current = true;
        setSyncStatus("saved", "· Firebase");
        return;
      }

      isHydratingRef.current = true;
      hydrateRemoteSnapshot(data);
      initializedRef.current = true;
      setSyncStatus("synced", "· Firebase");

      window.setTimeout(() => {
        isHydratingRef.current = false;
      }, 0);
    });

    return () => unsubscribe();
  }, [hydrateRemoteSnapshot, isAuthenticated, setSyncStatus]);

  useEffect(() => {
    const db = database;

    if (
      !isFirebaseConfigured ||
      !db ||
      !isAuthenticated ||
      !initializedRef.current ||
      isHydratingRef.current
    ) {
      return;
    }

    setSyncStatus("saving", "· Firebase");

    const timer = window.setTimeout(() => {
      void set(ref(db, firebasePath), snapshot)
        .then(() => setSyncStatus("synced", "· Firebase"))
        .catch(() => setSyncStatus("offline", "· offline"));
    }, 800);

    return () => window.clearTimeout(timer);
  }, [isAuthenticated, setSyncStatus, snapshot]);
}
