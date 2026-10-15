// Üretim: reçete (BOM) satırları, reçeteye göre maliyet, malzeme ihtiyacı ve
// iş emri tamamlama (hammadde çıkışı + mamul girişi). "server-only" içermez.
import { and, asc, eq, inArray } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import { bomLines, boms, productionOrders, products, stockMovements, warehouses } from "@/server/db/schema";
import { dec, parseDecimalInput, toQtyString, type Decimal } from "@/lib/money";
import { UserError } from "@/server/domain/errors";
import { onStockChanged } from "@/server/domain/automation";
import { averageCost, stockQuantities } from "@/server/ledger/stock";

export interface BomLineInput {
  productId: string;
  quantity: string;
  wasteRate?: string;
  notes?: string | null;
}

export async function getBom(exec: Executor, tenantId: string, bomId: string) {
  const [bom] = await exec
    .select({
      id: boms.id,
      code: boms.code,
      name: boms.name,
      productId: boms.productId,
      outputQuantity: boms.outputQuantity,
      isActive: boms.isActive,
      notes: boms.notes,
      productName: products.name,
      productCode: products.code,
      productUnit: products.unit,
      salePrice: products.salePrice,
    })
    .from(boms)
    .innerJoin(products, eq(products.id, boms.productId))
    .where(and(eq(boms.tenantId, tenantId), eq(boms.id, bomId)));
  if (!bom) return null;
  const lines = await exec
    .select({
      id: bomLines.id,
      productId: bomLines.productId,
      quantity: bomLines.quantity,
      wasteRate: bomLines.wasteRate,
      notes: bomLines.notes,
      productName: products.name,
      productCode: products.code,
      unit: products.unit,
    })
    .from(bomLines)
    .innerJoin(products, eq(products.id, bomLines.productId))
    .where(eq(bomLines.bomId, bomId))
    .orderBy(asc(products.name));
  return { ...bom, lines };
}

/** Reçete satırlarını tamamen değiştirir. */
export async function saveBomLines(exec: Executor, tenantId: string, bomId: string, input: BomLineInput[]) {
  const bom = await getBom(exec, tenantId, bomId);
  if (!bom) throw new UserError("Reçete bulunamadı.");
  const fe: Record<string, string> = {};
  const clean: { productId: string; quantity: string; wasteRate: string; notes: string | null }[] = [];
  const ids = input.map((l) => l.productId).filter(Boolean);
  const found = ids.length
    ? await exec
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.tenantId, tenantId), inArray(products.id, ids)))
    : [];
  const valid = new Set(found.map((p) => p.id));
  const seen = new Set<string>();
  input.forEach((l, i) => {
    if (!l.productId && !l.quantity) return;
    if (!l.productId || !valid.has(l.productId)) fe[`lines.${i}.productId`] = `${i + 1}. satırda bileşen seçin.`;
    else if (l.productId === bom.productId) fe[`lines.${i}.productId`] = "Mamul kendi reçetesinde bileşen olamaz.";
    else if (seen.has(l.productId)) fe[`lines.${i}.productId`] = `${i + 1}. satırdaki bileşen tekrar ediyor.`;
    const q = parseDecimalInput(l.quantity);
    if (!q || dec(q).lte(0)) fe[`lines.${i}.quantity`] = `${i + 1}. satırda miktar sıfırdan büyük olmalı.`;
    const w = parseDecimalInput(l.wasteRate || "0");
    if (w === null || dec(w).lt(0) || dec(w).gt(100)) fe[`lines.${i}.wasteRate`] = `${i + 1}. satırda fire 0-100 olmalı.`;
    if (l.productId) seen.add(l.productId);
    clean.push({ productId: l.productId, quantity: q ?? "0", wasteRate: w ?? "0", notes: l.notes?.trim() || null });
  });
  if (Object.keys(fe).length) throw new UserError("Lütfen işaretli satırları düzeltin.", fe);
  await exec.delete(bomLines).where(eq(bomLines.bomId, bomId));
  if (clean.length) {
    await exec.insert(bomLines).values(clean.map((l) => ({ ...l, tenantId, bomId, quantity: toQtyString(l.quantity) })));
  }
}

/** Bir birim mamulün reçeteye göre maliyeti (bileşenlerin ortalama maliyeti + fire). */
export async function bomCost(exec: Executor, tenantId: string, bomId: string) {
  const bom = await getBom(exec, tenantId, bomId);
  if (!bom) return null;
  const output = dec(bom.outputQuantity).gt(0) ? dec(bom.outputQuantity) : dec(1);
  let total = dec(0);
  const lines: { productId: string; productName: string; unit: string; perUnit: Decimal; unitCost: Decimal; cost: Decimal }[] = [];
  for (const l of bom.lines) {
    const perUnit = dec(l.quantity).mul(dec(1).plus(dec(l.wasteRate).div(100))).div(output);
    const unitCost = await averageCost(exec, tenantId, l.productId);
    const cost = perUnit.mul(unitCost);
    total = total.plus(cost);
    lines.push({ productId: l.productId, productName: l.productName, unit: l.unit, perUnit, unitCost, cost });
  }
  return { bom, unitCost: total, lines };
}

