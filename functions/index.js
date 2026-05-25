import { onRequest } from "firebase-functions/v2/https";

const MIN_TRUSTED_RATIO = 0.68;
const MAX_TRUSTED_RATIO = 1.8;

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

async function checkSerpApi(ean, title, currentPrice) {
  const apiKey = process.env.SERPAPI_KEY ?? "";
  if (!apiKey) return null;

  const phrases = [`${ean} ${title}`, title];

  for (const phrase of phrases) {
    const params = new URLSearchParams({
      engine: "google_shopping",
      q: phrase,
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
      return {
        ok: false,
        price: null,
        source: "Google Shopping",
        message: payload?.error
          ? `SerpApi odrzucilo zapytanie: ${payload.error}`
          : "SerpApi nie odpowiedzialo poprawnie. Sprawdz SERPAPI_KEY."
      };
    }

    const results = payload?.shopping_results ?? [];
    const prices = results
      .map((item) => parseMarketPrice(item.extracted_price ?? item.price))
      .filter((price) => price !== null);
    const trustedPrice = chooseTrustedPrice(prices, currentPrice);

    if (trustedPrice) {
      const matchedSource = results.find((item) => parseMarketPrice(item.extracted_price ?? item.price) === trustedPrice)?.source;
      return {
        ok: true,
        price: trustedPrice,
        source: matchedSource ? `Google Shopping: ${matchedSource}` : "Google Shopping",
        message: "Znaleziono cene przez Google Shopping / SerpApi."
      };
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

async function checkAllegroApi(ean, title, currentPrice) {
  const token = process.env.ALLEGRO_ACCESS_TOKEN ?? "";
  if (!token) return null;

  const phrases = [`${ean} ${title}`, title];

  for (const phrase of phrases) {
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
            ? `Allegro API odrzucilo dostep: ${allegroMessage}. Prawdopodobnie aplikacja musi byc zweryfikowana w Allegro Developer.`
            : "Allegro API odrzucilo dostep. Prawdopodobnie aplikacja musi byc zweryfikowana w Allegro Developer."
        };
      }

      continue;
    }

    const result = priceResultFromAllegroPayload(payload, currentPrice);
    if (result) return result;
  }

  return null;
}

async function checkOnlinePrice(ean, title, currentPrice) {
  const serpApiResult = await checkSerpApi(ean, title, currentPrice);
  if (serpApiResult) return serpApiResult;

  const allegroApiResult = await checkAllegroApi(ean, title, currentPrice);
  if (allegroApiResult) return allegroApiResult;

  const query = encodeURIComponent(`${ean} ${title}`);
  const sources = [
    { name: "Ceneo", url: `https://www.ceneo.pl/;szukaj-${query}` },
    { name: "Allegro", url: `https://allegro.pl/listing?string=${query}` }
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
          message: `Znaleziono najnizsza cene w ${source.name}.`
        };
      }
    } catch {
      // Public pages sometimes block automated requests. Try the next source.
    }
  }

  return {
    ok: false,
    price: null,
    source: "",
    message: process.env.SERPAPI_KEY
      ? "Nie udalo sie znalezc wiarygodnej ceny w Google Shopping, Ceneo ani Allegro."
      : process.env.ALLEGRO_ACCESS_TOKEN
        ? "Nie udalo sie odczytac ceny z Ceneo ani Allegro."
        : "Dodaj SERPAPI_KEY, zeby sprawdzac ceny przez Google Shopping."
  };
}

export const priceCheck = onRequest(
  {
    region: "europe-west1",
    timeoutSeconds: 60,
    secrets: ["SERPAPI_KEY"]
  },
  async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  const ean = String(req.query.ean ?? "");
  const title = String(req.query.title ?? "");
  const currentPrice = Number(req.query.currentPrice ?? 0);

  if (!ean || !title) {
    res.status(400).json({
      ok: false,
      price: null,
      source: "",
      message: "Brakuje EAN albo nazwy produktu."
    });
    return;
  }

  const result = await checkOnlinePrice(ean, title, Number.isFinite(currentPrice) ? currentPrice : 0);
  res.json(result);
});
