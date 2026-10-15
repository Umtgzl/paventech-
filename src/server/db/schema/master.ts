// Ana kartlar: cari (partners), ürün/stok kartı (products), depo (warehouses),
// kasa-banka hesabı (cashAccounts).
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createdAt, pk, qty, rate, tenantRef, updatedAt } from "./columns";

/** Cari kart: müşteri ve/veya tedarikçi */
export const partners = pgTable(
  "partners",
  {
    id: pk(),
    tenantId: tenantRef(),
    code: text().notNull(),
    name: text().notNull(),
    /** musteri | tedarikci | her_ikisi */
    kind: text().notNull().default("musteri"),
    taxOffice: text(),
    taxNumber: text(),
    contactName: text(),
    phone: text(),
    email: text(),
    city: text(),
    address: text(),
    paymentTermDays: integer().notNull().default(0),
    isActive: boolean().notNull().default(true),
    notes: text(),
    /** Sektöre özel alanlar (özel alan tanımları ile doldurulur) */
    custom: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex().on(t.tenantId, t.code),
    index().on(t.tenantId, t.name),
  ],
);

/** Ürün / stok kartı */
export const products = pgTable(
  "products",
  {
    id: pk(),
    tenantId: tenantRef(),
    code: text().notNull(),
    name: text().notNull(),
    /** ticari | mamul | yarimamul | hammadde | hizmet */
    kind: text().notNull().default("ticari"),
    category: text(),
    unit: text().notNull().default("ADET"),
    barcode: text(),
    vatRate: rate(),
    salePrice: qty(),
    purchasePrice: qty(),
    criticalLevel: qty(),
    trackStock: boolean().notNull().default(true),
    isActive: boolean().notNull().default(true),
    notes: text(),
    custom: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex().on(t.tenantId, t.code),
    index().on(t.tenantId, t.name),
  ],
);

export const warehouses = pgTable(
  "warehouses",
  {
    id: pk(),
    tenantId: tenantRef(),
    code: text().notNull(),
    name: text().notNull(),
    address: text(),
    isDefault: boolean().notNull().default(false),
    isActive: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex().on(t.tenantId, t.code)],
);

/** Kasa, banka, POS ve kredi kartı hesapları */
export const cashAccounts = pgTable(
  "cash_accounts",
  {
    id: pk(),
    tenantId: tenantRef(),
    code: text().notNull(),
    name: text().notNull(),
    /** kasa | banka | pos | kredi_karti */
    kind: text().notNull().default("kasa"),
    bankName: text(),
    iban: text(),
    currency: text().notNull().default("TRY"),
    isActive: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex().on(t.tenantId, t.code)],
);
