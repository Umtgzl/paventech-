// Hareket defterlerinden türetilen bakiyeler ve ekstreler.
// "server-only" içermez (testler ve seed de kullanır).
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import {
  cashAccounts,
  cashMovements,
  documents,
  partnerMovements,
  partners,
  products,
  stockMovements,
  warehouses,
} from "@/server/db/schema";
import { dec } from "@/lib/money";

// ---------------- Cari ----------------

export interface PartnerBalance {
  debit: string;
  credit: string;
  balance: string;
  overdue: string;
}

/**
 * Cari bakiye ve vadesi geçmiş tutar. Vadesi geçen tutar FIFO kabulüyle
 * hesaplanır: tahsilatlar önce en eski borçları kapatır.
 */
export async function partnerBalance(exec: Executor, tenantId: string, partnerId: string, today: string): Promise<PartnerBalance> {
  const [r] = await exec
    .select({
      debit: sql<string>`coalesce(sum(${partnerMovements.debit}), 0)`,
      credit: sql<string>`coalesce(sum(${partnerMovements.credit}), 0)`,
      notDue: sql<string>`coalesce(sum(case when ${partnerMovements.dueDate} > ${today} then ${partnerMovements.debit} else 0 end), 0)`,
    })
    .from(partnerMovements)
    .where(and(eq(partnerMovements.tenantId, tenantId), eq(partnerMovements.partnerId, partnerId)));
  return summarize(r.debit, r.credit, r.notDue);
}

function summarize(debit: string, credit: string, notDue: string): PartnerBalance {
  const balance = dec(debit).minus(dec(credit));
  const overdue = balance.minus(dec(notDue));
  return {
    debit: dec(debit).toFixed(2),
    credit: dec(credit).toFixed(2),
    balance: balance.toFixed(2),
    overdue: (overdue.gt(0) && balance.gt(0) ? overdue : dec(0)).toFixed(2),
  };
}

export interface PartnerBalanceRow extends PartnerBalance {
  id: string;
  code: string;
  name: string;
  kind: string;
  city: string | null;
}

export async function partnerBalances(
  exec: Executor,
  tenantId: string,
  today: string,
  opts: { q?: string; onlyOpen?: boolean } = {},
): Promise<PartnerBalanceRow[]> {
  const conds: SQL[] = [eq(partners.tenantId, tenantId)];
  if (opts.q?.trim()) {
    const like = `%${opts.q.trim()}%`;
    conds.push(or(ilike(partners.name, like), ilike(partners.code, like))!);
  }
  const agg = exec
    .select({
      partnerId: partnerMovements.partnerId,
      debit: sql<string>`sum(${partnerMovements.debit})`.as("debit"),
      credit: sql<string>`sum(${partnerMovements.credit})`.as("credit"),
      notDue: sql<string>`sum(case when ${partnerMovements.dueDate} > ${today} then ${partnerMovements.debit} else 0 end)`.as(
        "not_due",
      ),
    })
    .from(partnerMovements)
    .where(eq(partnerMovements.tenantId, tenantId))
    .groupBy(partnerMovements.partnerId)
    .as("agg");

  const rows = await exec
    .select({
      id: partners.id,
      code: partners.code,
      name: partners.name,
      kind: partners.kind,
      city: partners.city,
      debit: sql<string>`coalesce(${agg.debit}, 0)`,
      credit: sql<string>`coalesce(${agg.credit}, 0)`,
      notDue: sql<string>`coalesce(${agg.notDue}, 0)`,
    })
    .from(partners)
    .leftJoin(agg, eq(agg.partnerId, partners.id))
    .where(and(...conds))
    .orderBy(sql`abs(coalesce(${agg.debit}, 0) - coalesce(${agg.credit}, 0)) desc`, asc(partners.name));

  const out = rows.map((r) => ({ id: r.id, code: r.code, name: r.name, kind: r.kind, city: r.city, ...summarize(r.debit, r.credit, r.notDue) }));
  return opts.onlyOpen ? out.filter((r) => !dec(r.balance).isZero()) : out;
}

export interface StatementRow {
  id: string;
  date: string;
  dueDate: string | null;
  description: string | null;
  documentId: string | null;
  documentType: string | null;
  debit: string;
  credit: string;
  balance: string;
}

