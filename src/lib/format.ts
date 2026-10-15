// Türkçe biçimlendirme yardımcıları (₺1.234,56 · 15.10.2026)
import { dec, type NumericInput } from "./money";

const moneyFormatters = new Map<string, Intl.NumberFormat>();

function moneyFormatter(currency: string) {
  let f = moneyFormatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    moneyFormatters.set(currency, f);
  }
  return f;
}

const numberFormatters = new Map<number, Intl.NumberFormat>();

function numberFormatter(maxDigits: number) {
  let f = numberFormatters.get(maxDigits);
  if (!f) {
    f = new Intl.NumberFormat("tr-TR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: maxDigits,
    });
    numberFormatters.set(maxDigits, f);
  }
  return f;
}

/** ₺1.234,56 */
export function formatMoney(value: NumericInput, currency = "TRY"): string {
  return moneyFormatter(currency).format(dec(value).toNumber());
}

/** 1.234,5 (en fazla `maxDigits` ondalık) */
export function formatNumber(value: NumericInput, maxDigits = 2): string {
  return numberFormatter(maxDigits).format(dec(value).toNumber());
}

/** Miktar: en fazla 4 ondalık, gereksiz sıfırlar atılır. */
export function formatQty(value: NumericInput): string {
  return formatNumber(value, 4);
}

/** %20 */
export function formatPercent(value: NumericInput): string {
  return `%${formatNumber(value, 2)}`;
}

/** "2026-10-15" -> "15.10.2026" */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (value instanceof Date) {
    return value.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
  }
  const [y, m, d] = value.slice(0, 10).split("-");
  if (!y || !m || !d) return value;
  return `${d}.${m}.${y}`;
}

/** Zaman damgası: 15.10.2026 14:30 */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** İstanbul saatine göre bugünün tarihi (YYYY-MM-DD). */
export function todayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** YYYY-MM-DD tarihine gün ekler. */
export function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
