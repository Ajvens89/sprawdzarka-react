import { auth } from "./firebase";

export type PriceCheckResponse = {
  ok: boolean;
  price: number | null;
  source: string;
  message: string;
  cached?: boolean;
};

export class PriceCheckError extends Error {
  readonly status: number;
  readonly payload: PriceCheckResponse;

  constructor(status: number, payload: PriceCheckResponse) {
    super(payload.message);
    this.name = "PriceCheckError";
    this.status = status;
    this.payload = payload;
  }
}

async function buildAuthHeaders(): Promise<HeadersInit> {
  if (!auth?.currentUser) {
    return {};
  }

  try {
    const token = await auth.currentUser.getIdToken();
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}

function fallbackMessage(status: number, payload: PriceCheckResponse): string {
  if (payload.message) return payload.message;

  switch (status) {
    case 401:
      return "Zaloguj się w Ustawieniach, aby sprawdzić cenę online.";
    case 403:
      return "To konto nie ma dostępu do sprawdzania cen online.";
    case 429:
      return "Za dużo zapytań. Spróbuj za chwilę.";
    default:
      return "Nie udało się pobrać ceny online.";
  }
}

export async function fetchOnlinePrice(options: {
  ean: string;
  title: string;
  currentPrice: number;
  force?: boolean;
}): Promise<PriceCheckResponse> {
  const params = new URLSearchParams({
    ean: options.ean,
    title: options.title,
    currentPrice: String(options.currentPrice)
  });

  if (options.force) {
    params.set("force", "1");
  }

  const headers = await buildAuthHeaders();
  const response = await fetch(`/api/price-check?${params.toString()}`, { headers });
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return {
      ok: false,
      price: null,
      source: "",
      message: "Serwer cen nie odpowiada (brak JSON). Odśwież stronę lub sprawdź wdrożenie Firebase."
    };
  }

  const payload = (await response.json()) as PriceCheckResponse;

  if (!response.ok) {
    throw new PriceCheckError(response.status, {
      ...payload,
      ok: false,
      price: payload.price ?? null,
      source: payload.source ?? "",
      message: fallbackMessage(response.status, payload)
    });
  }

  return payload;
}
