import Link from "next/link";
import { notFound } from "next/navigation";
import { CellValue } from "@/components/entity/cell-value";
import { EditEntityButton } from "@/components/entity/edit-entity-button";
import { PageHeader } from "@/components/page/page-header";
import { suspensePage } from "@/components/page/suspense-page";
import { ProductionOrderActions } from "@/components/production/order-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ENTITIES } from "@/lib/entities/registry";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { dec } from "@/lib/money";
import { db } from "@/server/db";
import { getEntity, relationOptions } from "@/server/entities/service";
import { materialRequirements, productionMovements } from "@/server/production/service";
import { requireModule } from "@/server/session";

export default suspensePage(async function ProductionOrderPage(props: PageProps<"/uretim/is-emirleri/[id]">) {
  const { id } = await props.params;
  const ctx = await requireModule("uretim");
  const row = await getEntity(db, ctx.tenantId, "is-emri", id);
  if (!row) notFound();
  const [req, moves, relOpts] = await Promise.all([
    materialRequirements(db, ctx.tenantId, id),
    productionMovements(db, ctx.tenantId, id),
    relationOptions(db, ctx.tenantId, "is-emri"),
  ]);
  const def = ENTITIES["is-emri"];
  const statusField = def.fields.find((f) => f.name === "status")!;
  const hasShortage = req.lines.some((l) => dec(l.shortage).gt(0));
  const produced = moves.find((m) => m.productId === req.bom.productId);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Üretim" }, { label: "İş Emirleri", href: "/kayit/is-emri" }, { label: String(row.code) }]}
        title={
          <span className="flex items-center gap-2">
            İş emri {String(row.code)} <CellValue field={statusField} row={row} />
          </span>
        }
        description={
          <>
            {formatQty(row.quantity as string)} {req.bom.productUnit}{" "}
            <Link href={`/stok/urunler/${req.bom.productId}`} className="text-primary hover:underline">
              {req.bom.productName}
            </Link>{" "}
            · Reçete{" "}
            <Link href={`/uretim/receteler/${req.bom.id}`} className="text-primary hover:underline">
              {req.bom.name}
            </Link>
            {row.plannedDate && <> · Plan: {formatDate(String(row.plannedDate))}</>}
          </>
        }
        actions={
          <>
            <EditEntityButton def={def} row={row} relationOptions={relOpts} />
            <ProductionOrderActions id={id} status={String(row.status)} hasShortage={hasShortage} />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div>
          <h2 className="mb-2 text-sm font-medium">Malzeme ihtiyaç listesi</h2>
          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Bileşen</TableHead>
                  <TableHead className="text-right">Gereken (fire dahil)</TableHead>
                  <TableHead className="text-right">Depoda</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {req.lines.map((l) => (
                  <TableRow key={l.productId}>
                    <TableCell>
                      <Link href={`/stok/urunler/${l.productId}`} className="font-medium hover:underline">
                        {l.productName}
                      </Link>
                      <span className="ml-2 text-xs text-muted-foreground">{l.productCode}</span>
                    </TableCell>
                    <TableCell className="num">
                      {formatQty(l.required)} {l.unit}
                    </TableCell>
                    <TableCell className="num">
                      {formatQty(l.available)} {l.unit}
                    </TableCell>
                    <TableCell>
                      {row.status === "tamamlandi" ? (
                        <Badge variant="muted">Kullanıldı</Badge>
                      ) : dec(l.shortage).gt(0) ? (
                        <Badge variant="danger">
                          {formatQty(l.shortage)} {l.unit} eksik
                        </Badge>
                      ) : (
                        <Badge variant="success">Yeterli</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-sm">Üretim sonucu</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {produced ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Üretilen</span>
                  <span className="tabular-nums">
                    {formatQty(produced.quantity)} {produced.unit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gerçekleşen birim maliyet</span>
                  <span className="tabular-nums">{formatMoney(produced.unitCost)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Toplam maliyet</span>
                  <span className="tabular-nums">{formatMoney(dec(produced.quantity).mul(dec(produced.unitCost)).toFixed(2))}</span>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">
                Üretim tamamlanınca hammaddeler stoktan düşer, mamul gerçekleşen maliyetle stoğa girer.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
});
