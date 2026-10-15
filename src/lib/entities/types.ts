// Ortak tablo/form motorunun tanım tipleri. Bir varlık (entity) tanımı;
// liste kolonlarını, form alanlarını, aramayı, sıralamayı ve doğrulamayı
// tek yerden belirler. Tanımlar saf veridir: hem sunucu hem tarayıcı kullanır.
import type { BadgeVariant } from "@/components/ui/badge";
import type { ModuleKey } from "@/lib/modules";

export type EntityKey =
  | "cari"
  | "urun"
  | "depo"
  | "kasa-hesap"
  | "recete"
  | "is-emri"
  | "kalite-kontrol"
  | "demirbas"
  | "bakim-kaydi"
  | "firsat"
  | "personel"
  | "izin"
  | "zimmet"
  | "proje"
  | "gorev";

export type FieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "integer"
  | "decimal"
  | "money"
  | "percent"
  | "date"
  | "select"
  | "boolean"
  | "relation";

export interface SelectOption {
  value: string;
  label: string;
  tone?: BadgeVariant;
}

export interface FieldDef {
  /** Veritabanı kolonunun JS adı (drizzle şemasındaki anahtar) */
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: SelectOption[];
  /** relation alanı: hangi varlığa bağlı, isteğe bağlı filtre (ör. sadece mamuller) */
  relation?: { entity: EntityKey; filter?: { field: string; values: string[] } };
  /** Listede varsayılan olarak görünsün */
  list?: boolean;
  /** Formda gösterilmesin */
  hideInForm?: boolean;
  /** Form ızgarasında tam satır */
  wide?: boolean;
  placeholder?: string;
  help?: string;
  defaultValue?: string | boolean;
}

export interface EntityDef {
  key: EntityKey;
  module: ModuleKey;
  label: string;
  plural: string;
  description?: string;
  /** Liste sayfası */
  href: string;
  /** Özel detay sayfası varsa: "/cari/{id}" */
  detailHref?: string;
  titleField: string;
  /** Otomatik kod: boş bırakılırsa ön ek + sıra no (C00001) */
  code?: { field: string; prefix: string; digits?: number };
  searchFields: string[];
  defaultSort: { field: string; dir: "asc" | "desc" };
  fields: FieldDef[];
  /** Pano (kanban) görünümü: hangi seçim alanına göre kolonlanır */
  board?: { field: string; amountField?: string };
}

/** Listede bir satır: kolon adı -> değer. Relation alanları için `${name}__label` eklenir. */
export type EntityRow = Record<string, string | number | boolean | null> & { id: string };
