import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowRight, Boxes, Landmark, Users } from "lucide-react";
import { DocumentActions } from "@/components/documents/document-actions";
import { EDocumentPanel } from "@/components/documents/e-document-panel";
import { DocStatusBadge } from "@/components/documents/status-badge";
import { PageHeader } from "@/components/page/page-header";
import { suspensePage } from "@/components/page/suspense-page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calcTotals } from "@/lib/documents/calc";
import { DOC_TYPES, isDocTypeKey } from "@/lib/documents/types";
import { formatDate, formatDateTime, formatMoney, formatQty } from "@/lib/format";
import { MODULE_MAP } from "@/lib/modules";
import { dec } from "@/lib/money";
import { db } from "@/server/db";
import { cashMovements, partnerMovements, stockMovements } from "@/server/db/schema";
import { getDocument } from "@/server/documents/queries";
import { getTenantContext, hasModule } from "@/server/session";

export default suspensePage(async function DocumentDetailPage(props: PageProps<"/belge/detay/[id]">) {
  const { id } = await props.params;
  const ctx = await getTenantContext();
  const d = await getDocument(db, ctx.tenantId, id);
  if (!d || !isDocTypeKey(d.doc.type)) notFound();
  const def = DOC_TYPES[d.doc.type];
  if (!hasModule(ctx, def.module)) notFound();
  const doc = d.doc;

  const [stock, cari, cash] = await Promise.all([
    db.select().from(stockMovements).where(and(eq(stockMovements.tenantId, ctx.tenantId), eq(stockMovements.documentId, id))),
    db.select().from(partnerMovements).where(and(eq(partnerMovements.tenantId, ctx.tenantId), eq(partnerMovements.documentId, id))),
    db.select().from(cashMovements).where(and(eq(cashMovements.tenantId, ctx.tenantId), eq(cashMovements.documentId, id))),
  ]);

  const totals = calcTotals(d.lines);
  const effects: string[] = [];
  if (def.stock < 0) effects.push("Stoktan çıkış yapılacak");
  if (def.stock > 0) effects.push("Stoğa giriş yapılacak");
  if (def.transfer) effects.push("Stok depolar arasında taşınacak");
  if (def.partnerEffect === "borc") effects.push("Cari hesaba borç yazılacak");
  if (def.partnerEffect === "alacak") effects.push("Cari hesaba alacak yazılacak");
  if (def.cash > 0) effects.push("Kasa / bankaya giriş yapılacak");
  if (def.cash < 0) effects.push("Kasa / bankadan çıkış yapılacak");
  if (d.source && DOC_TYPES[d.source.type as keyof typeof DOC_TYPES]?.stock === def.stock && def.stock !== 0) {
    effects.splice(0, effects.length, ...effects.filter((e) => !e.startsWith("Stok")), "Stok kaynak belgede hareket ettiği için tekrar düşülmeyecek");
  }
  const conversions = def.convertsTo.filter((t) => hasModule(ctx, DOC_TYPES[t].module));
  const showE = def.eDocument && hasModule(ctx, "edonusum") && doc.status === "onayli";

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: MODULE_MAP[def.module].short },
          { label: def.plural, href: `/belge/${def.slug}` },
          { label: doc.number ?? "Taslak" },
        ]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {def.label}
            {doc.number && <span className="font-mono text-base font-normal text-muted-foreground">{doc.number}</span>}
            <DocStatusBadge status={doc.status} />
          </span>
        }
        description={d.partnerName ?? undefined}
        actions={
          <DocumentActions
            id={id}
            type={def.key}
            status={doc.status}
            number={doc.number}
            conversions={conversions}
            effects={effects}
          />
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {d.partnerName && (
                <Info label="Cari">
                  <Link href={`/cari/${doc.partnerId}`} className="font-medium text-primary hover:underline">
                    {d.partnerName}
                  </Link>
                  {d.partnerTaxNumber && <span className="block text-xs text-muted-foreground">VKN {d.partnerTaxNumber}</span>}
                </Info>
              )}
              <Info label="Tarih">{formatDate(doc.date)}</Info>
              {def.hasDueDate && <Info label="Vade">{formatDate(doc.dueDate) || "Carinin vadesine göre"}</Info>}
              {d.warehouseName && <Info label={def.transfer ? "Çıkış deposu" : "Depo"}>{d.warehouseName}</Info>}
              {d.targetWarehouseName && <Info label="Giriş deposu">{d.targetWarehouseName}</Info>}
              {d.cashAccountName && <Info label={def.cashTransfer ? "Çıkış hesabı" : "Kasa / banka"}>{d.cashAccountName}</Info>}
              {d.targetCashAccountName && <Info label="Giriş hesabı">{d.targetCashAccountName}</Info>}
              {doc.approvedAt && (
                <Info label="Onay">
                  {formatDateTime(doc.approvedAt)}
                  {d.approverName && <span className="block text-xs text-muted-foreground">{d.approverName}</span>}
                </Info>
              )}
              {d.source && (
                <Info label="Kaynak belge">
                  <Link href={`/belge/detay/${d.source.id}`} className="text-primary hover:underline">
                    {DOC_TYPES[d.source.type as keyof typeof DOC_TYPES]?.label} {d.source.number}
                  </Link>
                </Info>
              )}
              {d.derived.length > 0 && (
                <Info label="Bu belgeden oluşturulanlar">
                  {d.derived.map((x) => (
                    <Link key={x.id} href={`/belge/detay/${x.id}`} className="block text-primary hover:underline">
                      {DOC_TYPES[x.type as keyof typeof DOC_TYPES]?.label} {x.number ?? "(taslak)"}
                    </Link>
                  ))}
                </Info>
              )}
            </CardContent>
          </Card>

          {def.lines !== "yok" && (
            <Card className="overflow-hidden py-0">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>{def.lines === "urun" ? "Ürün" : "Açıklama"}</TableHead>
                    <TableHead className="text-right">Miktar</TableHead>
                    {def.priced && (
                      <>
                        <TableHead className="text-right">Birim fiyat</TableHead>
                        <TableHead className="text-right">İsk.</TableHead>
                        <TableHead className="text-right">KDV</TableHead>
                        <TableHead className="text-right">Tutar</TableHead>
                        <TableHead className="text-right">Toplam</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs text-muted-foreground">{l.lineNo}</TableCell>
                      <TableCell className="whitespace-normal">
                        {l.productId ? (
                          <Link href={`/stok/urunler/${l.productId}`} className="font-medium hover:underline">
                            {l.productName}
                          </Link>
                        ) : (
                          <span className="font-medium">{l.description}</span>
                        )}
                        {l.productCode && <span className="ml-2 text-xs whitespace-nowrap text-muted-foreground">{l.productCode}</span>}
                      </TableCell>
                      <TableCell className="num">
                        {formatQty(l.quantity)} <span className="text-xs text-muted-foreground">{l.unit}</span>
                      </TableCell>
                      {def.priced && (
                        <>
                          <TableCell className="num">{formatMoney(l.unitPrice)}</TableCell>
                          <TableCell className="num">{dec(l.discountRate).isZero() ? "—" : `%${formatQty(l.discountRate)}`}</TableCell>
                          <TableCell className="num">%{formatQty(l.vatRate)}</TableCell>
                          <TableCell className="num">{formatMoney(l.netAmount)}</TableCell>
                          <TableCell className="num font-medium">{formatMoney(l.totalAmount)}</TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {doc.notes && (
            <Card>
              <CardContent className="text-sm whitespace-pre-wrap">
                <span className="mb-1 block text-xs text-muted-foreground">Açıklama</span>
                {doc.notes}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {def.priced && (
            <Card>
              <CardContent className="flex flex-col gap-1.5 text-sm">
                {def.lines !== "yok" && (
                  <>
                    <Sum label="Ara toplam" value={formatMoney(totals.subtotal)} />
                    {!totals.discountTotal.isZero() && <Sum label="İskonto" value={`-${formatMoney(totals.discountTotal)}`} />}
                    {totals.vatBreakdown
                      .filter((v) => !v.vat.isZero())
                      .map((v) => (
                        <Sum key={v.rate} label={`KDV %${Number(v.rate)}`} value={formatMoney(v.vat)} muted />
                      ))}
                  </>
                )}
                <div className="mt-1 flex justify-between border-t pt-2 text-base font-semibold">
                  <span>Genel toplam</span>
                  <span className="tabular-nums">{formatMoney(doc.grandTotal)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {showE && <EDocumentPanel documentId={id} status={doc.eStatus} kind={def.key === "satis_irsaliye" ? "e-İrsaliye" : "e-Fatura / e-Arşiv"} />}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Oluşan hareketler</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {stock.length + cari.length + cash.length === 0 ? (
                <p className="text-muted-foreground">
                  {doc.status === "taslak" ? "Belge onaylanınca hareketler burada görünür." : "Bu belge hareket üretmez."}
                </p>
              ) : (
                <>
                  {stock.length > 0 && (
                    <Effect icon={<Boxes className="size-4" />} href="/stok/hareketler">
                      {stock.length} stok hareketi
                      <span className="block text-xs text-muted-foreground">
                        Net: {formatQty(stock.reduce((a, m) => a.plus(dec(m.quantity)), dec(0)).toString())} birim
                      </span>
                    </Effect>
                  )}
                  {cari.length > 0 && doc.partnerId && (
                    <Effect icon={<Users className="size-4" />} href={`/cari/${doc.partnerId}`}>
                      Cari: {cari.map((m) => (dec(m.debit).gt(0) ? `borç ${formatMoney(m.debit)}` : `alacak ${formatMoney(m.credit)}`)).join(", ")}
                    </Effect>
                  )}
                  {[...new Set(cash.map((m) => m.cashAccountId))].map((accountId) => (
                    <Effect key={accountId} icon={<Landmark className="size-4" />} href={`/kasa-banka/${accountId}`}>
                      {(accountId === doc.targetCashAccountId ? d.targetCashAccountName : d.cashAccountName) ?? "Kasa"}:{" "}
                      {cash
                        .filter((m) => m.cashAccountId === accountId)
                        .map((m) => formatMoney(m.amount))
                        .join(", ")}
                    </Effect>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
});

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="block text-xs text-muted-foreground">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function Sum({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Effect({ icon, href, children }: { icon: React.ReactNode; href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-start gap-2 rounded-md border px-3 py-2 hover:bg-muted/50">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span className="flex-1">{children}</span>
      <ArrowRight className="mt-0.5 size-4 text-muted-foreground" />
    </Link>
  );
}
