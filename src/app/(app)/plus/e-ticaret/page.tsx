import { ArrowRightLeft, Barcode, Check, PackageCheck, ShoppingCart } from "lucide-react";
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
    needs: "Satıcı ID, API anahtarı ve şifresi",
  },
  {
    name: "Hepsiburada",
    kind: "Pazaryeri",
    syncs: ["Stok ve fiyat", "Siparişler", "Kargo durumu"],
    needs: "Merchant ID ve entegrasyon kullanıcısı",
  },
  {
    name: "Shopify",
    kind: "Kendi mağazanız",
    syncs: ["Stok ve fiyat", "Siparişler", "Müşteri kartı"],
    needs: "Mağaza adresi ve uygulama erişim anahtarı",
  },
  {
    name: "WooCommerce",
    kind: "Kendi mağazanız",
    syncs: ["Stok ve fiyat", "Siparişler", "Müşteri kartı"],
    needs: "Site adresi ve REST API anahtarları",
  },
];

const STEPS = [
  {
    icon: Barcode,
    title: "Ürün eşleştirme",
    text: "Stok kartındaki barkod, kanaldaki ürünle eşleşir. Barkodu olmayan ürün kanala gönderilmez.",
  },
  {
    icon: ArrowRightLeft,
    title: "Stok ve fiyat gönderimi",
    text: "Onaylanan her irsaliye, fatura ve üretimden sonra güncel miktar kanallara gider. Açık siparişler ve emniyet payı düşülür.",
  },
  {
    icon: ShoppingCart,
    title: "Siparişlerin gelmesi",
    text: "Kanaldaki sipariş, satış siparişi taslağı olarak düşer. İrsaliye ve e-Arşiv fatura her zamanki akışla kesilir.",
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
        description="Pazaryeri ve e-ticaret sitenizin stok, fiyat ve siparişlerini ERP'den yönetin; elle stok güncellemeye son."
        note="Bağlantılar prototipte kurulmaz. Aşağıdaki stok önizlemesi ise gerçek verinizden hesaplanır. Canlı sürümde her kanalın resmi API'si kullanılacak."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CHANNELS.map((ch) => (
          <Card key={ch.name}>
            <CardContent className="flex h-full flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-base font-semibold text-muted-foreground">
                  {ch.name[0]}
                </div>
                <div className="min-w-0">
                  <div className="font-medium">{ch.name}</div>
                  <div className="text-xs text-muted-foreground">{ch.kind}</div>
                </div>
              </div>
              <ul className="flex flex-col gap-1 text-sm">
                {ch.syncs.map((s) => (
                  <li key={s} className="flex items-center gap-2">
                    <Check className="size-3.5 text-success" /> {s}
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex flex-col gap-1.5 border-t pt-2.5">
                <Badge variant="muted">Bağlı değil</Badge>
                <p className="text-xs text-muted-foreground">Bağlanmak için: {ch.needs}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <div key={s.title} className="flex gap-3 rounded-lg border bg-card px-4 py-3.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-plus/10 text-plus">
              <s.icon className="size-4" />
            </div>
            <div className="text-sm">
              <div className="font-medium">
                {i + 1}. {s.title}
              </div>
              <p className="mt-0.5 text-muted-foreground">{s.text}</p>
            </div>
          </div>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <PackageCheck className="size-4 text-plus" /> Kanallara gönderilecek stok
          </CardTitle>
          <CardDescription>
            Gönderilecek = depodaki stok − açık siparişlerde ayrılan − emniyet payı (ürünün kritik seviyesi). Kanalda olmayan stok satılmaz, fazla satış
            olmaz.
          </CardDescription>
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
