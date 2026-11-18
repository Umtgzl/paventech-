import { suspensePage } from "@/components/page/suspense-page";
import { PlusHeader } from "@/components/plus/plus-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatNumber, formatQty } from "@/lib/format";
import { db } from "@/server/db";
import { marketplaceSyncPreview } from "@/server/plus/marketplace";
import { requireModule } from "@/server/session";

const CHANNELS = [
  {
    name: "Trendyol",
    kind: "Pazaryeri",
    syncs: ["Stok ve fiyat", "Siparişler", "İade ve iptaller"],
  },
  {
    name: "Hepsiburada",
    kind: "Pazaryeri",
    syncs: ["Stok ve fiyat", "Siparişler", "Kargo durumu"],
  },
  {
    name: "Shopify",
    kind: "Kendi mağazanız",
    syncs: ["Stok ve fiyat", "Siparişler", "Müşteri kartı"],
  },
  {
    name: "WooCommerce",
    kind: "Kendi mağazanız",
    syncs: ["Stok ve fiyat", "Siparişler", "Müşteri kartı"],
  },
];

export default suspensePage(async function ECommercePage() {
  const ctx = await requireModule("eticaret");
  const rows = await marketplaceSyncPreview(db, ctx.tenantId);
  const ready = rows.filter((r) => r.barcode && r.publish > 0);
  const missingBarcode = rows.filter((r) => !r.barcode).length;

  return (
    <>
      <PlusHeader
        module="E-Ticaret"
        title="E-Ticaret & Pazaryeri"
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CHANNELS.map((ch) => (
          <Card key={ch.name}>
            <CardContent className="flex h-full flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{ch.name}</span>
                <Badge variant="muted">Bağlı değil</Badge>
              </div>
              <span className="text-xs text-muted-foreground">{ch.kind} · {ch.syncs.join(", ")}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            Kanallara gönderilecek stok
          </CardTitle>
          <CardDescription>Depodaki stok − açık siparişler − emniyet payı (kritik seviye)</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead>Ürün</TableHead>
              <TableHead>Barkod</TableHead>
              <TableHead className="text-right">Depoda</TableHead>
              <TableHead className="text-right">Açık siparişte</TableHead>
              <TableHead className="text-right">Emniyet payı</TableHead>
              <TableHead className="text-right">Gönderilecek</TableHead>
              <TableHead className="text-right">Satış fiyatı (KDV dahil)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <span className="font-medium">{r.name}</span>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">{r.code}</span>
                </TableCell>
                <TableCell>
                  {r.barcode ? (
                    <span className="font-mono text-xs">{r.barcode}</span>
                  ) : (
                    <Badge variant="warning">Barkod yok</Badge>
                  )}
                </TableCell>
                <TableCell className="num">
                  {formatQty(r.quantity)} {r.unit}
                </TableCell>
                <TableCell className="num">{formatQty(r.reserved)}</TableCell>
                <TableCell className="num">{formatQty(r.safety)}</TableCell>
                <TableCell className="num font-semibold">
                  {!r.barcode ? (
                    <span className="font-normal text-muted-foreground">Gönderilmez</span>
                  ) : r.publish > 0 ? (
                    formatNumber(r.publish)
                  ) : (
                    <Badge variant="danger">0 · satışa kapalı</Badge>
                  )}
                </TableCell>
                <TableCell className="num">{formatMoney(r.price)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="border-t bg-muted/30 px-5 py-3 text-sm text-muted-foreground">
          {ready.length} ürün kanallarda satışa açık olur
          {missingBarcode > 0 && `, ${missingBarcode} üründe barkod eksik`}.
        </div>
      </Card>
    </>
  );
});
