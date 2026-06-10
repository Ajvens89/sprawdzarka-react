const INFAKT_BASE_URL = "https://api.infakt.pl";
const INFAKT_API_PREFIX = "/api/v3";

function buildInfaktUrl(path, query = {}) {
  const url = new URL(`${INFAKT_API_PREFIX}${path}`, INFAKT_BASE_URL);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url;
}

async function infaktFetch(apiKey, path, query = {}, accept = "application/json") {
  const response = await fetch(buildInfaktUrl(path, query), {
    headers: {
      Accept: accept,
      "X-inFakt-ApiKey": apiKey
    }
  });

  const contentType = String(response.headers.get("content-type") ?? "");
  const isJson = contentType.includes("json");
  const body = isJson ? await response.json().catch(() => null) : await response.text();

  if (!response.ok) {
    const message =
      typeof body === "object" && body && "error" in body
        ? String(body.error)
        : typeof body === "object" && body && "message" in body
          ? String(body.message)
          : `inFakt HTTP ${response.status}`;
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  return body;
}

function groszeToPln(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed) / 100;
}

function plnFromMixed(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  if (!Number.isFinite(parsed)) return null;
  if (Number.isInteger(parsed) && Math.abs(parsed) > 1000) {
    return groszeToPln(parsed);
  }
  return Math.round(parsed * 100) / 100;
}

function normalizeLine(item, index, invoiceMeta = {}) {
  const name = String(
    item.name ??
      item.title ??
      item.description ??
      item.product_name ??
      item.service_name ??
      item.line_name ??
      ""
  ).trim();
  if (!name) return null;

  const qtyRaw = item.quantity ?? item.qty ?? item.count ?? item.amount ?? 1;
  const qty = Math.max(1, Math.round(Number(qtyRaw) || 1));

  const unitNet =
    plnFromMixed(item.unit_net_price ?? item.unit_net ?? item.net_unit_price ?? item.price_net) ??
    plnFromMixed(item.net_price ?? item.total_net_price ?? item.total_net) ??
    plnFromMixed(item.unit_price ?? item.price);

  const vatRaw = item.tax_symbol ?? item.vat_rate ?? item.vat ?? item.tax ?? item.tax_rate;
  const vatPercent =
    vatRaw === null || vatRaw === undefined || vatRaw === ""
      ? null
      : Number(String(vatRaw).replace("%", ""));

  const eanMatch = name.match(/\b(\d{13})\b/);

  return {
    id: `${invoiceMeta.id ?? "line"}-${index}`,
    name,
    qty,
    unitNetPrice: unitNet,
    vatPercent: Number.isFinite(vatPercent) ? vatPercent : null,
    suggestedEan: eanMatch?.[1] ?? null,
    source: invoiceMeta.source ?? "infakt"
  };
}

function extractLinesFromArrays(payload) {
  const candidates = [
    payload?.positions,
    payload?.line_items,
    payload?.items,
    payload?.services,
    payload?.cost_positions,
    payload?.invoice_lines,
    payload?.lines,
    payload?.goods,
    payload?.products,
    payload?.document_lines
  ];

  for (const list of candidates) {
    if (!Array.isArray(list) || list.length === 0) continue;
    const lines = list
      .map((item, index) => normalizeLine(item, index, { id: payload?.uuid ?? payload?.number }))
      .filter(Boolean);
    if (lines.length > 0) return lines;
  }

  return [];
}

function extractKsefNumber(detail) {
  const direct =
    detail?.ksef_number ??
    detail?.ksefNumber ??
    detail?.invoice_ksef_number ??
    detail?.ksef_reference ??
    detail?.external_number;

  if (direct) {
    return String(direct).trim();
  }

  for (const key of ["ksef", "ksef_data", "ksef_invoice", "external_reference"]) {
    const nested = detail?.[key];
    if (!nested || typeof nested !== "object") continue;
    const nestedNumber =
      nested.ksef_number ?? nested.ksefNumber ?? nested.number ?? nested.invoice_ksef_number;
    if (nestedNumber) {
      return String(nestedNumber).trim();
    }
  }

  return "";
}

function looksLikeKsefNumber(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return false;
  return /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(normalized);
}

