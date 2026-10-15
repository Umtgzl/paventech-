import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { suspensePage } from "@/components/page/suspense-page";
import { DealerSelect, PortalPreview } from "@/components/plus/portal-preview";
import { PlusHeader } from "@/components/plus/plus-header";
import { formatDate, todayIso } from "@/lib/format";
import { dec } from "@/lib/money";
import { db } from "@/server/db";
import { documents, partners, products } from "@/server/db/schema";
import { partnerBalance, stockStatus } from "@/server/ledger/queries";
import { requireModule } from "@/server/session";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default suspensePage(async function B2bPage(props: PageProps<"/plus/b2b">) {
  const ctx = await requireModule("b2b");
  const sp = await props.searchParams;
  const dealers = await db
    .select({ id: partners.id, name: partners.name, city: partners.city })
    .from(partners)
    .where(and(eq(partners.tenantId, ctx.tenantId), inArray(partners.kind, ["musteri", "her_ikisi"]), eq(partners.isActive, true)))
    .orderBy(asc(partners.name));
  const selected = dealers.find((d) => d.id === one(sp.bayi)) ?? dealers[0];

  if (!selected) {
    return <PlusHeader module="B2B Portal" title="B2B Bayi Portalı" description="Portal önizlemesi için önce müşteri cari kartı açın." />;
  }

  const today = todayIso();
  const [balance, invoices, orders, catalogRows, stock] = await Promise.all([
    partnerBalance(db, ctx.tenantId, selected.id, today),
    db
      .select({ id: documents.id, number: documents.number, date: documents.date, dueDate: documents.dueDate, total: documents.grandTotal })
      .from(documents)
      .where(and(eq(documents.tenantId, ctx.tenantId), eq(documents.partnerId, selected.id), eq(documents.type, "satis_fatura"), eq(documents.status, "onayli")))
      .orderBy(desc(documents.date))
      .limit(6),
    db
      .select({ id: documents.id, number: documents.number, status: documents.status, date: documents.date, total: documents.grandTotal, notes: documents.notes })
      .from(documents)
      .where(and(eq(documents.tenantId, ctx.tenantId), eq(documents.partnerId, selected.id), eq(documents.type, "satis_siparis")))
      .orderBy(desc(documents.createdAt))
      .limit(6),
    db
      .select({ id: products.id, name: products.name, code: products.code, unit: products.unit, price: products.salePrice, vat: products.vatRate, category: products.category })
      .from(products)
      .where(and(eq(products.tenantId, ctx.tenantId), eq(products.isActive, true), inArray(products.kind, ["mamul", "ticari"])))
      .orderBy(asc(products.category), asc(products.name)),
    stockStatus(db, ctx.tenantId),
  ]);
  const stockMap = new Map(stock.map((s) => [s.id, dec(s.quantity)]));

  return (
    <>
      <PlusHeader
        module="B2B Portal"
        title="B2B Bayi Portalı"
        description="Bayilerinizin kendi şifreleriyle girip ekstre gördüğü ve sipariş verdiği portal. Aşağıda seçtiğiniz bayinin gözünden önizleme var."
        note="Önizleme ana uygulamanın içinde çalışır. Canlı sürümde bayiler ayrı bir adresten (bayi.sirketiniz.com) kendi kullanıcılarıyla girecek; fiyat listesi ve iskontolar bayiye özel tanımlanacak."
        actions={<DealerSelect dealers={dealers.map((d) => ({ value: d.id, label: `${d.name}${d.city ? ` · ${d.city}` : ""}` }))} value={selected.id} />}
      />
      <PortalPreview
        companyName={ctx.tenantName}
        dealer={{ id: selected.id, name: selected.name }}
        balance={balance}
        invoices={invoices.map((i) => ({ ...i, date: formatDate(i.date), dueDate: formatDate(i.dueDate) }))}
        orders={orders.map((o) => ({ ...o, date: formatDate(o.date) }))}
        catalog={catalogRows
          .filter((p) => dec(p.price).gt(0))
          .map((p) => {
            const q = stockMap.get(p.id) ?? dec(0);
            return {
              id: p.id,
              name: p.name,
              code: p.code,
              unit: p.unit,
              price: p.price,
              vat: p.vat,
              category: p.category ?? "Diğer",
              availability: q.gt(10) ? "var" : q.gt(0) ? "sinirli" : "yok",
            } as const;
          })}
      />
    </>
  );
});
