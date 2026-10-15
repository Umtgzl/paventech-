import Link from "next/link";
import { count, eq, and } from "drizzle-orm";
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Factory, FileText, HandCoins, Inbox, Plus, ShoppingCart, Sparkles } from "lucide-react";
import { MonthlyChart } from "@/components/dashboard/monthly-chart";
import { TopProducts } from "@/components/dashboard/top-products";
import { DocStatusBadge } from "@/components/documents/status-badge";
import { PageHeader } from "@/components/page/page-header";
import { suspensePage } from "@/components/page/suspense-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DOC_TYPES, isDocTypeKey } from "@/lib/documents/types";
import { formatDate, formatMoney, formatQty, todayIso } from "@/lib/format";
import { dec } from "@/lib/money";
import { cn } from "@/lib/utils";
import { db } from "@/server/db";
import { einvoiceInbox } from "@/server/db/schema";
import { dashboardData } from "@/server/dashboard/queries";
import { getTenantContext, hasModule } from "@/server/session";

export default suspensePage(async function PanelPage() {
  const ctx = await getTenantContext();
  const today = todayIso();
  const d = await dashboardData(db, ctx.tenantId, today, ctx.enabledModules);
  const [inbox] = hasModule(ctx, "edonusum")
    ? await db
        .select({ n: count() })
        .from(einvoiceInbox)
        .where(and(eq(einvoiceInbox.tenantId, ctx.tenantId), eq(einvoiceInbox.status, "yeni")))
    : [{ n: 0 }];
  const hour = Number(new Intl.DateTimeFormat("tr-TR", { hour: "numeric", hour12: false, timeZone: "Europe/Istanbul" }).format(new Date()));
  const greeting = hour < 11 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar";
  const firstName = ctx.userName.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`${greeting}, ${firstName}`}
        description={`${ctx.tenantName} · ${formatDate(today)}`}
        actions={
          <>
            {hasModule(ctx, "kasa") && (
              <Button variant="outline" asChild>
                <Link href="/belge/tahsilat/yeni">
                  <HandCoins /> Tahsilat
                </Link>
              </Button>
            )}
            {hasModule(ctx, "satis") && (
              <Button asChild>
                <Link href="/belge/satis-faturasi/yeni">
                  <Plus /> Satış faturası
                </Link>
              </Button>
            )}
          </>
        }
      />

      {/* Özet kutucukları: değerler orantılı rakamla, değişim yön + etiketle (yalnızca renk değil) */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Bu ay satış" value={formatMoney(d.kpi.salesNow)} delta={{ now: d.kpi.salesNow, prev: d.kpi.salesPrev }} href="/belge/satis-faturasi" />
        <Kpi label="Bu ay tahsilat" value={formatMoney(d.kpi.collectNow)} delta={{ now: d.kpi.collectNow, prev: d.kpi.collectPrev }} href="/belge/tahsilat" />
        <Kpi
          label="Açık alacak"
          value={formatMoney(d.kpi.receivable)}
          href="/cari/bakiyeler?durum=borclu"
          footer={
            dec(d.kpi.overdue).gt(0) ? (
              <span className="flex items-center gap-1 text-destructive">
                <AlertTriangle className="size-3.5" /> Vadesi geçen {formatMoney(d.kpi.overdue)}
              </span>
            ) : (
              <span className="text-muted-foreground">Vadesi geçen alacak yok</span>
            )
          }
        />
        {d.kpi.cash !== null && <Kpi label="Kasa ve banka" value={formatMoney(d.kpi.cash)} href="/kasa-banka" footer={<span className="text-muted-foreground">Tüm hesapların toplamı</span>} />}
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Satış ve alış</CardTitle>
            <CardDescription>Son 6 ay, KDV dahil, iadeler düşülmüş</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyChart data={d.monthly} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>En çok satan ürünler</CardTitle>
            <CardDescription>Son 90 gün, KDV hariç ciro</CardDescription>
          </CardHeader>
          <CardContent>
            <TopProducts items={d.topProducts} />
          </CardContent>
        </Card>
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <ListCard title="Kritik stoklar" href="/stok/durum?durum=kritik" empty="Kritik seviyede ürün yok." count={d.critical.length}>
          {d.critical.map((p) => (
            <Link key={p.id} href={`/stok/urunler/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-muted/40">
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">Kritik seviye {formatQty(p.criticalLevel)} {p.unit}</span>
              </span>
              <Badge variant="danger">
                <AlertTriangle /> {formatQty(p.quantity)} {p.unit}
              </Badge>
            </Link>
          ))}
        </ListCard>
        <ListCard title="Bekleyen siparişler" href="/belge/satis-siparisi?durum=onayli" empty="Sevk bekleyen sipariş yok." count={d.pendingOrders.length}>
          {d.pendingOrders.map((o) => (
            <Link key={o.id} href={`/belge/detay/${o.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-muted/40">
              <span className="min-w-0">
                <span className="block truncate font-medium">{o.partnerName}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {o.number} · {formatDate(o.date)}
                </span>
              </span>
              <span className="shrink-0 tabular-nums">{formatMoney(o.total)}</span>
            </Link>
          ))}
        </ListCard>
        <ListCard title="Vadesi geçen alacaklar" href="/cari/bakiyeler?durum=vadesi-gecen" empty="Vadesi geçen alacak yok." count={d.overdueCustomers.length}>
          {d.overdueCustomers.map((c) => (
            <Link key={c.id} href={`/cari/${c.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-muted/40">
              <span className="min-w-0">
                <span className="block truncate font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">Toplam bakiye {formatMoney(c.balance)}</span>
              </span>
              <span className="shrink-0 font-medium text-destructive tabular-nums">{formatMoney(c.overdue)}</span>
            </Link>
          ))}
        </ListCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ListCard title="Son belgeler" className="lg:col-span-2" empty="Henüz belge yok." count={d.recent.length}>
          {d.recent.map((r) => (
            <Link key={r.id} href={`/belge/detay/${r.id}`} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-muted/40">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">
                  <span className="font-medium">{isDocTypeKey(r.type) ? DOC_TYPES[r.type].label : r.type}</span>
                  {r.partnerName && <span className="text-muted-foreground"> · {r.partnerName}</span>}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {r.number ?? "Taslak"} · {formatDate(r.date)}
                </span>
              </span>
              <DocStatusBadge status={r.status} />
              <span className="w-28 shrink-0 text-right tabular-nums">{formatMoney(r.total)}</span>
            </Link>
          ))}
        </ListCard>
        <div className="flex flex-col gap-4">
          {hasModule(ctx, "uretim") && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Factory className="size-4 text-muted-foreground" /> Üretim
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Üretimde</span>
                  <span className="font-medium">{d.production.find((p) => p.status === "uretimde")?.n ?? 0} iş emri</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Planlanan</span>
                  <span className="font-medium">{d.production.find((p) => p.status === "planlandi")?.n ?? 0} iş emri</span>
                </div>
                <Button variant="outline" size="sm" className="mt-1" asChild>
                  <Link href="/kayit/is-emri?gorunum=pano">
                    Üretim panosu <ArrowRight />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
          {hasModule(ctx, "edonusum") && (
            <Card className="border-plus/30 bg-plus/[0.03]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-4 text-plus" /> Gelen e-faturalar
                  <Badge variant="plus">PLUS</Badge>
                </CardTitle>
                <CardDescription>AI, tedarikçi satırlarını stok kartlarınızla eşleştirip alış faturasını hazırlar.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button size="sm" variant="plus" asChild>
                  <Link href="/plus/e-donusum/gelen">
                    <Inbox /> {inbox.n} yeni e-fatura
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
          {!hasModule(ctx, "satis") && (
            <Card>
              <CardContent className="flex items-center gap-3 py-5 text-sm">
                <ShoppingCart className="size-5 text-muted-foreground" />
                Satış modülü açıldığında satış özetleri burada görünür.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
});

function Kpi({
  label,
  value,
  delta,
  footer,
  href,
}: {
  label: string;
  value: string;
  delta?: { now: string; prev: string };
  footer?: React.ReactNode;
  href: string;
}) {
  let deltaNode: React.ReactNode = null;
  if (delta) {
    const now = dec(delta.now);
    const prev = dec(delta.prev);
    if (prev.isZero()) {
      deltaNode = <span className="text-muted-foreground">Geçen ay aynı dönemde kayıt yok</span>;
    } else {
      const pct = now.minus(prev).div(prev).mul(100);
      const up = pct.gte(0);
      deltaNode = (
        <span className="flex flex-wrap items-center gap-x-1.5" title="Geçen ayın aynı günler aralığıyla karşılaştırma">
          <span className={cn("flex items-center gap-0.5 font-medium whitespace-nowrap", up ? "text-success" : "text-destructive")}>
            {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {up ? "+" : "−"}%{formatQty(pct.abs().toFixed(1))}
          </span>
          <span className="text-muted-foreground">geçen aya göre</span>
        </span>
      );
    }
  }
  return (
    <Link href={href}>
      <Card className="h-full transition-colors hover:border-primary/40">
        <CardContent className="flex flex-col gap-1 py-4">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-2xl font-semibold tracking-tight">{value}</span>
          <span className="text-xs">{deltaNode ?? footer}</span>
        </CardContent>
      </Card>
    </Link>
  );
}

function ListCard({
  title,
  href,
  empty,
  count: n,
  className,
  children,
}: {
  title: string;
  href?: string;
  empty: string;
  count: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("gap-0 overflow-hidden py-0", className)}>
      <div className="flex items-center justify-between border-b px-5 py-3">
        <span className="font-semibold">{title}</span>
        {href && (
          <Link href={href} className="text-xs text-primary hover:underline">
            Tümü
          </Link>
        )}
      </div>
      {n === 0 ? <p className="px-5 py-6 text-sm text-muted-foreground">{empty}</p> : <div className="divide-y">{children}</div>}
    </Card>
  );
}
