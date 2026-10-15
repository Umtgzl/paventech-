import { and, eq } from "drizzle-orm";
import { EmptyState } from "@/components/page/empty-state";
import { PageHeader } from "@/components/page/page-header";
import { RowLink } from "@/components/page/row-link";
import { suspensePage } from "@/components/page/suspense-page";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatQty } from "@/lib/format";
import { dec } from "@/lib/money";
import { db } from "@/server/db";
import { boms } from "@/server/db/schema";
import { bomCost } from "@/server/production/service";
import { requireModule } from "@/server/session";

/** Reçeteli mamullerin birim maliyeti ve kâr marjı. */
export default suspensePage(async function CostingPage() {
  const ctx = await requireModule("maliyet");
  const list = await db
    .select({ id: boms.id })
    .from(boms)
    .where(and(eq(boms.tenantId, ctx.tenantId), eq(boms.isActive, true)));
  const costs = (await Promise.all(list.map((b) => bomCost(db, ctx.tenantId, b.id)))).filter((c) => c !== null);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Maliyet" }, { label: "Ürün Maliyetleri" }]}
        title="Ürün Maliyetleri"
        description="Birim maliyet = reçetedeki bileşenlerin güncel ortalama maliyeti × miktar × (1 + fire). İşçilik ve genel gider payı bir sonraki aşamada eklenecek."
      />
      {costs.length === 0 ? (
        <EmptyState title="Reçete yok" description="Üretim > Reçeteler'den mamuller için reçete tanımlayın." />
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead>Mamul</TableHead>
                <TableHead>Reçete</TableHead>
                <TableHead className="text-right">Bileşen</TableHead>
                <TableHead className="text-right">Birim maliyet</TableHead>
                <TableHead className="text-right">Satış fiyatı</TableHead>
                <TableHead className="text-right">Birim kâr</TableHead>
                <TableHead className="text-right">Marj</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costs.map((c) => {
                const sale = dec(c.bom.salePrice);
                const profit = sale.minus(c.unitCost);
                const margin = sale.gt(0) ? profit.div(sale).mul(100) : null;
                return (
                  <RowLink key={c.bom.id} href={`/uretim/receteler/${c.bom.id}`}>
                    <TableCell className="font-medium">{c.bom.productName}</TableCell>
                    <TableCell className="text-muted-foreground">{c.bom.name}</TableCell>
                    <TableCell className="num">{c.lines.length}</TableCell>
                    <TableCell className="num font-medium">{formatMoney(c.unitCost.toFixed(2))}</TableCell>
                    <TableCell className="num">{formatMoney(c.bom.salePrice)}</TableCell>
                    <TableCell className={`num ${profit.lt(0) ? "text-destructive" : ""}`}>{formatMoney(profit.toFixed(2))}</TableCell>
                    <TableCell className="num">
                      {margin ? (
                        <Badge variant={margin.lt(15) ? "danger" : margin.lt(30) ? "warning" : "success"}>%{formatQty(margin.toFixed(1))}</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </RowLink>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
});