async function loadOrder(exec: Executor, tenantId: string, orderId: string, lock = false) {
  const q = exec
    .select()
    .from(productionOrders)
    .where(and(eq(productionOrders.tenantId, tenantId), eq(productionOrders.id, orderId)));
  const [order] = lock ? await q.for("update") : await q;
  if (!order) throw new UserError("İş emri bulunamadı.");
  return order;
}

async function orderWarehouse(exec: Executor, tenantId: string, warehouseId: string | null) {
  if (warehouseId) return warehouseId;
  const [w] = await exec
    .select({ id: warehouses.id })
    .from(warehouses)
    .where(and(eq(warehouses.tenantId, tenantId), eq(warehouses.isDefault, true)));
  if (!w) throw new UserError("Varsayılan depo tanımlı değil.");
  return w.id;
}

/** İş emri için malzeme ihtiyaç listesi: gereken miktar ve depodaki stok. */
export async function materialRequirements(exec: Executor, tenantId: string, orderId: string) {
  const order = await loadOrder(exec, tenantId, orderId);
  const bom = await getBom(exec, tenantId, order.bomId);
  if (!bom) throw new UserError("Reçete bulunamadı.");
  const warehouseId = await orderWarehouse(exec, tenantId, order.warehouseId);
  const factor = dec(order.quantity).div(dec(bom.outputQuantity).gt(0) ? dec(bom.outputQuantity) : dec(1));
  const stock = await stockQuantities(exec, tenantId, bom.lines.map((l) => l.productId), warehouseId);
  return {
    order,
    bom,
    warehouseId,
    lines: bom.lines.map((l) => {
      const required = dec(l.quantity).mul(factor).mul(dec(1).plus(dec(l.wasteRate).div(100)));
      const available = stock.get(l.productId) ?? dec(0);
      return {
        productId: l.productId,
        productName: l.productName,
        productCode: l.productCode,
        unit: l.unit,
        required: required.toFixed(4),
        available: available.toFixed(4),
        shortage: available.lt(required) ? required.minus(available).toFixed(4) : "0",
      };
    }),
  };
}

export async function startProductionOrder(exec: Executor, tenantId: string, orderId: string) {
  const order = await loadOrder(exec, tenantId, orderId, true);
  if (order.status !== "planlandi") throw new UserError("Yalnızca planlanan iş emri üretime alınabilir.");
  await exec.update(productionOrders).set({ status: "uretimde" }).where(eq(productionOrders.id, orderId));
}

/**
 * Üretimi tamamlar: reçetedeki bileşenler fire dahil stoktan düşer (ortalama maliyetle),
 * mamul toplam bileşen maliyetiyle stoğa girer. Hepsi tek transaction içinde.
 */
export async function completeProductionOrder(exec: Executor, tenantId: string, orderId: string, today: string) {
  const order = await loadOrder(exec, tenantId, orderId, true);
  if (order.status === "tamamlandi") throw new UserError("İş emri zaten tamamlanmış.");
  if (order.status === "iptal") throw new UserError("İptal edilmiş iş emri tamamlanamaz.");
  const req = await materialRequirements(exec, tenantId, orderId);
  if (req.lines.length === 0) throw new UserError("Reçetede bileşen yok. Önce reçete satırlarını girin.");
  const qty = dec(order.quantity);
  if (qty.lte(0)) throw new UserError("Üretim miktarı sıfırdan büyük olmalı.");

  let totalCost = dec(0);
  for (const l of req.lines) {
    const unitCost = await averageCost(exec, tenantId, l.productId);
    const consumed = dec(l.required);
    totalCost = totalCost.plus(consumed.mul(unitCost));
    await exec.insert(stockMovements).values({
      tenantId,
      productId: l.productId,
      warehouseId: req.warehouseId,
      productionOrderId: orderId,
      date: today,
      quantity: toQtyString(consumed.neg()),
      unitCost: toQtyString(unitCost),
      kind: "uretim",
    });
  }
  await exec.insert(stockMovements).values({
    tenantId,
    productId: req.bom.productId,
    warehouseId: req.warehouseId,
    productionOrderId: orderId,
    date: today,
    quantity: toQtyString(qty),
    unitCost: toQtyString(totalCost.div(qty)),
    kind: "uretim",
  });
  await exec
    .update(productionOrders)
    .set({ status: "tamamlandi", completedAt: new Date() })
    .where(eq(productionOrders.id, orderId));
  await onStockChanged(exec, tenantId, req.lines.map((l) => l.productId));
  return { unitCost: totalCost.div(qty).toFixed(4), totalCost: totalCost.toFixed(2) };
}

export async function productionMovements(exec: Executor, tenantId: string, orderId: string) {
  return exec
    .select({
      id: stockMovements.id,
      quantity: stockMovements.quantity,
      unitCost: stockMovements.unitCost,
      productId: stockMovements.productId,
      productName: products.name,
      unit: products.unit,
    })
    .from(stockMovements)
    .innerJoin(products, eq(products.id, stockMovements.productId))
    .where(and(eq(stockMovements.tenantId, tenantId), eq(stockMovements.productionOrderId, orderId)));
}
