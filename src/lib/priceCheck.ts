export type PriceCheckResponse = {
  ok: boolean;
  price: number | null;
  source: string;
  message: string;
};

export async function fetchOnlinePrice(options: {
  ean: string;
  title: string;
  currentPrice: number;
}): Promise<PriceCheckResponse> {
  const params = new URLSearchParams({
    ean: options.ean,
    title: options.title,
    currentPrice: String(options.currentPrice)
  });

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
