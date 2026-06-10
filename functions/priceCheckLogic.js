const MIN_TRUSTED_RATIO = 0.68;
const MAX_TRUSTED_RATIO = 1.8;
const PRICE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SERPAPI_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const SERPER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const priceCache = new Map();
let serpApiDisabledUntil = 0;
let serperDisabledUntil = 0;

function parseMarketPrice(value) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== "string") return null;

  const normalized = value
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function extractPrices(html) {
  const normalizedHtml = html
    .replace(/&nbsp;/g, " ")
    .replace(/&#322;/g, "\u0142")
    .replace(/&\#x142;/gi, "\u0142");

  const decimalMatches = Array.from(normalizedHtml.matchAll(/(\d{1,4})[,. ](\d{2})\s*(?:z\u0142|zl|PLN)/gi));
  const integerMatches = Array.from(normalizedHtml.matchAll(/(\d{1,4})\s*(?:z\u0142|zl|PLN)/gi));

  const decimalPrices = decimalMatches
    .map((match) => Number(`${match[1]}.${match[2]}`))
    .filter((price) => Number.isFinite(price) && price >= 3 && price <= 999);

  const integerPrices = integerMatches
    .map((match) => Number(match[1]))
    .filter((price) => Number.isFinite(price) && price >= 3 && price <= 999);

  return Array.from(new Set([...decimalPrices, ...integerPrices])).sort((a, b) => a - b);
}

async function fetchPrices(url) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "pl-PL,pl;q=0.9,en;q=0.7",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36"
    }
  });

  if (!response.ok) return [];
  return extractPrices(await response.text());
}

function chooseTrustedPrice(prices, currentPrice) {
  const trusted = prices.filter((price) => {
    if (!currentPrice) return price >= 5;
    return price >= currentPrice * MIN_TRUSTED_RATIO && price <= currentPrice * MAX_TRUSTED_RATIO;
  });

  return trusted[0] ?? null;
}

function isSerpApiQuotaError(message) {
  return isApiQuotaError(message);
}

function isApiQuotaError(message) {
  const text = String(message ?? "").toLowerCase();
  return (
    text.includes("quota") ||
    text.includes("limit") ||
    text.includes("run out") ||
    text.includes("insufficient") ||
    text.includes("exceeded") ||
    text.includes("credit")
  );
}

function serpApiAvailable() {
  return Date.now() >= serpApiDisabledUntil;
}

function serperAvailable() {
  return Date.now() >= serperDisabledUntil;
}

function disableSerpApiTemporarily() {
  serpApiDisabledUntil = Date.now() + SERPAPI_COOLDOWN_MS;
}

function disableSerperTemporarily() {
  serperDisabledUntil = Date.now() + SERPER_COOLDOWN_MS;
}

export function getCachedPriceCheck(ean) {
  const normalizedEan = String(ean ?? "").replace(/\D/g, "").slice(0, 13);
  const entry = priceCache.get(normalizedEan);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > PRICE_CACHE_TTL_MS) {
    priceCache.delete(normalizedEan);
    return null;
  }

  return {
    ...entry.result,
    cached: true,
    message: `${entry.result.message} (cache serwera, oszczednosc API)`
  };
}

export function setCachedPriceCheck(ean, result) {
  const normalizedEan = String(ean ?? "").replace(/\D/g, "").slice(0, 13);
  if (!/^\d{13}$/.test(normalizedEan) || !result?.price) return;

  priceCache.set(normalizedEan, {
    cachedAt: Date.now(),
    result: {
      ok: Boolean(result.ok),
      price: result.price,
      source: result.source ?? "",
      message: result.message ?? "Zapisano w cache serwera."
    }
  });
}

