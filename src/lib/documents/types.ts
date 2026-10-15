// Belge türleri. Her tür; hangi modüle ait olduğunu, cari/stok/kasa üzerindeki
// etkisini ve hangi türlere dönüştürülebileceğini tanımlar. Belge motoru
// (src/server/documents) tüm türleri bu tablodan okuyarak işler.
import type { ModuleKey } from "@/lib/modules";

export type DocTypeKey =
  | "satis_teklif"
  | "satis_siparis"
  | "satis_irsaliye"
  | "satis_fatura"
  | "satis_iade"
  | "alis_siparis"
  | "alis_irsaliye"
  | "alis_fatura"
  | "alis_iade"
  | "depo_transfer"
  | "tahsilat"
  | "tediye"
  | "masraf";

export type PartnerRole = "musteri" | "tedarikci" | "hepsi";

export interface DocTypeDef {
  key: DocTypeKey;
  /** URL parçası: /belge/satis-faturasi */
  slug: string;
  label: string;
  plural: string;
  module: ModuleKey;
  /** Numara ön eki (3 harf, GİB numara biçimi: ABC + yıl + 9 hane) */
  prefix: string;
  /** Cari zorunlu mu, hangi cari türleri listelensin */
  partner: "zorunlu" | "opsiyonel" | "yok";
  partnerRole: PartnerRole;
  /** Satır tipi: ürün satırları, serbest açıklamalı satırlar veya satırsız (tutar) */
  lines: "urun" | "serbest" | "yok";
  /** Fiyat kullanılacak mı (transfer fişinde fiyat yok) */
  priced: boolean;
  /** Stok etkisi: +1 giriş, -1 çıkış, 0 yok. Transfer ayrı ele alınır. */
  stock: -1 | 0 | 1;
  transfer?: boolean;
  /** Cari etkisi: borç (müşteri bize borçlanır) veya alacak */
  partnerEffect: "borc" | "alacak" | null;
  /** Kasa/banka etkisi: +1 giriş, -1 çıkış */
  cash: -1 | 0 | 1;
  /** Vade tarihi alanı gösterilsin mi */
  hasDueDate: boolean;
  /** Hangi türlere dönüştürülebilir (ör. teklif -> sipariş) */
  convertsTo: DocTypeKey[];
  /** e-Fatura/e-Arşiv gönderilebilir mi */
  eDocument?: boolean;
}

