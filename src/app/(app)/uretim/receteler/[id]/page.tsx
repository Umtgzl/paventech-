import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { EditEntityButton } from "@/components/entity/edit-entity-button";
import { PageHeader } from "@/components/page/page-header";
import { StatCard } from "@/components/page/stat-card";
import { suspensePage } from "@/components/page/suspense-page";
import { BomEditor } from "@/components/production/bom-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ENTITIES } from "@/lib/entities/registry";
import { formatMoney, formatQty } from "@/lib/format";
import { dec } from "@/lib/money";
import { db } from "@/server/db";
import { products } from "@/server/db/schema";
import { getEntity, relationOptions } from "@/server/entities/service";
import { bomCost } from "@/server/production/service";
import { requireModule } from "@/server/session";

export default suspensePage(async function BomPage(props: PageProps<"/uretim/receteler/[id]">) {
  const { id } = await props.params;
  const ctx = await requireModule("uretim");
  const [row, cost, components, relOpts] = await Promise.all([
    getEntity(db, ctx.tenantId, "recete", id),
    bomCost(db, ctx.tenantId, id),
    db
      .select({ id: products.id, name: products.name, code: products.code, unit: products.unit })
      .from(products)
      .where(and(eq(products.tenantId, ctx.tenantId), inArray(products.kind, ["hammadde", "yarimamul", "ticari"]), eq(products.isActive, true)))
      .orderBy(products.name),
    relationOptions(db, ctx.tenantId, "recete"),
  ]);
  if (!row || !cost) notFound();
  const sale = dec(cost.bom.salePrice);
  const margin = sale.gt(0) ? sale.minus(cost.unitCost).div(sale).mul(100) : null;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Üretim" }, { label: "Reçeteler", href: "/kayit/recete" }, { label: cost.bom.name }]}
        title={cost.bom.name}
        description={
          <>
            Mamul:{" "}
            <Link href={`/stok/urunler/${cost.bom.productId}`} className="text-primary hover:underline">
              {cost.bom.productName}
            </Link>{" "}
            · Çıktı: {formatQty(cost.bom.outputQuantity)} {cost.bom.productUnit}
          </>
        }
        actions={<EditEntityButton def={ENTITIES.recete} row={row} relationOptions={relOpts} label="Reçete bilgileri" />}
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Birim maliyet (reçeteye göre)" value={formatMoney(cost.unitCost.toFixed(2))} hint="Bileşenlerin ortalama maliyeti + fire" />
        <StatCard label="Satış fiyatı" value={formatMoney(cost.bom.salePrice)} />
        <StatCard
          label="Brüt kâr marjı"
          value={margin ? `%${formatQty(margin.toFixed(1))}` : "—"}
          tone={margin && margin.lt(15) ? "danger" : "success"}
          hint={margin ? `Birim kâr ${formatMoney(sale.minus(cost.unitCost).toFixed(2))}` : "Satış fiyatı tanımsız"}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div>
          <h2 className="mb-2 text-sm font-medium">Reçete satırları</h2>
          <BomEditor
            bomId={id}
            initial={cost.bom.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, wasteRate: l.wasteRate }))}
            options={components.map((c) => ({ value: c.id, label: c.name, hint: c.code }))}
            units={Object.fromEntries(components.map((c) => [c.id, c.unit]))}
          />
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-sm">Maliyet dökümü (1 {cost.bom.productUnit})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {cost.lines.length === 0 && <p className="text-muted-foreground">Reçeteye bileşen ekleyin.</p>}
            {cost.lines.map((l) => (
              <div key={l.productId} className="flex justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate">{l.productName}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatQty(l.perUnit.toFixed(4))} {l.unit} × {formatMoney(l.unitCost.toFixed(2))}
                  </span>
                </span>
                <span className="tabular-nums">{formatMoney(l.cost.toFixed(2))}</span>
              </div>
            ))}
            {cost.lines.length > 0 && (
              <div className="mt-1 flex justify-between border-t pt-2 font-semibold">
                <span>Toplam</span>
                <span className="tabular-nums">{formatMoney(cost.unitCost.toFixed(2))}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
});
