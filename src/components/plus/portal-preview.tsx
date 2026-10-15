"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, ShoppingBag } from "lucide-react";
import { DocStatusBadge } from "@/components/documents/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAction } from "@/hooks/use-action";
import { calcTotals } from "@/lib/documents/calc";
import { formatMoney } from "@/lib/format";
import { dec, parseDecimalInput } from "@/lib/money";
import { createPortalOrderAction } from "@/server/plus/actions";

export function DealerSelect({ dealers, value }: { dealers: { value: string; label: string }[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <NativeSelect className="w-72" value={value} onChange={(e) => router.replace(`${pathname}?bayi=${e.target.value}`)} aria-label="Bayi seçin">
      {dealers.map((d) => (
        <option key={d.value} value={d.value}>
          {d.label}
        </option>
      ))}
    </NativeSelect>
  );
}

interface CatalogItem {
  id: string;
  name: string;
  code: string;
  unit: string;
  price: string;
  vat: string;
  category: string;
  availability: "var" | "sinirli" | "yok";
}

const AVAIL = {
  var: { label: "Stokta", variant: "success" },
  sinirli: { label: "Sınırlı stok", variant: "warning" },
  yok: { label: "Termin sorunuz", variant: "muted" },
} as const;

export function PortalPreview({
  companyName,
  dealer,
  balance,
  invoices,
  orders,
  catalog,
}: {
  companyName: string;
  dealer: { id: string; name: string };
  balance: { balance: string; overdue: string };
  invoices: { id: string; number: string | null; date: string; dueDate: string; total: string }[];
  orders: { id: string; number: string | null; status: string; date: string; total: string; notes: string | null }[];
  catalog: CatalogItem[];
}) {
  const [qty, setQty] = useState<Record<string, string>>({});
  const [lastOrder, setLastOrder] = useState<string | null>(null);
  const { pending, run } = useAction();
  const chosen = catalog.filter((c) => dec(parseDecimalInput(qty[c.id] ?? "") ?? "0").gt(0));
  const totals = calcTotals(chosen.map((c) => ({ quantity: parseDecimalInput(qty[c.id]) ?? "0", unitPrice: c.price, vatRate: c.vat })));
  const bal = dec(balance.balance);
  const categories = [...new Set(catalog.map((c) => c.category))];

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* Tarayıcı penceresi görünümü: bayinin gördüğü ekran */}
      <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2">
        <span className="size-2.5 rounded-full bg-destructive/50" />
        <span className="size-2.5 rounded-full bg-warning/70" />
        <span className="size-2.5 rounded-full bg-success/60" />
        <span className="ml-3 flex-1 truncate rounded-md bg-card px-3 py-1 font-mono text-xs text-muted-foreground">bayi.{companyName.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9ğüşıöç]+/g, "-")}.com</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-primary px-6 py-4 text-primary-foreground">
        <div>
          <p className="text-xs opacity-80">{companyName} · Bayi Portalı</p>
          <p className="text-lg font-semibold">Hoş geldiniz, {dealer.name}</p>
        </div>
        <div className="text-right">
          <p className="text-xs opacity-80">Güncel bakiyeniz</p>
          <p className="text-lg font-semibold">
            {formatMoney(bal.abs().toString())} {bal.gt(0) ? "borç" : bal.lt(0) ? "alacak" : ""}
          </p>
          {dec(balance.overdue).gt(0) && <p className="text-xs">Vadesi geçen: {formatMoney(balance.overdue)}</p>}
        </div>
      </div>
      <div className="p-6">
        <Tabs defaultValue="siparis">
          <TabsList>
            <TabsTrigger value="siparis">Sipariş ver</TabsTrigger>
            <TabsTrigger value="siparislerim">Siparişlerim ({orders.length})</TabsTrigger>
            <TabsTrigger value="faturalar">Faturalarım</TabsTrigger>
          </TabsList>

          <TabsContent value="siparis">
            <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
              <div className="flex flex-col gap-4">
                {categories.map((cat) => (
                  <div key={cat}>
                    <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{cat}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {catalog
                        .filter((c) => c.category === cat)
                        .map((c) => (
                          <div key={c.id} className="flex items-center gap-3 rounded-lg border p-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{c.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatMoney(c.price)} / {c.unit} + KDV
                              </p>
                              <Badge variant={AVAIL[c.availability].variant} className="mt-1">
                                {AVAIL[c.availability].label}
                              </Badge>
                            </div>
                            <Input
                              aria-label={`${c.name} miktar`}
                              inputMode="numeric"
                              placeholder="0"
                              className="w-20 text-right"
                              value={qty[c.id] ?? ""}
                              onChange={(e) => setQty((q) => ({ ...q, [c.id]: e.target.value }))}
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="h-fit rounded-lg border bg-muted/30 p-4 text-sm lg:sticky lg:top-20">
                <p className="mb-2 flex items-center gap-2 font-semibold">
                  <ShoppingBag className="size-4" /> Sepet
                </p>
                {chosen.length === 0 ? (
                  <p className="text-muted-foreground">Ürünlere miktar girin.</p>
                ) : (
                  <ul className="mb-3 flex flex-col gap-1">
                    {chosen.map((c) => (
                      <li key={c.id} className="flex justify-between gap-2">
                        <span className="truncate">
                          {qty[c.id]} × {c.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex justify-between border-t pt-2">
                  <span>KDV dahil toplam</span>
                  <span className="font-semibold tabular-nums">{formatMoney(totals.grandTotal)}</span>
                </div>
                <Button
                  className="mt-3 w-full"
                  disabled={pending || chosen.length === 0}
                  onClick={() =>
                    run(
                      () =>
                        createPortalOrderAction(
                          dealer.id,
                          chosen.map((c) => ({ productId: c.id, quantity: qty[c.id], unitPrice: c.price, vatRate: c.vat })),
                        ),
                      {
                        onSuccess: (d) => {
                          setQty({});
                          setLastOrder(d.id);
                        },
                      },
                    )
                  }
                >
                  {pending && <Loader2 className="animate-spin" />}
                  Siparişi gönder
                </Button>
                {lastOrder && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Sipariş iletildi.{" "}
                    <Link href={`/belge/detay/${lastOrder}`} className="text-primary hover:underline">
                      Ana sistemdeki taslağı aç
                    </Link>
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="siparislerim">
            <SimpleTable
              head={["Sipariş", "Tarih", "Tutar", "Durum"]}
              rows={orders.map((o) => [o.number ?? "Onay bekliyor", o.date, formatMoney(o.total), <DocStatusBadge key="s" status={o.status} />])}
              empty="Henüz sipariş yok."
            />
          </TabsContent>
          <TabsContent value="faturalar">
            <SimpleTable
              head={["Fatura", "Tarih", "Vade", "Tutar"]}
              rows={invoices.map((i) => [i.number ?? "", i.date, i.dueDate, formatMoney(i.total)])}
              empty="Fatura yok."
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function SimpleTable({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <p className="py-6 text-sm text-muted-foreground">{empty}</p>;
  return (
    <table className="w-full text-sm">
      <thead className="border-b text-xs text-muted-foreground">
        <tr>
          {head.map((h) => (
            <th key={h} className="py-2 text-left font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b last:border-0">
            {r.map((c, j) => (
              <td key={j} className="py-2">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
