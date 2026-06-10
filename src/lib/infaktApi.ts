export type InfaktCostSummary = {
  uuid: string;
  number: string;
  issue_date: string;
  seller_name?: string | null;
  seller_tax_code?: string | null;
  source?: string;
  kind?: string;
  ksef_number?: string | null;
  net_price?: number | null;
  gross_price?: number | null;
};

export type InfaktImportLine = {
  id: string;
  name: string;
  qty: number;
  unitNetPrice: number | null;
  vatPercent: number | null;
  suggestedEan: string | null;
  source: string;
};

export type InfaktKsefSummary = {
  ksef_number?: string;
  number?: string;
  issue_date?: string;
  seller_name?: string;
  net_amount?: number;
  gross_amount?: number;
};

type InfaktApiResponse<T> = { ok: true } & T;
type InfaktApiError = { ok: false; message: string };

async function fetchInfakt<T>(params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams(params);
  const response = await fetch(`/api/infakt?${query.toString()}`);
  const payload = (await response.json()) as InfaktApiResponse<T> | InfaktApiError;

  if (!response.ok || !payload.ok) {
    throw new Error(!payload.ok ? payload.message : `inFakt HTTP ${response.status}`);
  }

  const { ok: _ignored, ...rest } = payload as InfaktApiResponse<T> & Record<string, unknown>;
  return rest as T;
}

export async function listInfaktCosts(options: {
  dateFrom: string;
  dateTo: string;
  offset?: number;
  limit?: number;
}): Promise<{ entities: InfaktCostSummary[]; metainfo?: { count?: number; total_count?: number } }> {
  return fetchInfakt({
    action: "costs-list",
    dateFrom: options.dateFrom,
    dateTo: options.dateTo,
    offset: String(options.offset ?? 0),
    limit: String(options.limit ?? 50)
  });
}

export async function getInfaktCostDetail(
  uuid: string,
  options?: { ksefNumber?: string }
): Promise<{
  detail: Record<string, unknown>;
  lines: InfaktImportLine[];
}> {
  const params: Record<string, string> = {
    action: "cost-detail",
    uuid
  };

  if (options?.ksefNumber) {
    params.ksefNumber = options.ksefNumber;
  }

  return fetchInfakt(params);
}

export async function listInfaktKsefCosts(options: {
  dateFrom: string;
  dateTo: string;
  offset?: number;
  limit?: number;
}): Promise<{ entities: InfaktKsefSummary[]; metainfo?: { count?: number; total_count?: number } }> {
  return fetchInfakt({
    action: "ksef-costs-list",
    dateFrom: options.dateFrom,
    dateTo: options.dateTo,
    offset: String(options.offset ?? 0),
    limit: String(options.limit ?? 50)
  });
}

export async function getInfaktKsefCostLines(ksefNumber: string): Promise<{
  ksefNumber: string;
  lines: InfaktImportLine[];
}> {
  return fetchInfakt({
    action: "ksef-cost-lines",
    ksefNumber
  });
}
