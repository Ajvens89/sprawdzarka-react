export type PriceCheckResponse = {
  ok: boolean;
  price: number | null;
  source: string;
  message: string;
  cached?: boolean;
};

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

  const response = await fetch(`/api/price-check?${params.toString()}`);
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return {
      ok: false,
      price: null,
      source: "",
      message: "Serwer cen nie odpowiada (brak JSON). Odśwież stronę lub sprawdź wdrożenie Firebase."
    };
  }

  return (await response.json()) as PriceCheckResponse;
}
