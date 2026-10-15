// Ana panel verileri. Tüm rakamlar onaylı belgelerden ve hareket defterlerinden türetilir.
import { and, desc, eq, gte, inArray, lte, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Executor } from "@/server/db/client";
import { documentLines, documents, partners, productionOrders, products } from "@/server/db/schema";
import { addDaysIso } from "@/lib/format";
import { dec, sumDec } from "@/lib/money";
import type { ModuleKey } from "@/lib/modules";
import { cashBalances, partnerBalances, stockStatus } from "@/server/ledger/queries";

function monthStart(iso: string) {
  return `${iso.slice(0, 7)}-01`;
}

function shiftMonth(iso: string, delta: number) {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 10);
}

async function sumByTypes(exec: Executor, tenantId: string, types: string[], from: string, to: string) {
  const [r] = await exec
    .select({ total: sql<string>`coalesce(sum(${documents.grandTotal}), 0)` })
    .from(documents)
    .where(
      and(
        eq(documents.tenantId, tenantId),
        inArray(documents.type, types),
        eq(documents.status, "onayli"),
        gte(documents.date, from),
        lte(documents.date, to),
      ),
    );
  return dec(r?.total);
}

export async function dashboardData(exec: Executor, tenantId: string, today: string, enabled: ModuleKey[]) {
  const has = (m: ModuleKey) => enabled.includes(m);
  const mStart = monthStart(today);
  const prevStart = shiftMonth(mStart, -1);
  // Geçen ayın aynı gününe kadar (adil karşılaştırma)
  const dayOfMonth = Number(today.slice(8, 10));
  const prevSameDay = addDaysIso(prevStart, Math.min(dayOfMonth, 28) - 1);

  const salesNow = has("satis")
    ? (await sumByTypes(exec, tenantId, ["satis_fatura"], mStart, today)).minus(await sumByTypes(exec, tenantId, ["satis_iade"], mStart, today))
    : dec(0);
  const salesPrev = has("satis")
    ? (await sumByTypes(exec, tenantId, ["satis_fatura"], prevStart, prevSameDay)).minus(
        await sumByTypes(exec, tenantId, ["satis_iade"], prevStart, prevSameDay),
      )
    : dec(0);
  const collectNow = has("kasa") ? await sumByTypes(exec, tenantId, ["tahsilat"], mStart, today) : dec(0);
  const collectPrev = has("kasa") ? await sumByTypes(exec, tenantId, ["tahsilat"], prevStart, prevSameDay) : dec(0);

  const balances = await partnerBalances(exec, tenantId, today);
  const receivable = sumDec(balances.filter((b) => dec(b.balance).gt(0)).map((b) => b.balance));
  const overdue = sumDec(balances.map((b) => b.overdue));
  const cash = has("kasa") ? sumDec((await cashBalances(exec, tenantId)).map((a) => a.balance)) : null;

  // Son 6 ay: satış ve alış (KDV dahil, iadeler düşülmüş)
  const sixStart = shiftMonth(mStart, -5);
  const monthlyRows = await exec
    .select({
      month: sql<string>`to_char(${documents.date}, 'YYYY-MM')`,
      type: documents.type,
      total: sql<string>`sum(${documents.grandTotal})`,
    })
    .from(documents)
    .where(
      and(
        eq(documents.tenantId, tenantId),
        eq(documents.status, "onayli"),
        inArray(documents.type, ["satis_fatura", "satis_iade", "alis_fatura", "alis_iade"]),
        gte(documents.date, sixStart),
        lte(documents.date, today),
      ),
    )
    .groupBy(sql`1`, documents.type);
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(sixStart, i).slice(0, 7));
  const monthly = months.map((m) => {
    const get = (t: string) => dec(monthlyRows.find((r) => r.month === m && r.type === t)?.total);
    return {
      month: m,
      sales: get("satis_fatura").minus(get("satis_iade")).toFixed(2),
      purchases: get("alis_fatura").minus(get("alis_iade")).toFixed(2),
    };
  });

  // Son 90 günde ciroya göre ilk 6 ürün (KDV hariç net)
  const topProducts = has("satis")
    ? await exec
        .select({
          id: products.id,
          name: products.name,
          unit: products.unit,
          revenue: sql<string>`sum(${documentLines.netAmount})`,
          quantity: sql<string>`sum(${documentLines.quantity})`,
        })
        .from(documentLines)
        .innerJoin(documents, eq(documents.id, documentLines.documentId))
        .innerJoin(products, eq(products.id, documentLines.productId))
        .where(
          and(
            eq(documents.tenantId, tenantId),
            eq(documents.type, "satis_fatura"),
            eq(documents.status, "onayli"),
            gte(documents.date, addDaysIso(today, -90)),
          ),
        )
        .groupBy(products.id, products.name, products.unit)
        .orderBy(sql`sum(${documentLines.netAmount}) desc`)
        .limit(6)
    : [];

  const critical = has("stok") ? (await stockStatus(exec, tenantId, { onlyCritical: true })).slice(0, 6) : [];

  // Bekleyen siparişler: onaylı ama irsaliye/faturaya dönüşmemiş
  const child = alias(documents, "child");
  const pendingOrders = has("satis")
    ? await exec
        .select({
          id: documents.id,
          number: documents.number,
          date: documents.date,
          total: documents.grandTotal,
          partnerName: partners.name,
        })
        .from(documents)
        .leftJoin(partners, eq(partners.id, documents.partnerId))
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
        .orderBy(desc(documents.date))
        .limit(6)
    : [];

  const overdueCustomers = balances
    .filter((b) => dec(b.overdue).gt(0))
    .sort((a, b) => dec(b.overdue).cmp(dec(a.overdue)))
    .slice(0, 5);

  const production = has("uretim")
    ? await exec
        .select({ status: productionOrders.status, n: sql<number>`count(*)::int` })
        .from(productionOrders)
        .where(and(eq(productionOrders.tenantId, tenantId), inArray(productionOrders.status, ["planlandi", "uretimde"])))
        .groupBy(productionOrders.status)
    : [];

  const recent = await exec
    .select({
      id: documents.id,
      type: documents.type,
      number: documents.number,
      status: documents.status,
      date: documents.date,
      total: documents.grandTotal,
      partnerName: partners.name,
    })
    .from(documents)
    .leftJoin(partners, eq(partners.id, documents.partnerId))
    .where(eq(documents.tenantId, tenantId))
    .orderBy(desc(documents.updatedAt))
    .limit(8);

  return {
    kpi: {
      salesNow: salesNow.toFixed(2),
      salesPrev: salesPrev.toFixed(2),
      collectNow: collectNow.toFixed(2),
      collectPrev: collectPrev.toFixed(2),
      receivable: receivable.toFixed(2),
      overdue: overdue.toFixed(2),
      cash: cash?.toFixed(2) ?? null,
    },
    monthly,
    topProducts,
    critical,
    pendingOrders,
    overdueCustomers,
    production,
    recent,
  };
}

export type DashboardData = Awaited<ReturnType<typeof dashboardData>>;
