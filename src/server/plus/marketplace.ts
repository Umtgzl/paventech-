// E-ticaret stok senkronu önizlemesi. Kanallara gönderilecek miktar:
// depodaki stok − açık siparişlerde ayrılan − emniyet payı (kritik seviye).
import { and, asc, eq, inArray, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Executor } from "@/server/db/client";
import { documentLines, documents, products } from "@/server/db/schema";
import { stockQuantities } from "@/server/ledger/stock";
import { dec, round2 } from "@/lib/money";

export interface SyncPreviewRow {
  id: string;
  code: string;
  name: string;
  unit: string;
  barcode: string | null;
  quantity: string;
  reserved: string;
  safety: string;
  /** Kanala gönderilecek tam sayı stok */
  publish: number;
  /** KDV dahil satış fiyatı */
  price: string;
}

export async function marketplaceSyncPreview(exec: Executor, tenantId: string): Promise<SyncPreviewRow[]> {
  const list = await exec
    .select({
      id: products.id,
      code: products.code,
      name: products.name,
      unit: products.unit,
      barcode: products.barcode,
      salePrice: products.salePrice,
      vatRate: products.vatRate,
      criticalLevel: products.criticalLevel,
    })
    .from(products)
    .where(
      and(
        eq(products.tenantId, tenantId),
        eq(products.isActive, true),
        eq(products.trackStock, true),
        inArray(products.kind, ["mamul", "ticari"]),
        sql`${products.salePrice} > 0`,
      ),
    )
    .orderBy(asc(products.name));
  if (list.length === 0) return [];

  // Onaylı ama irsaliye/faturaya dönüşmemiş satış siparişleri stoğu ayırır
  const child = alias(documents, "child");
  const reservedRows = await exec
    .select({ productId: documentLines.productId, qty: sql<string>`sum(${documentLines.quantity})` })
    .from(documentLines)
    .innerJoin(documents, eq(documents.id, documentLines.documentId))
    .where(
      and(
        eq(documents.tenantId, tenantId),
        eq(documents.type, "satis_siparis"),
        eq(documents.status, "onayli"),
        notExists(
          exec
            .select({ x: sql`1` })
            .from(child)
            .where(and(eq(child.sourceDocumentId, documents.id), sql`${child.status} <> 'iptal'`)),
        ),
      ),
    )
    .groupBy(documentLines.productId);
  const reserved = new Map(reservedRows.map((r) => [r.productId, dec(r.qty)]));
  const stock = await stockQuantities(exec, tenantId, list.map((p) => p.id));

  return list.map((p) => {
    const q = stock.get(p.id) ?? dec(0);
    const r = reserved.get(p.id) ?? dec(0);
    const free = q.minus(r).minus(dec(p.criticalLevel));
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      unit: p.unit,
      barcode: p.barcode,
      quantity: q.toString(),
      reserved: r.toString(),
      safety: p.criticalLevel,
      publish: free.gt(0) ? free.floor().toNumber() : 0,
      price: round2(dec(p.salePrice).times(dec(100).plus(dec(p.vatRate))).div(100)).toFixed(2),
    };
  });
}
