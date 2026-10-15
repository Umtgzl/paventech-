"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { CheckCircle2, Loader2, Sparkles, XCircle } from "lucide-react";
import { Field } from "@/components/page/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { useAction } from "@/hooks/use-action";
import { calcTotals } from "@/lib/documents/calc";
import { formatMoney, formatQty } from "@/lib/format";
import type { MatchResult } from "@/lib/matching";
import { dec } from "@/lib/money";
import { processInboxAction, rejectInboxAction } from "@/server/plus/actions";

interface InboxLine {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  vatRate: string;
}

function confidence(m: MatchResult, chosen: string | null) {
  if (!chosen) return { label: "Eşleşme yok", variant: "danger" as const };
  if (chosen !== m.productId) return { label: "Elle seçildi", variant: "secondary" as const };
  if (m.source === "ogrenildi") return { label: "Öğrenildi", variant: "success" as const };
  if (m.score >= 0.6) return { label: `Yüksek · %${Math.round(m.score * 100)}`, variant: "success" as const };
  if (m.score >= 0.4) return { label: `Orta · %${Math.round(m.score * 100)}`, variant: "warning" as const };
  return { label: `Düşük · %${Math.round(m.score * 100)}`, variant: "danger" as const };
}

export function InboxMatcher({
  id,
  ettn,
  grandTotal,
  supplier,
  suppliers,
  lines,
  matches,
  products,
}: {
  id: string;
  ettn: string;
  grandTotal: string;
  supplier: { id: string; name: string; via: "vkn" | "isim" } | null;
  suppliers: ComboboxOption[];
  lines: InboxLine[];
  matches: MatchResult[];
  products: ComboboxOption[];
}) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState<string | null>(supplier?.id ?? null);
  const [chosen, setChosen] = useState<(string | null)[]>(matches.map((m) => m.productId));
  const create = useAction();
  const reject = useAction();
  const totals = calcTotals(lines);
  const consistent = totals.grandTotal.minus(dec(grandTotal)).abs().lte(dec("0.05"));
  const matchedCount = chosen.filter(Boolean).length;
  const productName = new Map(products.map((p) => [p.value, p.label]));

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Tedarikçi (cari kartı)"
            htmlFor="supplier"
            help={supplier ? (supplier.via === "vkn" ? "Vergi numarasıyla bulundu" : "Ünvan benzerliğiyle tahmin edildi") : "Cari bulunamadı, seçin"}
            className="sm:col-span-2"
          >
            <Combobox id="supplier" value={supplierId} onChange={setSupplierId} options={suppliers} placeholder="Tedarikçi seçin..." />
          </Field>
          <div className="text-sm">
            <span className="block text-xs text-muted-foreground">ETTN</span>
            <span className="font-mono text-xs break-all">{ettn}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden py-0">
        <div className="flex items-center gap-2 border-b bg-plus/[0.04] px-4 py-2.5 text-sm">
          <Sparkles className="size-4 text-plus" />
          <span>
            {matchedCount} / {lines.length} satır stok kartına eşleşti. Gerekirse değiştirin; onayladığınız eşleşme bu tedarikçi için öğrenilir.
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Tedarikçinin satırı</th>
                <th className="px-3 py-2 text-right font-medium">Miktar</th>
                <th className="px-3 py-2 text-right font-medium">Birim fiyat</th>
                <th className="w-[34%] px-3 py-2 text-left font-medium">Bizdeki stok kartı</th>
                <th className="px-3 py-2 text-left font-medium">Güven</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const m = matches[i];
                const c = confidence(m, chosen[i]);
                const alt = m.alternatives.filter((a) => a.id !== chosen[i]).slice(0, 2);
                return (
                  <tr key={i} className="border-b align-top last:border-0">
                    <td className="px-3 py-2.5">
                      <span className="font-medium">{l.description}</span>
                      <span className="block text-xs text-muted-foreground">KDV %{formatQty(l.vatRate)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatQty(l.quantity)} {l.unit}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(l.unitPrice)}</td>
                    <td className="px-3 py-2">
                      <Combobox
                        value={chosen[i]}
                        onChange={(v) => setChosen((cs) => cs.map((x, j) => (j === i ? v : x)))}
                        options={products}
                        placeholder="Stok kartı seçin..."
                        invalid={!chosen[i]}
                      />
                      {alt.length > 0 && (
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          Diğer adaylar:{" "}
                          {alt.map((a, k) => (
                            <Fragment key={a.id}>
                              {k > 0 && ", "}
                              <button
                                type="button"
                                className="text-primary hover:underline"
                                onClick={() => setChosen((cs) => cs.map((x, j) => (j === i ? a.id : x)))}
                              >
                                {productName.get(a.id) ?? a.name} (%{Math.round(a.score * 100)})
                              </button>
                            </Fragment>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={c.variant}>{c.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-[1fr_340px]">
        <Card>
          <CardContent className="flex items-start gap-2 text-sm">
            {consistent ? (
              <>
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                <span>Satırlardan hesaplanan toplam e-faturadaki toplamla tutuyor ({formatMoney(grandTotal)}).</span>
              </>
            ) : (
              <>
                <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <span>
                  Satırlardan hesaplanan toplam ({formatMoney(totals.grandTotal)}) e-faturadaki toplamdan ({formatMoney(grandTotal)}) farklı.
                  Kontrol edin.
                </span>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <span>Ara toplam</span>
              <span className="tabular-nums">{formatMoney(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>KDV</span>
              <span className="tabular-nums">{formatMoney(totals.vatTotal)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Genel toplam</span>
              <span className="tabular-nums">{formatMoney(totals.grandTotal)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="ghost"
          className="text-destructive hover:text-destructive"
          disabled={reject.pending}
          onClick={() => reject.run(() => rejectInboxAction(id), { onSuccess: () => router.push("/plus/e-donusum/gelen") })}
        >
          <XCircle /> Reddet
        </Button>
        <Button
          variant="plus"
          disabled={create.pending || !supplierId || matchedCount < lines.length}
          onClick={() =>
            create.run(() => processInboxAction(id, supplierId ?? "", chosen), {
              onSuccess: (d) => router.push(`/belge/detay/${d.documentId}`),
            })
          }
        >
          {create.pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
          Alış faturası taslağı oluştur
        </Button>
      </div>
    </div>
  );
}
