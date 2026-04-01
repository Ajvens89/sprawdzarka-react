export function normalizeEAN(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "").slice(0, 13);
}

export function normalizeText(value: string | null | undefined): string {
  return String(value ?? "").toLocaleLowerCase("pl-PL").trim();
}

export function formatPrice(price: number): string {
  return Number(price).toFixed(2).replace(".", ",");
}

export function formatMoney(price: number): string {
  return `${formatPrice(price)} zł`;
}

export function hasOwn<T extends object>(obj: T, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function localDateTimeLabel(): string {
  return new Date().toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function clampFloor(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export function safeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function readJsonFile<T>(file: File): Promise<T> {
  const text = await file.text();
  return JSON.parse(text) as T;
}
