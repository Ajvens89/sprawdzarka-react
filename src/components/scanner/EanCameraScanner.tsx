import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeEAN } from "../../lib/utils";

type ScannerStatus = "idle" | "starting" | "active" | "paused" | "error" | "unsupported";

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

const BARCODE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];
const SCAN_COOLDOWN_MS = 1800;

function extractEan(raw: string): string | null {
  const normalized = normalizeEAN(raw);
  return /^\d{13}$/.test(normalized) ? normalized : null;
}

export function EanCameraScanner({
  onScan,
  paused = false
}: {
  onScan: (ean: string) => void;
  paused?: boolean;
}): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastScanRef = useRef({ ean: "", at: 0 });
  const onScanRef = useRef(onScan);

  onScanRef.current = onScan;

  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const emitScan = useCallback((raw: string) => {
    const ean = extractEan(raw);
    if (!ean) return;

    const now = Date.now();
    if (lastScanRef.current.ean === ean && now - lastScanRef.current.at < SCAN_COOLDOWN_MS) {
      return;
    }

    lastScanRef.current = { ean, at: now };
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(35);
    }
    onScanRef.current(ean);
  }, []);

  useEffect(() => {
    if (paused) {
      setStatus("paused");
      return undefined;
    }

    let cancelled = false;

    const stopStream = (): void => {
      controlsRef.current?.stop();
      controlsRef.current = null;

      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;

      const video = videoRef.current;
      if (video) {
        video.srcObject = null;
      }
    };

    async function startNativeDetector(video: HTMLVideoElement, detector: BarcodeDetectorLike): Promise<void> {
      const tick = async (): Promise<void> => {
        if (cancelled) return;

        try {
          const barcodes = await detector.detect(video);
          if (cancelled) return;

          for (const barcode of barcodes) {
            if (barcode.rawValue) emitScan(barcode.rawValue);
          }
        } catch {
          // Pomijamy klatki, w których detekcja chwilowo nie zadziałała.
        }

        if (cancelled) return;

        frameRef.current = requestAnimationFrame(() => {
          void tick();
        });
      };

      frameRef.current = requestAnimationFrame(() => {
        void tick();
      });
    }

    async function start(): Promise<void> {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (cancelled) return;
        setStatus("unsupported");
        setErrorMessage("Ta przeglądarka nie udostępnia aparatu. Użyj Chrome na Androidzie lub Safari na iPhone.");
        return;
      }

      setStatus("starting");
      setErrorMessage("");

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) throw new Error("Brak elementu wideo.");

        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        await video.play();

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        if (window.BarcodeDetector) {
          const detector = new window.BarcodeDetector({ formats: BARCODE_FORMATS });
          await startNativeDetector(video, detector);
          if (cancelled) return;
          setStatus("active");
          return;
        }

        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        controlsRef.current = await reader.decodeFromStream(stream, video, (result) => {
          if (cancelled || !result) return;
          emitScan(result.getText());
        });

        if (cancelled) return;
        setStatus("active");
      } catch (error) {
        if (cancelled) return;
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Nie udało się uruchomić aparatu. Sprawdź uprawnienia kamery."
        );
      }
    }

    void start();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [emitScan, paused]);

  return (
    <div className="ean-camera-scanner">
      <div className="ean-camera-scanner__viewport">
        <video ref={videoRef} className="ean-camera-scanner__video" muted playsInline aria-hidden="true" />
        <div className="ean-camera-scanner__reticle" aria-hidden="true" />
        {status === "starting" ? <div className="ean-camera-scanner__overlay">Uruchamiam aparat…</div> : null}
        {status === "error" || status === "unsupported" ? (
          <div className="ean-camera-scanner__overlay ean-camera-scanner__overlay--error" role="alert">
            {errorMessage}
          </div>
        ) : null}
      </div>
      <p className="ean-camera-scanner__hint">
        {status === "active"
          ? "Skieruj kod kreskowy EAN w ramkę. Skan nastąpi automatycznie."
          : status === "paused"
            ? "Aparat wstrzymany. Wznów skanowanie przyciskiem poniżej."
            : "Wymagane HTTPS i zgoda na dostęp do aparatu."}
      </p>
    </div>
  );
}

export function isCameraScannerSupported(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}