async function findKsefNumberByInvoiceNumber(apiKey, invoiceNumber, issueDate) {
  const normalizedNumber = String(invoiceNumber ?? "").trim();
  if (!normalizedNumber) return "";

  const params = { limit: "100", offset: "0" };
  if (issueDate) {
    params.issue_date_from = issueDate;
    params.issue_date_to = issueDate;
  }

  try {
    const payload = await infaktFetch(apiKey, "/ksef/import/cost_invoices.json", params);
    const entities = Array.isArray(payload?.entities) ? payload.entities : [];
    const match = entities.find((entity) => {
      const invoiceCandidates = [
        entity?.invoice_number,
        entity?.seller_invoice_number,
        entity?.original_number,
        entity?.number
      ]
        .map((value) => String(value ?? "").trim())
        .filter((value) => value && !looksLikeKsefNumber(value));
      return invoiceCandidates.includes(normalizedNumber);
    });

    const ksefNumber = match?.ksef_number ?? match?.ksefNumber;
    return ksefNumber ? String(ksefNumber).trim() : "";
  } catch {
    return "";
  }
}

async function fetchKsefXmlLines(apiKey, ksefNumber) {
  const normalized = String(ksefNumber ?? "").trim();
  if (!normalized) return [];

  const xml = await infaktFetch(
    apiKey,
    "/ksef/import/cost_invoice.xml",
    { ksef_number: normalized },
    "application/xml,text/xml,*/*"
  );

  return parseFaXmlLines(String(xml));
}

