// Para ve miktar hesapları. JavaScript'in ondalık sayılarıyla (0.1 + 0.2 ≠ 0.3)
// asla para hesaplanmaz; her şey decimal.js üzerinden yapılır.
// Yuvarlama: Türkiye'deki ticari uygulamaya uygun olarak "yarım yukarı" (ROUND_HALF_UP).
import DecimalLib from "decimal.js";

export const Decimal = DecimalLib.clone({
  precision: 40,
  rounding: DecimalLib.ROUND_HALF_UP,
});
export type Decimal = InstanceType<typeof Decimal>;

export type NumericInput = string | number | Decimal | null | undefined;

/** Her türlü girdiyi Decimal'e çevirir. Boş/geçersiz değer 0 kabul edilir. */
export function dec(value: NumericInput): Decimal {
  if (value === null || value === undefined || value === "") return new Decimal(0);
  if (value instanceof Decimal) return value;
  try {
    return new Decimal(typeof value === "string" ? value.trim() : value);
  } catch {
    return new Decimal(0);
  }
}

/** 2 ondalığa yuvarlar (para tutarları). */
export function round2(value: NumericInput): Decimal {
  return dec(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** 4 ondalığa yuvarlar (miktar, birim fiyat, birim maliyet). */
export function round4(value: NumericInput): Decimal {
  return dec(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

/** Veritabanı NUMERIC(18,2) kolonuna yazılacak string. */
export function toMoneyString(value: NumericInput): string {
  return round2(value).toFixed(2);
}

/** Veritabanı NUMERIC(18,4) kolonuna yazılacak string. */
export function toQtyString(value: NumericInput): string {
  return round4(value).toFixed(4);
}

export function sumDec(values: NumericInput[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(dec(v)), new Decimal(0));
}

/**
 * Kullanıcının yazdığı sayıyı normalize eder. Türkçe yazım ("1.234,56") ve
 * noktalı yazım ("1234.56") ikisi de kabul edilir. Geçersizse null döner.
 */
export function parseDecimalInput(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? String(raw) : null;
  let s = raw.replace(/\s/g, "").replace(/^₺|₺$|TL$/gi, "");
  if (s === "") return null;
  if (s.includes(",")) {
    // Türkçe: nokta binlik ayırıcı, virgül ondalık
    s = s.replaceAll(".", "").replace(",", ".");
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return s;
}
