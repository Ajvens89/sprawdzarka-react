import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { checkOnlinePrice, getCachedPriceCheck, setCachedPriceCheck } from "./functions/priceCheckLogic.js";

function env(name: string): string {
  const runtime = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };
  return runtime.process?.env?.[name] ?? "";
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "pwa-192x192.png", "pwa-512x512.png", "apple-touch-icon.png"],
      manifest: {
        name: "Sprawdzarka ZF — Skaner",
        short_name: "Skaner ZF",
        description: "Szybkie skanowanie kodów EAN na targach",
        theme_color: "#6d28d9",
        background_color: "#f8fafc",
        display: "standalone",
        orientation: "portrait",
        start_url: "/sprzedaz/skanuj/aparat",
        scope: "/",
        lang: "pl",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          },
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024
      }
    }),
    {
      name: "sprawdzarka-price-check-api",
      configureServer(server) {
        server.middlewares.use("/api/price-check", async (req, res) => {
          const requestUrl = new URL(req.url ?? "", "http://localhost");
          const ean = String(requestUrl.searchParams.get("ean") ?? "").replace(/\D/g, "").slice(0, 13);
          const title = requestUrl.searchParams.get("title") ?? "";
          const currentPrice = Number(requestUrl.searchParams.get("currentPrice") ?? 0);
          const forceRefresh = requestUrl.searchParams.get("force") === "1";

          res.setHeader("Content-Type", "application/json; charset=utf-8");

          if (!/^\d{13}$/.test(ean) || !title) {
            res.statusCode = 400;
            res.end(
              JSON.stringify({
                ok: false,
                price: null,
                source: "",
                message: "Brakuje EAN albo nazwy produktu."
              })
            );
            return;
          }

          if (!forceRefresh) {
            const cached = getCachedPriceCheck(ean);
            if (cached) {
              res.end(JSON.stringify(cached));
              return;
            }
          }

          const result = await checkOnlinePrice(ean, title, Number.isFinite(currentPrice) ? currentPrice : 0, env);
          if (result.price) {
            setCachedPriceCheck(ean, result);
          }
          res.end(JSON.stringify(result));
        });
        server.middlewares.use("/api/infakt", async (req, res) => {
          const requestUrl = new URL(req.url ?? "", "http://localhost");
          const action = requestUrl.searchParams.get("action") ?? "";

          res.setHeader("Content-Type", "application/json; charset=utf-8");

          if (!action) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, message: "Brak parametru action." }));
            return;
          }

          try {
            const { handleInfaktAction } = await import("./functions/infakt.js");
            const query = Object.fromEntries(requestUrl.searchParams.entries());
            const payload = await handleInfaktAction(action, query, () => env("INFAKT_API_KEY"));
            res.end(JSON.stringify({ ok: true, ...payload }));
          } catch (error) {
            const statusCode =
              typeof error === "object" && error && "statusCode" in error
                ? Number((error as { statusCode: number }).statusCode)
                : 502;
            const message = error instanceof Error ? error.message : "Nie udało się połączyć z inFakt.";
            res.statusCode = Number.isFinite(statusCode) ? statusCode : 502;
            res.end(JSON.stringify({ ok: false, message }));
          }
        });
      }
    }
  ],
  server: {
    port: 5173
  }
});