async function checkFreeSources(ean, title, currentPrice) {
  const query = encodeURIComponent(`${ean} ${title}`);
  const titleQuery = encodeURIComponent(title);
  const sources = [
    { name: "Ceneo", url: `https://www.ceneo.pl/;szukaj-${query}` },
    { name: "Allegro", url: `https://allegro.pl/listing?string=${query}` },
    { name: "Ceneo", url: `https://www.ceneo.pl/;szukaj-${titleQuery}` }
  ];

  for (const source of sources) {
    try {
      const prices = await fetchPrices(source.url);
      const trustedPrice = chooseTrustedPrice(prices, currentPrice);

      if (trustedPrice) {
        return {
          ok: true,
          price: trustedPrice,
          source: source.name,
          message: `Znaleziono cene w ${source.name} (bez SerpApi).`
        };
      }
    } catch {
      // Public pages sometimes block automated requests.
    }
  }

  return null;
}

function readAllegroError(payload) {
  const firstError = payload?.errors?.[0];
  return firstError?.userMessage ?? firstError?.message ?? firstError?.code ?? payload?.error_description ?? payload?.error ?? "";
}

function priceResultFromAllegroPayload(payload, currentPrice) {
  const items = [...(payload?.items?.regular ?? []), ...(payload?.items?.promoted ?? [])];
  const prices = items
    .map((item) => Number(item.sellingMode?.price?.amount))
    .filter((price) => Number.isFinite(price));
  const trustedPrice = chooseTrustedPrice(prices, currentPrice);

  if (!trustedPrice) return null;

  return {
    ok: true,
    price: trustedPrice,
    source: "Allegro API",
    message: "Znaleziono cene przez oficjalne API Allegro."
  };
}

async function checkAllegroApi(ean, title, currentPrice, getEnv) {
  const token = getEnv("ALLEGRO_ACCESS_TOKEN");
  if (!token) return null;

  const phrase = `${ean} ${title}`;
  const params = new URLSearchParams({
    phrase,
    sort: "+price",
    limit: "20",
    fallback: "false",
    marketplaceId: "allegro-pl",
    currency: "PLN",
    "sellingMode.format": "BUY_NOW"
  });

  const response = await fetch(`https://api.allegro.pl/offers/listing?${params.toString()}`, {
    headers: {
      accept: "application/vnd.allegro.public.v1+json",
      authorization: `Bearer ${token}`,
      "accept-language": "pl-PL"
    }
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const allegroMessage = readAllegroError(payload);
    if (response.status === 401) {
      return {
        ok: false,
        price: null,
        source: "Allegro API",
        message: "Token Allegro wygasl albo jest niepoprawny. Wygeneruj ALLEGRO_ACCESS_TOKEN ponownie."
      };
    }

    if (response.status === 403) {
      return {
        ok: false,
        price: null,
        source: "Allegro API",
        message: allegroMessage
          ? `Allegro API odrzucilo dostep: ${allegroMessage}.`
          : "Allegro API odrzucilo dostep."
      };
    }

    return null;
  }

  return priceResultFromAllegroPayload(payload, currentPrice);
}

async function checkSerpApi(ean, title, currentPrice, getEnv) {
  const apiKey = getEnv("SERPAPI_KEY");
  if (!apiKey || !serpApiAvailable()) return null;

  const params = new URLSearchParams({
    engine: "google_shopping",
    q: `${ean} ${title}`,
    api_key: apiKey,
    gl: "pl",
    hl: "pl",
    google_domain: "google.pl",
    location: "Poland",
    num: "20"
  });

  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.error) {
    const errorMessage = payload?.error
      ? `SerpApi odrzucilo zapytanie: ${payload.error}`
      : "SerpApi nie odpowiedzialo poprawnie. Sprawdz SERPAPI_KEY.";

    if (isSerpApiQuotaError(payload?.error ?? errorMessage)) {
      disableSerpApiTemporarily();
      return null;
    }

    return {
      ok: false,
      price: null,
      source: "Google Shopping",
      message: errorMessage
    };
  }

  const results = payload?.shopping_results ?? [];
  const prices = shoppingPricesFromPayload({ shopping_results: results });
  const trustedPrice = chooseTrustedPrice(prices, currentPrice);

  return shoppingResultFromItems(results, prices, trustedPrice, "Google Shopping (SerpApi)");
}

