// Plus modüllerin tabloları. Prototipte entegrasyonlar örnek veriyle çalışır;
// gerçek entegratör/pazaryeri/AI bağlantıları bu tabloların üstüne kurulacak.
import {
  boolean,
  date,
  index,
  jsonb,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { documents } from "./documents";
import { createdAt, money, pk, tenantRef, updatedAt } from "./columns";

export type InboxLine = {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  vatRate: string;
};

/** Entegratörden gelen e-faturalar (UBL-TR XML'den çözülmüş hali) */
export const einvoiceInbox = pgTable(
  "einvoice_inbox",
  {
    id: pk(),
    tenantId: tenantRef(),
    /** ETTN (UUID) */
    ettn: text().notNull(),
    number: text().notNull(),
    date: date({ mode: "string" }).notNull(),
    supplierName: text().notNull(),
    supplierTaxNumber: text().notNull(),
    grandTotal: money(),
    lines: jsonb().$type<InboxLine[]>().notNull().default([]),
    /** yeni | islendi | reddedildi */
    status: text().notNull().default("yeni"),
    createdDocumentId: uuid().references(() => documents.id),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.tenantId, t.status)],
);

/**
 * Tedarikçinin ürün adı -> bizim stok kartımız eşleşmeleri.
 * Kullanıcı bir eşleştirmeyi onayladığında öğrenilir, sonraki faturada otomatik gelir.
 */
export const supplierProductMap = pgTable(
  "supplier_product_map",
  {
    id: pk(),
    tenantId: tenantRef(),
    supplierTaxNumber: text().notNull(),
    supplierItemName: text().notNull(),
    productId: uuid().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.tenantId, t.supplierTaxNumber)],
);

/** Olay tabanlı otomasyon kuralları */
export const automationRules = pgTable(
  "automation_rules",
  {
    id: pk(),
    tenantId: tenantRef(),
    /** Sistemde tanımlı kural şablonu anahtarı */
    template: text().notNull(),
    name: text().notNull(),
    trigger: text().notNull(),
    action: text().notNull(),
    config: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    enabled: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.tenantId, t.template)],
);