/** Cari ekstre: tarih sırasıyla hareketler ve yürüyen bakiye. */
export async function partnerStatement(exec: Executor, tenantId: string, partnerId: string): Promise<StatementRow[]> {
  const rows = await exec
    .select({
      id: partnerMovements.id,
      date: partnerMovements.date,
      dueDate: partnerMovements.dueDate,
      description: partnerMovements.description,
      documentId: partnerMovements.documentId,
      documentType: documents.type,
      debit: partnerMovements.debit,
      credit: partnerMovements.credit,
    })
    .from(partnerMovements)
    .leftJoin(documents, eq(documents.id, partnerMovements.documentId))
    .where(and(eq(partnerMovements.tenantId, tenantId), eq(partnerMovements.partnerId, partnerId)))
    .orderBy(asc(partnerMovements.date), asc(partnerMovements.createdAt));
  let running = dec(0);
  return rows.map((r) => {
    running = running.plus(dec(r.debit)).minus(dec(r.credit));
    return { ...r, balance: running.toFixed(2) };
  });
}

// ---------------- Stok ----------------

export interface StockStatusRow {
  id: string;
  code: string;
  name: string;
  kind: string;
  unit: string;
  category: string | null;
  criticalLevel: string;
  quantity: string;
  value: string;
  averageCost: string;
  critical: boolean;
}

export async function stockStatus(
  exec: Executor,
  tenantId: string,
  opts: { q?: string; warehouseId?: string; onlyCritical?: boolean } = {},
): Promise<StockStatusRow[]> {
  const mConds: SQL[] = [eq(stockMovements.tenantId, tenantId)];
  if (opts.warehouseId) mConds.push(eq(stockMovements.warehouseId, opts.warehouseId));
  const agg = exec
    .select({
      productId: stockMovements.productId,
      qty: sql<string>`sum(${stockMovements.quantity})`.as("qty"),
      value: sql<string>`sum(${stockMovements.quantity} * ${stockMovements.unitCost})`.as("value"),
    })
    .from(stockMovements)
    .where(and(...mConds))
    .groupBy(stockMovements.productId)
    .as("agg");

  const pConds: SQL[] = [eq(products.tenantId, tenantId), eq(products.trackStock, true)];
  if (opts.q?.trim()) {
    const like = `%${opts.q.trim()}%`;
    pConds.push(or(ilike(products.name, like), ilike(products.code, like), ilike(products.barcode, like))!);
  }
  const rows = await exec
    .select({
      id: products.id,
      code: products.code,
      name: products.name,
      kind: products.kind,
      unit: products.unit,
      category: products.category,
      criticalLevel: products.criticalLevel,
      qty: sql<string>`coalesce(${agg.qty}, 0)`,
      value: sql<string>`coalesce(${agg.value}, 0)`,
    })
    .from(products)
    .leftJoin(agg, eq(agg.productId, products.id))
    .where(and(...pConds))
    .orderBy(asc(products.name));

  const out = rows.map((r) => {
    const qty = dec(r.qty);
    const critical = dec(r.criticalLevel).gt(0) && qty.lte(dec(r.criticalLevel));
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      kind: r.kind,
      unit: r.unit,
      category: r.category,
      criticalLevel: r.criticalLevel,
      quantity: qty.toFixed(4),
      value: dec(r.value).toFixed(2),
      averageCost: qty.gt(0) ? dec(r.value).div(qty).toFixed(4) : "0",
      critical,
    };
  });
  return opts.onlyCritical ? out.filter((r) => r.critical) : out;
}

export async function stockByWarehouse(exec: Executor, tenantId: string, productId: string) {
  const rows = await exec
    .select({
      warehouseId: warehouses.id,
      code: warehouses.code,
      name: warehouses.name,
      qty: sql<string>`coalesce(sum(${stockMovements.quantity}), 0)`,
    })
    .from(warehouses)
    .leftJoin(
      stockMovements,
      and(eq(stockMovements.warehouseId, warehouses.id), eq(stockMovements.productId, productId)),
    )
    .where(eq(warehouses.tenantId, tenantId))
    .groupBy(warehouses.id, warehouses.code, warehouses.name)
    .orderBy(asc(warehouses.code));
  return rows.map((r) => ({ ...r, qty: dec(r.qty).toFixed(4) }));
}