function shoppingPricesFromPayload(payload) {
  const results = payload?.shopping ?? payload?.shopping_results ?? [];
  return results
    .map((item) => parseMarketPrice(item.price ?? item.extracted_price ?? item.priceValue))
    .filter((price) => price !== null);
}

function shoppingResultFromItems(results, prices, trustedPrice, sourceLabel) {
  if (!trustedPrice) return null;

  const matched = results.find((item) => parseMarketPrice(item.price ?? item.extracted_price ?? item.priceValue) === trustedPrice);
  const vendor = matched?.source ?? matched?.merchant ?? matched?.seller ?? "";

  return {
    ok: true,
    price: trustedPrice,
    source: vendor ? `${sourceLabel}: ${vendor}` : sourceLabel,
    message: `Znaleziono cene przez ${sourceLabel}.`
  };
}

async function checkSerper(ean, title, currentPrice, getEnv) {
  const apiKey = getEnv("SERPER_API_KEY");
  if (!apiKey || !serperAvailable()) return null;

  const response = await fetch("https://google.serper.dev/shopping", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      q: `${ean} ${title}`,
      gl: "pl",
      hl: "pl",
      num: 20
    })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage =
      payload?.message ?? payload?.error ?? `Serper zwrocilo HTTP ${response.status}.`;

    if (response.status === 401 || response.status === 403 || response.status === 429 || isApiQuotaError(errorMessage)) {
      disableSerperTemporarily();
      return null;
    }

    return {
      ok: false,
      price: null,
      source: "Google Shopping (Serper)",
      message: `Serper odrzucilo zapytanie: ${errorMessage}`
    };
  }

  const results = payload?.shopping ?? payload?.shopping_results ?? [];
  const prices = shoppingPricesFromPayload(payload);
  const trustedPrice = chooseTrustedPrice(prices, currentPrice);

  return shoppingResultFromItems(results, prices, trustedPrice, "Google Shopping (Serper)");
}

export async function checkOnlinePrice(ean, title, currentPrice, getEnv = (name) => process.env[name] ?? "") {
  const freeResult = await checkFreeSources(ean, title, currentPrice);
  if (freeResult) return freeResult;

  const allegroApiResult = await checkAllegroApi(ean, title, currentPrice, getEnv);
  if (allegroApiResult?.price) return allegroApiResult;
  if (allegroApiResult && !allegroApiResult.ok) return allegroApiResult;

  const serpApiResult = await checkSerpApi(ean, title, currentPrice, getEnv);
  if (serpApiResult?.price) return serpApiResult;
  if (serpApiResult && !serpApiResult.ok && serpApiAvailable()) return serpApiResult;

  const serperResult = await checkSerper(ean, title, currentPrice, getEnv);
  if (serperResult?.price) return serperResult;
  if (serperResult && !serperResult.ok && serperAvailable()) return serperResult;

  const hasSerpKey = Boolean(getEnv("SERPAPI_KEY"));
  const hasSerperKey = Boolean(getEnv("SERPER_API_KEY"));
  const hasAllegroToken = Boolean(getEnv("ALLEGRO_ACCESS_TOKEN"));

  if (!serpApiAvailable() && hasSerpKey && !serperAvailable() && hasSerperKey) {
    return {
      ok: false,
      price: null,
      source: "",
      message: "Limit SerpApi i Serper wyczerpany. Uzyto darmowych zrodel — sprobuj ponownie pozniej albo uzupelnij ceny recznie."
    };
  }

  if (!serpApiAvailable() && hasSerpKey && !hasSerperKey) {
    return {
      ok: false,
      price: null,
      source: "",
      message: "Limit SerpApi wyczerpany. Dodaj SERPER_API_KEY albo sprobuj ponownie jutro."
    };
  }

  return {
    ok: false,
    price: null,
    source: "",
    message: hasSerpKey || hasSerperKey || hasAllegroToken
      ? "Nie udalo sie znalezc wiarygodnej ceny w Ceneo, Allegro ani Google Shopping."
      : "Dodaj SERPAPI_KEY albo SERPER_API_KEY, zeby rozszerzyc zrodla cen."
  };
}
