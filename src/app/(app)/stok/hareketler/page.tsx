import Link from "next/link";
import { eq } from "drizzle-orm";
import { MovementKindBadge } from "@/components/documents/movement-kind";
import { EmptyState } from "@/components/page/empty-state";
import { ListToolbar } from "@/components/page/list-toolbar";
import { PageHeader } from "@/components/page/page-header";
import { suspensePage } from "@/components/page/suspense-page";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DOC_TYPES, isDocTypeKey } from "@/lib/documents/types";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { dec } from "@/lib/money";
import { normalizeTr } from "@/lib/utils";
import { db } from "@/server/db";
import { warehouses } from "@/server/db/schema";
import { stockMovementList } from "@/server/ledger/queries";
import { requireModule } from "@/server/session";
import { WarehouseFilter } from "../durum/warehouse-filter";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default suspensePage(async function StockMovementsPage(props: PageProps<"/stok/hareketler">) {
  const ctx = await requireModule("stok");
  const sp = await props.searchParams;
  const [rows, whs] = await Promise.all([
    stockMovementList(db, ctx.tenantId, { warehouseId: one(sp.depo), limit: 500 }),
    db.select({ id: warehouses.id, name: warehouses.name }).from(warehouses).where(eq(warehouses.tenantId, ctx.tenantId)),
  ]);
  const q = normalizeTr(one(sp.q) ?? "");
  const kind = one(sp.tur);
  const filtered = rows.filter(
    (r) =>
      (!q || normalizeTr(`${r.productName} ${r.productCode} ${r.documentNumber ?? ""}`).includes(q)) && (!kind || r.kind === kind),
  );

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Stok" }, { label: "Stok Hareketleri" }]}
        title="Stok Hareketleri"
        description="Her satır bir belgeden doğar; hareketler silinmez, iptalde ters kayıt atılır."
      />
      <ListToolbar
        placeholder="Ürün veya belge no..."
        tabParam="tur"
        tabs={[
          { value: "", label: "Tümü" },
          { value: "giris", label: "Giriş" },
          { value: "cikis", label: "Çıkış" },
          { value: "transfer", label: "Transfer" },
          { value: "iptal", label: "İptal" },
        ]}
      >
        <WarehouseFilter options={whs.map((w) => ({ value: w.id, label: w.name }))} />
      </ListToolbar>
      {filtered.length === 0 ? (
        <EmptyState title="Hareket bulunamadı" />
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead>Tarih</TableHead>
                <TableHead>Ürün</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Belge</TableHead>
                <TableHead>Depo</TableHead>
                <TableHead className="text-right">Miktar</TableHead>
                <TableHead className="text-right">Birim maliyet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{formatDate(m.date)}</TableCell>
                  <TableCell>
                    <Link href={`/stok/urunler/${m.productId}`} className="font-medium hover:underline">
                      {m.productName}
                    </Link>
                    <span className="ml-2 text-xs text-muted-foreground">{m.productCode}</span>
                  </TableCell>
                  <TableCell>
                    <MovementKindBadge kind={m.kind} />
                  </TableCell>
                  <TableCell>
                    {m.documentId && (
                      <Link href={`/belge/detay/${m.documentId}`} className="text-primary hover:underline">
                        {m.documentType && isDocTypeKey(m.documentType) ? DOC_TYPES[m.documentType].label : ""} {m.documentNumber}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell>{m.warehouseName}</TableCell>
                  <TableCell className={`num font-medium ${dec(m.quantity).lt(0) ? "text-destructive" : "text-success"}`}>
                    {dec(m.quantity).gt(0) ? "+" : ""}
                    {formatQty(m.quantity)} <span className="text-xs text-muted-foreground">{m.unit}</span>
                  </TableCell>
                  <TableCell className="num">{formatMoney(m.unitCost)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
});