export const DOC_TYPES: Record<DocTypeKey, DocTypeDef> = {
  satis_teklif: {
    key: "satis_teklif",
    slug: "satis-teklifi",
    label: "Satış Teklifi",
    plural: "Satış Teklifleri",
    module: "satis",
    prefix: "TKL",
    partner: "zorunlu",
    partnerRole: "musteri",
    lines: "urun",
    priced: true,
    stock: 0,
    partnerEffect: null,
    cash: 0,
    hasDueDate: false,
    convertsTo: ["satis_siparis", "satis_fatura"],
  },
  satis_siparis: {
    key: "satis_siparis",
    slug: "satis-siparisi",
    label: "Satış Siparişi",
    plural: "Satış Siparişleri",
    module: "satis",
    prefix: "SSP",
    partner: "zorunlu",
    partnerRole: "musteri",
    lines: "urun",
    priced: true,
    stock: 0,
    partnerEffect: null,
    cash: 0,
    hasDueDate: false,
    convertsTo: ["satis_irsaliye", "satis_fatura"],
  },
  satis_irsaliye: {
    key: "satis_irsaliye",
    slug: "satis-irsaliyesi",
    label: "Satış İrsaliyesi",
    plural: "Satış İrsaliyeleri",
    module: "satis",
    prefix: "SIR",
    partner: "zorunlu",
    partnerRole: "musteri",
    lines: "urun",
    priced: true,
    stock: -1,
    partnerEffect: null,
    cash: 0,
    hasDueDate: false,
    convertsTo: ["satis_fatura"],
    eDocument: true,
  },
  satis_fatura: {
    key: "satis_fatura",
    slug: "satis-faturasi",
    label: "Satış Faturası",
    plural: "Satış Faturaları",
    module: "satis",
    prefix: "SFT",
    partner: "zorunlu",
    partnerRole: "musteri",
    lines: "urun",
    priced: true,
    stock: -1,
    partnerEffect: "borc",
    cash: 0,
    hasDueDate: true,
    convertsTo: ["satis_iade"],
    eDocument: true,
  },
  satis_iade: {
    key: "satis_iade",
    slug: "satis-iadesi",
    label: "Satış İade Faturası",
    plural: "Satış İadeleri",
    module: "satis",
    prefix: "SIF",
    partner: "zorunlu",
    partnerRole: "musteri",
    lines: "urun",
    priced: true,
    stock: 1,
    partnerEffect: "alacak",
    cash: 0,
    hasDueDate: false,
    convertsTo: [],
  },
  alis_siparis: {
    key: "alis_siparis",
    slug: "alis-siparisi",
    label: "Satın Alma Siparişi",
    plural: "Satın Alma Siparişleri",
    module: "satinalma",
    prefix: "ASP",
    partner: "zorunlu",
    partnerRole: "tedarikci",
    lines: "urun",
    priced: true,
    stock: 0,
    partnerEffect: null,
    cash: 0,
    hasDueDate: false,
    convertsTo: ["alis_irsaliye", "alis_fatura"],
  },
  alis_irsaliye: {
    key: "alis_irsaliye",
    slug: "alis-irsaliyesi",
    label: "Mal Kabul (Alış İrsaliyesi)",
    plural: "Mal Kabuller",
    module: "satinalma",
    prefix: "AIR",
    partner: "zorunlu",
    partnerRole: "tedarikci",
    lines: "urun",
    priced: true,
    stock: 1,
    partnerEffect: null,
    cash: 0,
    hasDueDate: false,
    convertsTo: ["alis_fatura"],
  },
  alis_fatura: {
    key: "alis_fatura",
    slug: "alis-faturasi",
    label: "Alış Faturası",
    plural: "Alış Faturaları",
    module: "satinalma",
    prefix: "AFT",
    partner: "zorunlu",
    partnerRole: "tedarikci",
    lines: "urun",
    priced: true,
    stock: 1,
    partnerEffect: "alacak",
    cash: 0,
    hasDueDate: true,
    convertsTo: ["alis_iade"],
  },
  alis_iade: {
    key: "alis_iade",
    slug: "alis-iadesi",
    label: "Alış İade Faturası",
    plural: "Alış İadeleri",
    module: "satinalma",
    prefix: "AIF",
    partner: "zorunlu",
    partnerRole: "tedarikci",
    lines: "urun",
    priced: true,
    stock: -1,
    partnerEffect: "borc",
    cash: 0,
    hasDueDate: false,
    convertsTo: [],
  },
  depo_transfer: {
    key: "depo_transfer",
    slug: "depo-transfer",
    label: "Depo Transfer Fişi",
    plural: "Depo Transferleri",
    module: "stok",
    prefix: "TRF",
    partner: "yok",
    partnerRole: "hepsi",
    lines: "urun",
    priced: false,
    stock: 0,
    transfer: true,
    partnerEffect: null,
    cash: 0,
    hasDueDate: false,
    convertsTo: [],
  },
  tahsilat: {
    key: "tahsilat",
    slug: "tahsilat",
    label: "Tahsilat",
    plural: "Tahsilatlar",
    module: "kasa",
    prefix: "THS",
    partner: "zorunlu",
    partnerRole: "hepsi",
    lines: "yok",
    priced: true,
    stock: 0,
    partnerEffect: "alacak",
    cash: 1,
    hasDueDate: false,
    convertsTo: [],
  },
  tediye: {
    key: "tediye",
    slug: "odeme",
    label: "Ödeme",
    plural: "Ödemeler",
    module: "kasa",
    prefix: "ODM",
    partner: "zorunlu",
    partnerRole: "hepsi",
    lines: "yok",
    priced: true,
    stock: 0,
    partnerEffect: "borc",
    cash: -1,
    hasDueDate: false,
    convertsTo: [],
  },
  masraf: {
    key: "masraf",
    slug: "masraf",
    label: "Masraf Fişi",
    plural: "Masraf Fişleri",
    module: "masraf",
    prefix: "MSF",
    partner: "opsiyonel",
    partnerRole: "tedarikci",
    lines: "serbest",
    priced: true,
    stock: 0,
    partnerEffect: null,
    cash: -1,
    hasDueDate: false,
    convertsTo: [],
  },
};

export const DOC_TYPE_LIST = Object.values(DOC_TYPES);

const bySlug = new Map(DOC_TYPE_LIST.map((d) => [d.slug, d]));

export function docTypeBySlug(slug: string): DocTypeDef | undefined {
  return bySlug.get(slug);
}

export function isDocTypeKey(value: string): value is DocTypeKey {
  return value in DOC_TYPES;
}

export const DOC_STATUS = {
  taslak: { label: "Taslak", tone: "muted" },
  onayli: { label: "Onaylı", tone: "success" },
  iptal: { label: "İptal", tone: "danger" },
} as const;

export type DocStatus = keyof typeof DOC_STATUS;

/**
 * Bu belge bir kaynak belgeden türetildiyse stok hareketi tekrar oluşturulmamalı mı?
 * Örn. irsaliyeden kesilen fatura stoğu ikinci kez düşmez.
 */
export function stockAlreadyMovedBySource(
  type: DocTypeKey,
  sourceType: DocTypeKey | null | undefined,
): boolean {
  if (!sourceType) return false;
  const t = DOC_TYPES[type];
  const s = DOC_TYPES[sourceType];
  return t.stock !== 0 && s.stock === t.stock;
}

/** GİB numara biçimi: 3 harf + yıl + 9 haneli sıra (16 karakter). */
export function formatDocNumber(prefix: string, year: number, seq: number): string {
  return `${prefix}${year}${String(seq).padStart(9, "0")}`;
}
