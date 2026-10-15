// Stok sorguları: miktar, ortalama maliyet. Kaynak her zaman stock_movements'tır.
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import { products, stockMovements } from "@/server/db/schema";
import { dec, type Decimal } from "@/lib/money";

/**
 * Hareketli ağırlıklı ortalama maliyet. Çıkışlar o anki ortalama maliyetle
 * yazıldığı için (Σ miktar×maliyet) / Σ miktar ortalamayı verir.
 * Stok sıfır/eksi ise son giriş maliyeti, o da yoksa karttaki alış fiyatı kullanılır.
 */
export async function averageCost(exec: Executor, tenantId: string, productId: string): Promise<Decimal> {
  const [agg] = await exec
    .select({
      qty: sql<string>`coalesce(sum(${stockMovements.quantity}), 0)`,
      value: sql<string>`coalesce(sum(${stockMovements.quantity} * ${stockMovements.unitCost}), 0)`,
    })
    .from(stockMovements)
    .where(and(eq(stockMovements.tenantId, tenantId), eq(stockMovements.productId, productId)));
  const qty = dec(agg?.qty);
  if (qty.gt(0)) return dec(agg?.value).div(qty);

  const [lastIn] = await exec
    .select({ cost: stockMovements.unitCost })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.tenantId, tenantId),
        eq(stockMovements.productId, productId),
        sql`${stockMovements.quantity} > 0`,
        sql`${stockMovements.unitCost} > 0`,
      ),
    )
    .orderBy(sql`${stockMovements.date} desc, ${stockMovements.createdAt} desc`)
    .limit(1);
  if (lastIn) return dec(lastIn.cost);

  const [p] = await exec
    .select({ price: products.purchasePrice })
    .from(products)
    .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)));
  return dec(p?.price);
}

/** Ürünlerin toplam stok miktarları (tüm depolar veya tek depo). */
export async function stockQuantities(
  exec: Executor,
  tenantId: string,
  productIds: string[],
  warehouseId?: string,
): Promise<Map<string, Decimal>> {
  if (productIds.length === 0) return new Map();
  const conds = [eq(stockMovements.tenantId, tenantId), inArray(stockMovements.productId, productIds)];
  if (warehouseId) conds.push(eq(stockMovements.warehouseId, warehouseId));
  const rows = await exec
    .select({ productId: stockMovements.productId, qty: sql<string>`sum(${stockMovements.quantity})` })
    .from(stockMovements)
    .where(and(...conds))
    .groupBy(stockMovements.productId);
  return new Map(rows.map((r) => [r.productId, dec(r.qty)]));
}
