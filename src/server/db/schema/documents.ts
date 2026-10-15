// Belge motoru tabloları ve belgelerin ürettiği hareket defterleri.
//
// Kural: Bakiye hiçbir yerde elle tutulmaz. Onaylanan her belge değiştirilemez
// hareketler üretir (stok, cari, kasa); bakiyeler bu hareketlerin toplamıdır.
// Onaylı belge silinmez, iptal edilir ve iptal ters kayıt üretir.
import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { cashAccounts, partners, products, warehouses } from "./master";
import { productionOrders } from "./modules";
import { createdAt, money, pk, qty, rate, tenantRef, updatedAt } from "./columns";

export const documents = pgTable(
  "documents",
  {
    id: pk(),
    tenantId: tenantRef(),
    /** Belge türü anahtarı, bkz. src/lib/documents/types.ts */
    type: text().notNull(),
    /** Onayda atanır: ör. SFT2026000000001 (GİB e-Fatura numara biçimi) */
    number: text(),
    /** taslak | onayli | iptal */
    status: text().notNull().default("taslak"),
    date: date({ mode: "string" }).notNull(),
    dueDate: date({ mode: "string" }),
    partnerId: uuid().references(() => partners.id),
    warehouseId: uuid().references(() => warehouses.id),
    targetWarehouseId: uuid().references(() => warehouses.id),
    cashAccountId: uuid().references(() => cashAccounts.id),
    /** Virmanda paranın gittiği hesap */
    targetCashAccountId: uuid().references(() => cashAccounts.id),
    currency: text().notNull().default("TRY"),
    subtotal: money(),
    discountTotal: money(),
    vatTotal: money(),
    grandTotal: money(),
    notes: text(),
    sourceDocumentId: uuid().references((): AnyPgColumn => documents.id),
    /** e-Dönüşüm durumu: null | taslak | gonderildi | kabul | ret */
    eStatus: text(),
    approvedAt: timestamp({ withTimezone: true }),
    approvedBy: text().references(() => user.id, { onDelete: "set null" }),
    cancelledAt: timestamp({ withTimezone: true }),
    createdBy: text().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex().on(t.tenantId, t.type, t.number),
    index().on(t.tenantId, t.type, t.date),
    index().on(t.tenantId, t.partnerId),
  ],
);

export const documentLines = pgTable(
  "document_lines",
  {
    id: pk(),
    tenantId: tenantRef(),
    documentId: uuid()
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    lineNo: integer().notNull(),
    productId: uuid().references(() => products.id),
    description: text(),
    quantity: qty(),
    unit: text().notNull().default("ADET"),
    unitPrice: qty(),
    discountRate: rate(),
    vatRate: rate(),
    grossAmount: money(),
    discountAmount: money(),
    netAmount: money(),
    vatAmount: money(),
    totalAmount: money(),
  },
  (t) => [index().on(t.documentId)],
);

/** Stok hareketleri: giriş pozitif, çıkış negatif miktar */
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: pk(),
    tenantId: tenantRef(),
    productId: uuid()
      .notNull()
      .references(() => products.id),
    warehouseId: uuid()
      .notNull()
      .references(() => warehouses.id),
    documentId: uuid().references(() => documents.id),
    documentLineId: uuid(),
    /** Üretimden doğan hareketlerde iş emri */
    productionOrderId: uuid().references((): AnyPgColumn => productionOrders.id),
    date: date({ mode: "string" }).notNull(),
    quantity: qty(),
    /** Birim maliyet (giriş: alış fiyatı, çıkış: o anki ortalama maliyet) */
    unitCost: qty(),
    /** giris | cikis | transfer | uretim | acilis | iptal */
    kind: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.tenantId, t.productId, t.warehouseId),
    index().on(t.tenantId, t.date),
  ],
);

/** Cari hareketler: borç (debit) ve alacak (credit). Bakiye = borç - alacak */
export const partnerMovements = pgTable(
  "partner_movements",
  {
    id: pk(),
    tenantId: tenantRef(),
    partnerId: uuid()
      .notNull()
      .references(() => partners.id),
    documentId: uuid().references(() => documents.id),
    date: date({ mode: "string" }).notNull(),
    dueDate: date({ mode: "string" }),
    debit: money(),
    credit: money(),
    description: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.tenantId, t.partnerId, t.date)],
);

/** Kasa/banka hareketleri: giriş pozitif, çıkış negatif tutar */
export const cashMovements = pgTable(
  "cash_movements",
  {
    id: pk(),
    tenantId: tenantRef(),
    cashAccountId: uuid()
      .notNull()
      .references(() => cashAccounts.id),
    documentId: uuid().references(() => documents.id),
    partnerId: uuid().references(() => partners.id),
    date: date({ mode: "string" }).notNull(),
    amount: money(),
    description: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.tenantId, t.cashAccountId, t.date)],
);
