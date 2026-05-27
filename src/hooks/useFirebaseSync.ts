import { onValue, ref, runTransaction } from "firebase/database";
import { useEffect, useMemo, useRef } from "react";
import { database, firebasePath, isFirebaseConfigured } from "../lib/firebase";
import { mergeRemoteSnapshots } from "../lib/mergeRemoteSnapshot";
import { useAppStore } from "../store/useAppStore";
import type { RemoteSnapshot } from "../types/app";

const PUSH_RETRY_MS = 5000;

export function useFirebaseSync(isAuthenticated: boolean): void {
  const stockOverrides = useAppStore((state) => state.stockOverrides);
  const priceOverrides = useAppStore((state) => state.priceOverrides);
  const purchaseCosts = useAppStore((state) => state.purchaseCosts);
  const purchaseVatRates = useAppStore((state) => state.purchaseVatRates);
  const priceEntries = useAppStore((state) => state.priceEntries);
  const inventoryCounts = useAppStore((state) => state.inventoryCounts);
  const inventoryVerified = useAppStore((state) => state.inventoryVerified);
  const bistroProducts = useAppStore((state) => state.bistroProducts);
  const localDataVersion = useAppStore((state) => state.localDataVersion);
  const setSyncStatus = useAppStore((state) => state.setSyncStatus);
  const hydrateRemoteSnapshot = useAppStore((state) => state.hydrateRemoteSnapshot);
  const acknowledgeSync = useAppStore((state) => state.acknowledgeSync);

  const payload = useMemo<Omit<RemoteSnapshot, "updatedAt">>(
    () => ({
      stock: { overrides: stockOverrides },
      prices: { overrides: priceOverrides, entries: priceEntries },
      costs: { purchase: purchaseCosts, vat: purchaseVatRates },
      inventory: { counts: inventoryCounts, verified: inventoryVerified },
      bistro: { products: bistroProducts }
    }),
    [bistroProducts, inventoryCounts, inventoryVerified, priceEntries, priceOverrides, purchaseCosts, purchaseVatRates, stockOverrides]
  );

  const dataSignature = useMemo(() => JSON.stringify(payload), [payload]);

  const isHydratingRef = useRef(false);
  const initializedRef = useRef(false);
  const remoteVersionRef = useRef(0);
  const pushInFlightRef = useRef(false);
  const retryTimerRef = useRef<number | null>(null);
  const localVersionRef = useRef(localDataVersion);
  const payloadRef = useRef(payload);

  useEffect(() => {
    payloadRef.current = payload;
  }, [payload]);

  useEffect(() => {
    localVersionRef.current = localDataVersion;
  }, [localDataVersion]);

  useEffect(() => {
    const db = database;

    if (!isFirebaseConfigured || !db || !isAuthenticated) {
      initializedRef.current = false;
      remoteVersionRef.current = 0;
      setSyncStatus("saved", isFirebaseConfigured ? "· offline" : "· lokalnie");
      return;
    }

    const snapshotRef = ref(db, firebasePath);

    const unsubscribe = onValue(
      snapshotRef,
      (firebaseSnapshot) => {
        const data = firebaseSnapshot.val() as RemoteSnapshot | null;
        const remoteVersion = data?.updatedAt ?? 0;

        if (!data) {
          initializedRef.current = true;
          setSyncStatus("saved", "· Firebase");
          return;
        }

        remoteVersionRef.current = remoteVersion;

        if (remoteVersion > localVersionRef.current) {
          isHydratingRef.current = true;
          const mergedUpdatedAt = Math.max(remoteVersion, localVersionRef.current) + 1;
          const merged = mergeRemoteSnapshots(data, payloadRef.current, mergedUpdatedAt);
          hydrateRemoteSnapshot(merged);
          localVersionRef.current = mergedUpdatedAt;

          window.setTimeout(() => {
            isHydratingRef.current = false;
          }, 0);
        }

        initializedRef.current = true;
      },
      () => {
        setSyncStatus("offline", "· offline");
      }
    );

    const initFallback = window.setTimeout(() => {
      initializedRef.current = true;
    }, 2500);

    return () => {
      window.clearTimeout(initFallback);
      unsubscribe();
    };
  }, [acknowledgeSync, hydrateRemoteSnapshot, isAuthenticated, setSyncStatus]);

  useEffect(() => {
    const db = database;

    const clearRetryTimer = (): void => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    const pushSnapshot = (): void => {
      if (!db || pushInFlightRef.current) return;

      if (localVersionRef.current <= remoteVersionRef.current) {
        setSyncStatus("synced", "· Firebase");
        return;
      }

      setSyncStatus("saving", "· Firebase");
      pushInFlightRef.current = true;

      void runTransaction(ref(db, firebasePath), (current) => {
        const currentSnapshot = (current ?? null) as RemoteSnapshot | null;
        const currentVersion = currentSnapshot?.updatedAt ?? 0;

        if (localVersionRef.current <= currentVersion) {
          return;
        }

        return mergeRemoteSnapshots(currentSnapshot, payloadRef.current);
      })
        .then((result) => {
          if (!result.committed) {
            remoteVersionRef.current = Math.max(
              remoteVersionRef.current,
              (result.snapshot.val() as RemoteSnapshot | null)?.updatedAt ?? 0
            );

            if (localVersionRef.current > remoteVersionRef.current) {
              setSyncStatus("offline", "· offline — ponawiam zapis");
              clearRetryTimer();
              retryTimerRef.current = window.setTimeout(pushSnapshot, PUSH_RETRY_MS);
            } else {
              setSyncStatus("synced", "· Firebase");
            }
            return;
          }

          const merged = result.snapshot.val() as RemoteSnapshot;
          const updatedAt = merged.updatedAt ?? Date.now();
          remoteVersionRef.current = updatedAt;
          localVersionRef.current = updatedAt;
          acknowledgeSync(updatedAt);
          setSyncStatus("synced", "· Firebase");
          clearRetryTimer();
        })
        .catch(() => {
          setSyncStatus("offline", "· offline — ponawiam zapis");
          clearRetryTimer();
          retryTimerRef.current = window.setTimeout(pushSnapshot, PUSH_RETRY_MS);
        })
        .finally(() => {
          pushInFlightRef.current = false;
        });
    };

    if (
      !isFirebaseConfigured ||
      !db ||
      !isAuthenticated ||
      !initializedRef.current ||
      isHydratingRef.current
    ) {
      return clearRetryTimer;
    }

    if (localDataVersion <= remoteVersionRef.current) {
      setSyncStatus("synced", "· Firebase");
      return clearRetryTimer;
    }

    const timer = window.setTimeout(pushSnapshot, 800);

    return () => {
      window.clearTimeout(timer);
      clearRetryTimer();
    };
  }, [acknowledgeSync, dataSignature, isAuthenticated, localDataVersion, setSyncStatus]);
}