export interface MovementRow {
  id: string;
  date: string;
  kind: string;
  quantity: string;
  unitCost: string;
  productId: string;
  productName: string;
  productCode: string;
  unit: string;
  warehouseName: string;
  documentId: string | null;
  documentNumber: string | null;
  documentType: string | null;
}

export async function stockMovementList(
  exec: Executor,
  tenantId: string,
  opts: { productId?: string; warehouseId?: string; limit?: number } = {},
): Promise<MovementRow[]> {
  const conds: SQL[] = [eq(stockMovements.tenantId, tenantId)];
  if (opts.productId) conds.push(eq(stockMovements.productId, opts.productId));
  if (opts.warehouseId) conds.push(eq(stockMovements.warehouseId, opts.warehouseId));
  return exec
    .select({
      id: stockMovements.id,
      date: stockMovements.date,
      kind: stockMovements.kind,
      quantity: stockMovements.quantity,
      unitCost: stockMovements.unitCost,
      productId: stockMovements.productId,
      productName: products.name,
      productCode: products.code,
      unit: products.unit,
      warehouseName: warehouses.name,
      documentId: stockMovements.documentId,
      documentNumber: documents.number,
      documentType: documents.type,
    })
    .from(stockMovements)
    .innerJoin(products, eq(products.id, stockMovements.productId))
    .innerJoin(warehouses, eq(warehouses.id, stockMovements.warehouseId))
    .leftJoin(documents, eq(documents.id, stockMovements.documentId))
    .where(and(...conds))
    .orderBy(desc(stockMovements.date), desc(stockMovements.createdAt))
    .limit(opts.limit ?? 200);
}

// ---------------- Kasa / Banka ----------------

export interface CashBalanceRow {
  id: string;
  code: string;
  name: string;
  kind: string;
  bankName: string | null;
  iban: string | null;
  currency: string;
  isActive: boolean;
  balance: string;
}

export async function cashBalances(exec: Executor, tenantId: string): Promise<CashBalanceRow[]> {
  const rows = await exec
    .select({
      id: cashAccounts.id,
      code: cashAccounts.code,
      name: cashAccounts.name,
      kind: cashAccounts.kind,
      bankName: cashAccounts.bankName,
      iban: cashAccounts.iban,
      currency: cashAccounts.currency,
      isActive: cashAccounts.isActive,
      balance: sql<string>`coalesce(sum(${cashMovements.amount}), 0)`,
    })
    .from(cashAccounts)
    .leftJoin(cashMovements, eq(cashMovements.cashAccountId, cashAccounts.id))
    .where(eq(cashAccounts.tenantId, tenantId))
    .groupBy(cashAccounts.id)
    .orderBy(asc(cashAccounts.code));
  return rows.map((r) => ({ ...r, balance: dec(r.balance).toFixed(2) }));
}

export async function cashStatement(exec: Executor, tenantId: string, accountId: string) {
  const rows = await exec
    .select({
      id: cashMovements.id,
      date: cashMovements.date,
      amount: cashMovements.amount,
      description: cashMovements.description,
      documentId: cashMovements.documentId,
      partnerId: cashMovements.partnerId,
      partnerName: partners.name,
    })
    .from(cashMovements)
    .leftJoin(partners, eq(partners.id, cashMovements.partnerId))
    .where(and(eq(cashMovements.tenantId, tenantId), eq(cashMovements.cashAccountId, accountId)))
    .orderBy(asc(cashMovements.date), asc(cashMovements.createdAt));
  let running = dec(0);
  return rows.map((r) => {
    running = running.plus(dec(r.amount));
    return { ...r, balance: running.toFixed(2) };
  });
}

export async function productsByIds(exec: Executor, tenantId: string, ids: string[]) {
  if (ids.length === 0) return [];
  return exec
    .select({ id: products.id, code: products.code, name: products.name, unit: products.unit })
    .from(products)
    .where(and(eq(products.tenantId, tenantId), inArray(products.id, ids)));
}
