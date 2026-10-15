// Alan tanımlarından doğrulama + dönüştürme. Formdan gelen ham değerleri
// (çoğu metin) veritabanına yazılacak tiplere çevirir; hataları alan bazında döndürür.
// Sunucu her kayıtta bunu yeniden çalıştırır; istemcideki kontrol yalnızca kolaylıktır.
import { parseDecimalInput } from "@/lib/money";
import type { EntityDef, FieldDef } from "./types";

export type RawValues = Record<string, unknown>;
export type CleanValues = Record<string, string | number | boolean | null>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asText(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/** Tek bir alanı doğrular. Hata varsa { error }, yoksa { value } döner. */
export function cleanField(f: FieldDef, raw: unknown): { value: string | number | boolean | null } | { error: string } {
  const required = `${f.label} zorunludur.`;

  switch (f.type) {
    case "boolean": {
      // Alan hiç gönderilmediyse (API/seed) tanımdaki varsayılan geçerli olur
      if (raw === undefined) return { value: f.defaultValue === true };
      const v = raw === true || raw === "true" || raw === "on" || raw === "1";
      return { value: v };
    }
    case "integer": {
      const s = asText(raw);
      if (s === "") return f.required ? { error: required } : { value: 0 };
      const n = Number(s.replace(",", "."));
      if (!Number.isInteger(n)) return { error: `${f.label} tam sayı olmalı.` };
      return { value: n };
    }
    case "decimal":
    case "money":
    case "percent": {
      const s = asText(raw);
      if (s === "") return f.required ? { error: required } : { value: "0" };
      const parsed = parseDecimalInput(s);
      if (parsed === null) return { error: `${f.label} geçerli bir sayı olmalı.` };
      if (f.type === "percent" && (Number(parsed) < 0 || Number(parsed) > 100)) {
        return { error: `${f.label} 0 ile 100 arasında olmalı.` };
      }
      return { value: parsed };
    }
    case "date": {
      const s = asText(raw);
      if (s === "") return f.required ? { error: required } : { value: null };
      if (!DATE.test(s)) return { error: `${f.label} geçerli bir tarih olmalı.` };
      return { value: s };
    }
    case "relation": {
      const s = asText(raw);
      if (s === "") return f.required ? { error: required } : { value: null };
      if (!UUID.test(s)) return { error: `${f.label} seçimi geçersiz.` };
      return { value: s };
    }
    case "select": {
      const s = asText(raw);
      if (s === "") {
        if (f.required) return { error: required };
        return { value: typeof f.defaultValue === "string" ? f.defaultValue : null };
      }
      if (f.options && !f.options.some((o) => o.value === s)) return { error: `${f.label} için geçersiz seçim.` };
      return { value: s };
    }
    case "email": {
      const s = asText(raw);
      if (s === "") return f.required ? { error: required } : { value: null };
      if (!EMAIL.test(s)) return { error: "Geçerli bir e-posta adresi girin." };
      return { value: s.toLowerCase() };
    }
    default: {
      const s = asText(raw);
      if (s === "") return f.required ? { error: required } : { value: null };
      if (s.length > 2000) return { error: `${f.label} çok uzun.` };
      return { value: s };
    }
  }
}

export function cleanEntityValues(
  def: EntityDef,
  raw: RawValues,
): { ok: true; values: CleanValues } | { ok: false; fieldErrors: Record<string, string> } {
  const values: CleanValues = {};
  const fieldErrors: Record<string, string> = {};
  for (const f of def.fields) {
    if (f.hideInForm) continue;
    // Otomatik kod alanı boş bırakılabilir
    if (def.code?.field === f.name && asText(raw[f.name]) === "") {
      values[f.name] = null;
      continue;
    }
    const r = cleanField(f, raw[f.name]);
    if ("error" in r) fieldErrors[f.name] = r.error;
    else values[f.name] = r.value;
  }
  return Object.keys(fieldErrors).length > 0 ? { ok: false, fieldErrors } : { ok: true, values };
}
