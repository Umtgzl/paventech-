import Link from "next/link";
import { notFound } from "next/navigation";
import { MovementKindBadge } from "@/components/documents/movement-kind";
import { CellValue } from "@/components/entity/cell-value";
import { EditEntityButton } from "@/components/entity/edit-entity-button";
import { EmptyState } from "@/components/page/empty-state";
import { PageHeader } from "@/components/page/page-header";
import { StatCard } from "@/components/page/stat-card";
import { suspensePage } from "@/components/page/suspense-page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DOC_TYPES, isDocTypeKey } from "@/lib/documents/types";
import { ENTITIES, PRODUCT_KIND } from "@/lib/entities/registry";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { dec } from "@/lib/money";
import { db } from "@/server/db";
import { getEntity } from "@/server/entities/service";
import { stockByWarehouse, stockMovementList } from "@/server/ledger/queries";
import { averageCost } from "@/server/ledger/stock";
import { requireModule } from "@/server/session";

export default suspensePage(async function ProductDetailPage(props: PageProps<"/stok/urunler/[id]">) {
  const { id } = await props.params;
  const ctx = await requireModule("stok");
  const row = await getEntity(db, ctx.tenantId, "urun", id);
  if (!row) notFound();

  const [byWarehouse, movements, avg] = await Promise.all([
    stockByWarehouse(db, ctx.tenantId, id),
    stockMovementList(db, ctx.tenantId, { productId: id, limit: 100 }),
    averageCost(db, ctx.tenantId, id),
  ]);
  const total = byWarehouse.reduce((a, w) => a.plus(dec(w.qty)), dec(0));
  const critical = dec(row.criticalLevel as string);
  const isCritical = critical.gt(0) && total.lte(critical);
  const unit = String(row.unit);
  const kindOpt = PRODUCT_KIND.find((k) => k.value === row.kind);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Stok" }, { label: "Ürünler", href: "/stok/urunler" }, { label: String(row.name) }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {String(row.name)}
            <Badge variant={kindOpt?.tone ?? "secondary"}>{kindOpt?.label}</Badge>
            {isCritical && <Badge variant="danger">Kritik stok</Badge>}
          </span>
        }
        description={[row.code, row.category, row.barcode && `Barkod ${row.barcode}`].filter(Boolean).join(" · ")}
        actions={<EditEntityButton def={ENTITIES.urun} row={row} />}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Toplam stok"
          value={`${formatQty(total.toString())} ${unit}`}
          tone={total.lt(0) ? "danger" : isCritical ? "warning" : "default"}
          hint={critical.gt(0) ? `Kritik seviye: ${formatQty(critical.toString())} ${unit}` : "Kritik seviye tanımsız"}
        />
        <StatCard label="Ortalama maliyet" value={formatMoney(avg.toFixed(2))} hint="Hareketli ağırlıklı ortalama" />
        <StatCard label="Stok değeri" value={formatMoney(total.gt(0) ? total.mul(avg).toFixed(2) : "0")} hint="Miktar × ortalama maliyet" />
        <StatCard
          label="Satış fiyatı"
          value={formatMoney(row.salePrice as string)}
          hint={dec(row.salePrice as string).gt(0) && avg.gt(0) ? `Brüt kâr marjı %${formatQty(dec(row.salePrice as string).minus(avg).div(dec(row.salePrice as string)).mul(100).toFixed(1))}` : `KDV %${formatQty(row.vatRate as string)}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Depo bazında stok</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {byWarehouse.map((w) => (
                <div key={w.warehouseId} className="flex justify-between">
                  <span>{w.name}</span>
                  <span className={`tabular-nums ${dec(w.qty).lt(0) ? "text-destructive" : ""}`}>
                    {formatQty(w.qty)} {unit}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="grid gap-3 text-sm">
              {ENTITIES.urun.fields
                .filter((f) => ["unit", "vatRate", "purchasePrice", "trackStock", "isActive", "notes"].includes(f.name))
                .map((f) => (
                  <div key={f.name} className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{f.label}</span>
                    <CellValue field={f} row={row} />
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-medium">Son hareketler</h2>
          {movements.length === 0 ? (
            <EmptyState title="Henüz stok hareketi yok" description="Alış, satış, irsaliye ve transfer belgeleri onaylandıkça burada görünür." />
          ) : (
            <Card className="overflow-hidden py-0">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Tarih</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead>Belge</TableHead>
                    <TableHead>Depo</TableHead>
                    <TableHead className="text-right">Miktar</TableHead>
                    <TableHead className="text-right">Birim maliyet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{formatDate(m.date)}</TableCell>
                      <TableCell>
                        <MovementKindBadge kind={m.kind} />
                      </TableCell>
                      <TableCell>
                        {m.documentId ? (
                          <Link href={`/belge/detay/${m.documentId}`} className="text-primary hover:underline">
                            {m.documentType && isDocTypeKey(m.documentType) ? DOC_TYPES[m.documentType].label : ""} {m.documentNumber}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{m.warehouseName}</TableCell>
                      <TableCell className={`num font-medium ${dec(m.quantity).lt(0) ? "text-destructive" : "text-success"}`}>
                        {dec(m.quantity).gt(0) ? "+" : ""}
                        {formatQty(m.quantity)}
                      </TableCell>
                      <TableCell className="num">{formatMoney(m.unitCost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </div>
    </>
  );
});
