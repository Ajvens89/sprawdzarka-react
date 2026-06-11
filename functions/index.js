import { onRequest } from "firebase-functions/v2/https";
import { handleInfaktAction } from "./infakt.js";
import { checkOnlinePrice, getCachedPriceCheck, setCachedPriceCheck } from "./priceCheckLogic.js";

const ALLOWED_ORIGINS = [
  "https://sprawdzarkazf.web.app",
  "https://sprawdzarkazf.firebaseapp.com",
  "http://localhost",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
  "http://localhost:4173"
];
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
const rateBuckets = new Map();

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  return String(Array.isArray(forwarded) ? forwarded[0] : forwarded ?? req.ip ?? "unknown")
    .split(",")[0]
    .trim();
}

function isAllowedOrigin(req) {
  const origin = String(req.headers.origin ?? "");
  const referer = String(req.headers.referer ?? "");
  const source = origin || referer;
  if (!source) return false;
  return ALLOWED_ORIGINS.some((allowed) => source.startsWith(allowed));
}

function resolveCorsOrigin(req) {
  const origin = String(req.headers.origin ?? "");
  if (ALLOWED_ORIGINS.some((allowed) => origin.startsWith(allowed))) {
    return origin;
  }
  return ALLOWED_ORIGINS[0];
}

function checkRateLimit(ip) {
  const now = Date.now();
  const bucket = rateBuckets.get(ip) ?? { count: 0, resetAt: now + RATE_WINDOW_MS };

  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + RATE_WINDOW_MS;
  }

  bucket.count += 1;
  rateBuckets.set(ip, bucket);
  return bucket.count <= RATE_LIMIT;
}

export const priceCheck = onRequest(
  {
    region: "europe-west1",
    timeoutSeconds: 60,
    secrets: ["SERPAPI_KEY", "SERPER_API_KEY"]
  },
  async (req, res) => {
    const corsOrigin = resolveCorsOrigin(req);
    res.setHeader("Access-Control-Allow-Origin", corsOrigin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (!isAllowedOrigin(req)) {
      res.status(403).json({
        ok: false,
        price: null,
        source: "",
        message: "Zablokowane źródło żądania."
      });
      return;
    }

    if (!checkRateLimit(getClientIp(req))) {
      res.status(429).json({
        ok: false,
        price: null,
        source: "",
        message: "Za dużo zapytań. Spróbuj za chwilę."
      });
      return;
    }

    const ean = String(req.query.ean ?? "").replace(/\D/g, "").slice(0, 13);
    const title = String(req.query.title ?? "");
    const currentPrice = Number(req.query.currentPrice ?? 0);
    const forceRefresh = String(req.query.force ?? "") === "1";

    if (!/^\d{13}$/.test(ean) || !title) {
      res.status(400).json({
        ok: false,
        price: null,
        source: "",
        message: "Brakuje EAN albo nazwy produktu."
      });
      return;
    }

    if (!forceRefresh) {
      const cached = getCachedPriceCheck(ean);
      if (cached) {
        res.json(cached);
        return;
      }
    }

    const result = await checkOnlinePrice(ean, title, Number.isFinite(currentPrice) ? currentPrice : 0);
    if (result.price) {
      setCachedPriceCheck(ean, result);
    }
    res.json(result);
  }
);

export const infaktProxy = onRequest(
  {
    region: "europe-west1",
    timeoutSeconds: 120,
    secrets: ["INFAKT_API_KEY"]
  },
  async (req, res) => {
    const corsOrigin = resolveCorsOrigin(req);
    res.setHeader("Access-Control-Allow-Origin", corsOrigin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "GET") {
      res.status(405).json({ ok: false, message: "Dozwolona jest tylko metoda GET." });
      return;
    }

    if (!isAllowedOrigin(req)) {
      res.status(403).json({ ok: false, message: "Zablokowane źródło żądania." });
      return;
    }

    if (!checkRateLimit(getClientIp(req))) {
      res.status(429).json({ ok: false, message: "Za dużo zapytań do inFakt. Spróbuj za chwilę." });
      return;
    }

    const action = String(req.query.action ?? "");
    if (!action) {
      res.status(400).json({ ok: false, message: "Brak parametru action." });
      return;
    }

    try {
      const payload = await handleInfaktAction(action, req.query, () => process.env.INFAKT_API_KEY ?? "");
      res.json({ ok: true, ...payload });
    } catch (error) {
      const statusCode = typeof error?.statusCode === "number" ? error.statusCode : 502;
      const message = error instanceof Error ? error.message : "Nie udało się połączyć z inFakt.";
      res.status(statusCode).json({ ok: false, message });
    }
  }
);