function decodeXmlEntities(value) {
  return String(value)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function readFaXmlTag(chunk, tag) {
  const tagMatch = chunk.match(
    new RegExp(`<(?:[\\w.-]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${tag}>`, "i")
  );
  return tagMatch ? decodeXmlEntities(tagMatch[1].trim()) : "";
}

function parseFaXmlLines(xml) {
  const lines = [];
  const rowPattern =
    /<(?:[\w.-]+:)?(?:FaWiersz|WierszFa)[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?(?:FaWiersz|WierszFa)>/gi;
  let match = rowPattern.exec(xml);

  while (match) {
    const chunk = match[1];
    const name =
      readFaXmlTag(chunk, "P_7") ||
      readFaXmlTag(chunk, "P_7A") ||
      readFaXmlTag(chunk, "P_7B") ||
      readFaXmlTag(chunk, "Indeks") ||
      readFaXmlTag(chunk, "GTIN");

    if (name) {
      const qty = Math.max(
        1,
        Math.round(Number(readFaXmlTag(chunk, "P_8B") || readFaXmlTag(chunk, "P_8A") || "1") || 1)
      );

      let unitNet = plnFromMixed(
        readFaXmlTag(chunk, "P_9A") || readFaXmlTag(chunk, "P_9Netto") || readFaXmlTag(chunk, "P_9B")
      );
      if (unitNet === null) {
        const lineNet = plnFromMixed(readFaXmlTag(chunk, "P_11") || readFaXmlTag(chunk, "P_11Netto"));
        if (lineNet !== null && qty > 0) {
          unitNet = Math.round((lineNet / qty) * 100) / 100;
        }
      }

      const vatRaw = readFaXmlTag(chunk, "P_12") || readFaXmlTag(chunk, "P_12_XII");
      const vatPercent = Number(String(vatRaw).replace("%", "").replace(",", "."));
      const eanFromField = readFaXmlTag(chunk, "GTIN") || readFaXmlTag(chunk, "EAN");
      const suggestedEan =
        eanFromField.match(/\d{13}/)?.[0] ?? name.match(/\b(\d{13})\b/)?.[1] ?? null;

      lines.push({
        id: `fa-${lines.length}`,
        name,
        qty,
        unitNetPrice: unitNet,
        vatPercent: Number.isFinite(vatPercent) ? vatPercent : null,
        suggestedEan,
        source: "ksef-xml"
      });
    }

    match = rowPattern.exec(xml);
  }

  return lines;
}

function buildFallbackLine(detail, source) {
  const net = groszeToPln(detail?.net_price);
  const gross = groszeToPln(detail?.gross_price);
  const vatPercent =
    net && gross && net > 0 ? Math.round(((gross - net) / net) * 10000) / 100 : null;

  return [
    {
      id: "fallback-0",
      name: detail?.description || detail?.number || detail?.seller_name || "Pozycja faktury",
      qty: 1,
      unitNetPrice: net,
      vatPercent,
      suggestedEan: null,
      source
    }
  ];
}

async function fetchAttachmentXmlLines(apiKey, attachment) {
  const downloadUrl = String(attachment?.download_url ?? attachment?.file_url ?? "");
  if (!downloadUrl) return [];

  const response = await fetch(downloadUrl, {
    headers: {
      Accept: "application/xml,text/xml,application/octet-stream,*/*",
      "X-inFakt-ApiKey": apiKey
    }
  });
  if (!response.ok) return [];

  const body = await response.text();
  if (!body.includes("<?xml") && !body.includes("FaWiersz") && !body.includes("WierszFa") && !body.includes("<P_7")) {
    return [];
  }

  return parseFaXmlLines(body);
}

async function resolveCostLines(apiKey, detail, hints = {}) {
  const fromJson = extractLinesFromArrays(detail);
  if (fromJson.length > 0) {
    return fromJson;
  }

  const attachments = Array.isArray(detail?.attachments) ? detail.attachments : [];
  for (const attachment of attachments) {
    const parsed = await fetchAttachmentXmlLines(apiKey, attachment);
    if (parsed.length > 0) return parsed;
  }

  let ksefNumber = String(hints.ksefNumber ?? "").trim() || extractKsefNumber(detail);
  if (!ksefNumber && detail?.source === "ksef" && looksLikeKsefNumber(detail?.number)) {
    ksefNumber = String(detail.number).trim();
  }
  if (!ksefNumber) {
    ksefNumber = await findKsefNumberByInvoiceNumber(apiKey, detail?.number, detail?.issue_date);
  }

  if (ksefNumber) {
    try {
      const fromKsef = await fetchKsefXmlLines(apiKey, ksefNumber);
      if (fromKsef.length > 0) {
        return fromKsef;
      }
    } catch {
      // Fall through to invoice-level fallback below.
    }
  }

  return buildFallbackLine(detail, detail?.source === "ksef" ? "infakt-ksef" : "infakt-cost");
}

export async function handleInfaktAction(action, query, getApiKey) {
  const apiKey = getApiKey();
  if (!apiKey) {
    const error = new Error("Brak klucza INFAKT_API_KEY. Ustaw sekret w Firebase Functions.");
    error.statusCode = 500;
    throw error;
  }

  if (action === "costs-list") {
    const dateFrom = String(query.dateFrom ?? "");
    const dateTo = String(query.dateTo ?? "");
    const offset = String(query.offset ?? "0");
    const limit = String(query.limit ?? "50");

    const params = { limit, offset };
    if (dateFrom) params["q[issue_date_gteq]"] = dateFrom;
    if (dateTo) params["q[issue_date_lteq]"] = dateTo;

    return infaktFetch(apiKey, "/documents/costs.json", params);
  }

  if (action === "cost-detail") {
    const uuid = String(query.uuid ?? "");
    if (!uuid) {
      const error = new Error("Brak uuid kosztu.");
      error.statusCode = 400;
      throw error;
    }

    const detail = await infaktFetch(apiKey, `/documents/costs/${encodeURIComponent(uuid)}.json`);
    const lines = await resolveCostLines(apiKey, detail, {
      ksefNumber: String(query.ksefNumber ?? query.ksef_number ?? "")
    });
    return { detail, lines };
  }

  if (action === "ksef-costs-list") {
    const dateFrom = String(query.dateFrom ?? "");
    const dateTo = String(query.dateTo ?? "");
    const offset = String(query.offset ?? "0");
    const limit = String(query.limit ?? "50");

    const params = { limit, offset };
    if (dateFrom) params.issue_date_from = dateFrom;
    if (dateTo) params.issue_date_to = dateTo;

    return infaktFetch(apiKey, "/ksef/import/cost_invoices.json", params);
  }

  if (action === "ksef-cost-lines") {
    const ksefNumber = String(query.ksefNumber ?? query.ksef_number ?? "");
    if (!ksefNumber) {
      const error = new Error("Brak numeru KSeF.");
      error.statusCode = 400;
      throw error;
    }

    const xml = await infaktFetch(
      apiKey,
      "/ksef/import/cost_invoice.xml",
      { ksef_number: ksefNumber },
      "application/xml,text/xml,*/*"
    );

    const lines = parseFaXmlLines(String(xml));
    return {
      ksefNumber,
      lines: lines.length > 0 ? lines : buildFallbackLine({ number: ksefNumber }, "ksef-xml")
    };
  }

  const error = new Error(`Nieznana akcja inFakt: ${action}`);
  error.statusCode = 400;
  throw error;
}
