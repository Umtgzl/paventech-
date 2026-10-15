import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { cashAccounts, partners, products, warehouses } from "@/server/db/schema";
import type { DocTypeDef } from "@/lib/documents/types";
import { partnerBalances, stockStatus } from "@/server/ledger/queries";

export interface PartnerOption {
  value: string;
  label: string;
  hint?: string;
  termDays: number;
  balance?: string;
}

export interface ProductOption {
  value: string;
  label: string;
  hint: string;
  unit: string;
  salePrice: string;
  purchasePrice: string;
  vatRate: string;
  stock: string | null;
}

export interface DocumentFormData {
  partners: PartnerOption[];
  products: ProductOption[];
  warehouses: { value: string; label: string; isDefault: boolean }[];
  cashAccounts: { value: string; label: string; hint: string }[];
}

/** Belge formundaki seçim listeleri (cari, ürün, depo, kasa). */
export async function loadDocumentFormData(tenantId: string, def: DocTypeDef, today: string): Promise<DocumentFormData> {
  const kinds =
    def.partnerRole === "musteri"
      ? ["musteri", "her_ikisi"]
      : def.partnerRole === "tedarikci"
        ? ["tedarikci", "her_ikisi"]
        : ["musteri", "tedarikci", "her_ikisi"];

  const [partnerRows, productRows, warehouseRows, cashRows, stock, balances] = await Promise.all([
    def.partner === "yok"
      ? Promise.resolve([])
      : db
          .select({ id: partners.id, code: partners.code, name: partners.name, city: partners.city, term: partners.paymentTermDays })
          .from(partners)
          .where(and(eq(partners.tenantId, tenantId), eq(partners.isActive, true), inArray(partners.kind, kinds)))
          .orderBy(asc(partners.name)),
    def.lines === "urun"
      ? db
          .select({
            id: products.id,
            code: products.code,
            name: products.name,
            unit: products.unit,
            salePrice: products.salePrice,
            purchasePrice: products.purchasePrice,
            vatRate: products.vatRate,
            trackStock: products.trackStock,
          })
          .from(products)
          .where(and(eq(products.tenantId, tenantId), eq(products.isActive, true)))
          .orderBy(asc(products.name))
      : Promise.resolve([]),
    db
      .select({ id: warehouses.id, name: warehouses.name, isDefault: warehouses.isDefault })
      .from(warehouses)
      .where(and(eq(warehouses.tenantId, tenantId), eq(warehouses.isActive, true)))
      .orderBy(asc(warehouses.code)),
    def.cash !== 0
      ? db
          .select({ id: cashAccounts.id, name: cashAccounts.name, kind: cashAccounts.kind })
          .from(cashAccounts)
          .where(and(eq(cashAccounts.tenantId, tenantId), eq(cashAccounts.isActive, true)))
          .orderBy(asc(cashAccounts.code))
      : Promise.resolve([]),
    def.lines === "urun" ? stockStatus(db, tenantId) : Promise.resolve([]),
    def.lines === "yok" ? partnerBalances(db, tenantId, today) : Promise.resolve([]),
  ]);

  const stockMap = new Map(stock.map((s) => [s.id, s.quantity]));
  const balanceMap = new Map(balances.map((b) => [b.id, b.balance]));
  const KIND: Record<string, string> = { kasa: "Kasa", banka: "Banka", pos: "POS", kredi_karti: "Kredi kartı" };

  return {
    partners: partnerRows.map((p) => ({
      value: p.id,
      label: p.name,
      hint: [p.code, p.city].filter(Boolean).join(" · "),
      termDays: p.term,
      balance: balanceMap.get(p.id),
    })),
    products: productRows.map((p) => ({
      value: p.id,
      label: p.name,
      hint: p.code,
      unit: p.unit,
      salePrice: p.salePrice,
      purchasePrice: p.purchasePrice,
      vatRate: p.vatRate,
      stock: p.trackStock ? (stockMap.get(p.id) ?? "0") : null,
    })),
    warehouses: warehouseRows.map((w) => ({ value: w.id, label: w.name, isDefault: w.isDefault })),
    cashAccounts: cashRows.map((c) => ({ value: c.id, label: c.name, hint: KIND[c.kind] ?? c.kind })),
  };
}
