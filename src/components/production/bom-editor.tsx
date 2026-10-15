"use client";

import { useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { dec } from "@/lib/money";
import { saveBomLinesAction } from "@/server/production/actions";

interface Line {
  key: string;
  productId: string | null;
  quantity: string;
  wasteRate: string;
}

let seq = 0;
const k = () => `b${++seq}`;
const toInput = (v: string) => dec(v).toString().replace(".", ",");

/** Reçete satırları: bileşen, miktar (çıktı miktarı başına) ve fire yüzdesi. */
export function BomEditor({
  bomId,
  initial,
  options,
  units,
}: {
  bomId: string;
  initial: { productId: string; quantity: string; wasteRate: string }[];
  options: ComboboxOption[];
  units: Record<string, string>;
}) {
  const [lines, setLines] = useState<Line[]>(() =>
    initial.length
      ? initial.map((l) => ({
          key: k(),
          productId: l.productId,
          quantity: toInput(l.quantity),
          wasteRate: dec(l.wasteRate).isZero() ? "" : toInput(l.wasteRate),
        }))
      : [{ key: k(), productId: null, quantity: "", wasteRate: "" }],
  );
  const { pending, run, fieldErrors } = useAction();
  const update = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const errors = Object.values(fieldErrors);

  return (
    <Card className="overflow-hidden py-0">
      {errors.length > 0 && (
        <div className="border-b bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Bileşen (hammadde / yarı mamul)</th>
            <th className="w-32 px-3 py-2 text-right font-medium">Miktar</th>
            <th className="w-16 px-3 py-2 text-left font-medium">Birim</th>
            <th className="w-28 px-3 py-2 text-right font-medium">Fire %</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.key} className="border-b last:border-0">
              <td className="px-3 py-1.5">
                <Combobox
                  value={l.productId}
                  onChange={(v) => update(l.key, { productId: v })}
                  options={options}
                  placeholder="Bileşen seçin..."
                  invalid={!!fieldErrors[`lines.${i}.productId`]}
                />
              </td>
              <td className="px-3 py-1.5">
                <Input
                  inputMode="decimal"
                  className="text-right tabular-nums"
                  value={l.quantity}
                  aria-invalid={!!fieldErrors[`lines.${i}.quantity`]}
                  onChange={(e) => update(l.key, { quantity: e.target.value })}
                />
              </td>
              <td className="px-3 py-1.5 text-xs text-muted-foreground">{l.productId ? units[l.productId] : ""}</td>
              <td className="px-3 py-1.5">
                <Input
                  inputMode="decimal"
                  className="text-right tabular-nums"
                  placeholder="0"
                  value={l.wasteRate}
                  aria-invalid={!!fieldErrors[`lines.${i}.wasteRate`]}
                  onChange={(e) => update(l.key, { wasteRate: e.target.value })}
                />
              </td>
              <td className="px-1 py-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Satırı sil"
                  onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls))}
                >
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between border-t bg-muted/20 px-3 py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setLines((ls) => [...ls, { key: k(), productId: null, quantity: "", wasteRate: "" }])}
        >
          <Plus /> Bileşen ekle
        </Button>
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            run(() =>
              saveBomLinesAction(
                bomId,
                lines.map((l) => ({ productId: l.productId ?? "", quantity: l.quantity, wasteRate: l.wasteRate })),
              ),
            )
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          Reçeteyi kaydet
        </Button>
      </div>
    </Card>
  );
}
