import { eq } from "drizzle-orm";
import { EmptyState } from "@/components/page/empty-state";
import { ListToolbar } from "@/components/page/list-toolbar";
import { PageHeader } from "@/components/page/page-header";
import { RowLink } from "@/components/page/row-link";
import { StatCard } from "@/components/page/stat-card";
import { suspensePage } from "@/components/page/suspense-page";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PRODUCT_KIND } from "@/lib/entities/registry";
import { formatMoney, formatQty } from "@/lib/format";
import { dec, sumDec } from "@/lib/money";
import { db } from "@/server/db";
import { warehouses } from "@/server/db/schema";
import { stockStatus } from "@/server/ledger/queries";
import { requireModule } from "@/server/session";
import { WarehouseFilter } from "./warehouse-filter";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default suspensePage(async function StockStatusPage(props: PageProps<"/stok/durum">) {
  const ctx = await requireModule("stok");
  const sp = await props.searchParams;
  const warehouseId = one(sp.depo);
  const view = one(sp.durum);
  const [rows, whs] = await Promise.all([
    stockStatus(db, ctx.tenantId, { q: one(sp.q), warehouseId }),
    db.select({ id: warehouses.id, name: warehouses.name }).from(warehouses).where(eq(warehouses.tenantId, ctx.tenantId)),
  ]);
  const filtered = rows.filter((r) =>
    view === "kritik" ? r.critical : view === "eksi" ? dec(r.quantity).lt(0) : view === "stokta" ? dec(r.quantity).gt(0) : true,
  );
  const value = sumDec(rows.filter((r) => dec(r.quantity).gt(0)).map((r) => r.value));
  const criticalCount = rows.filter((r) => r.critical).length;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Stok" }, { label: "Stok Durumu" }]}
        title="Stok Durumu"
        description="Miktarlar onaylı belgelerin hareketlerinden anlık hesaplanır."
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Stok değeri" value={formatMoney(value)} hint="Ortalama maliyetle" />
        <StatCard label="Stok kartı" value={rows.length} hint={`${rows.filter((r) => dec(r.quantity).gt(0)).length} üründe stok var`} />
        <StatCard label="Kritik seviyede" value={criticalCount} tone={criticalCount > 0 ? "danger" : "default"} hint="Kritik seviyenin altındaki ürünler" />
      </div>
      <ListToolbar
        placeholder="Ürün adı, kodu veya barkod..."
        tabs={[
          { value: "", label: "Tümü" },
          { value: "stokta", label: "Stokta olanlar" },
          { value: "kritik", label: "Kritik" },
          { value: "eksi", label: "Eksi stok" },
        ]}
      >
        <WarehouseFilter options={whs.map((w) => ({ value: w.id, label: w.name }))} />
      </ListToolbar>
      {filtered.length === 0 ? (
        <EmptyState title="Listelenecek ürün yok" />
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead>Kod</TableHead>
                <TableHead>Ürün</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead className="text-right">Miktar</TableHead>
                <TableHead className="text-right">Kritik</TableHead>
                <TableHead className="text-right">Ort. maliyet</TableHead>
                <TableHead className="text-right">Değer</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const q = dec(r.quantity);
                const k = PRODUCT_KIND.find((x) => x.value === r.kind);
                return (
                  <RowLink key={r.id} href={`/stok/urunler/${r.id}`}>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>
                      <Badge variant={k?.tone ?? "secondary"}>{k?.label}</Badge>
                    </TableCell>
                    <TableCell className={`num font-medium ${q.lt(0) ? "text-destructive" : ""}`}>
                      {formatQty(r.quantity)} <span className="text-xs text-muted-foreground">{r.unit}</span>
                    </TableCell>
                    <TableCell className="num text-muted-foreground">{dec(r.criticalLevel).gt(0) ? formatQty(r.criticalLevel) : "—"}</TableCell>
                    <TableCell className="num">{formatMoney(r.averageCost)}</TableCell>
                    <TableCell className="num">{formatMoney(q.gt(0) ? r.value : "0")}</TableCell>
                    <TableCell>
                      {q.lt(0) ? (
                        <Badge variant="danger">Eksi stok</Badge>
                      ) : r.critical ? (
                        <Badge variant="danger">Kritik</Badge>
                      ) : q.isZero() ? (
                        <Badge variant="muted">Yok</Badge>
                      ) : (
                        <Badge variant="success">Yeterli</Badge>
                      )}
                    </TableCell>
                  </RowLink>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={6}>Toplam ({filtered.length} ürün)</TableCell>
                <TableCell className="num">{formatMoney(sumDec(filtered.filter((r) => dec(r.quantity).gt(0)).map((r) => r.value)))}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </Card>
      )}
    </>
  );
});
