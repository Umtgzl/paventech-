"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import type { EntityDef, EntityRow } from "@/lib/entities/types";
import { formatDate, formatMoney } from "@/lib/format";
import { dec } from "@/lib/money";
import { cn } from "@/lib/utils";
import { moveBoardCardAction } from "@/server/entities/actions";

/**
 * Pano (kanban) görünümü: kayıtlar seçim alanına (aşama/durum) göre kolonlanır.
 * Kartı sürükleyip bırakarak ya da kart üzerindeki seçimle taşıyabilirsiniz.
 */
export function EntityBoard({ def, rows, onOpen }: { def: EntityDef; rows: EntityRow[]; onOpen: (r: EntityRow) => void }) {
  const board = def.board!;
  const field = def.fields.find((f) => f.name === board.field)!;
  const amountField = board.amountField ? def.fields.find((f) => f.name === board.amountField) : undefined;
  const dateField = def.fields.find((f) => f.type === "date" && f.list);
  const [, startTransition] = useTransition();
  const [optimisticRows, moveOptimistic] = useOptimistic(rows, (state, m: { id: string; value: string }) =>
    state.map((r) => (r.id === m.id ? { ...r, [field.name]: m.value } : r)),
  );

  function move(id: string, value: string) {
    startTransition(async () => {
      moveOptimistic({ id, value });
      const res = await moveBoardCardAction(def.key, id, value);
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {(field.options ?? []).map((col) => {
        const items = optimisticRows.filter((r) => r[field.name] === col.value);
        const total = amountField ? items.reduce((acc, r) => acc.plus(dec(r[amountField.name] as string)), dec(0)) : null;
        return (
          <div
            key={col.value}
            className="flex w-72 shrink-0 flex-col rounded-xl border bg-muted/30"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("text/plain");
              if (id) move(id, col.value);
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Badge variant={col.tone ?? "secondary"}>{col.label}</Badge>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              {total && <span className="text-xs font-medium tabular-nums">{formatMoney(total)}</span>}
            </div>
            <div className="flex min-h-24 flex-col gap-2 p-2">
              {items.map((r) => (
                <div
                  key={r.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", r.id)}
                  onClick={() => onOpen(r)}
                  className={cn("cursor-pointer rounded-lg border bg-card p-3 text-sm shadow-xs hover:border-primary/40")}
                >
                  <p className="font-medium">{String(r[def.titleField] ?? "")}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {def.fields
                      .filter((f) => f.type === "relation" && f.list && r[`${f.name}__label`])
                      .slice(0, 1)
                      .map((f) => (
                        <span key={f.name}>{String(r[`${f.name}__label`])}</span>
                      ))}
                    {dateField && r[dateField.name] && <span>{formatDate(String(r[dateField.name]))}</span>}
                    {amountField && <span className="font-medium text-foreground">{formatMoney(r[amountField.name] as string)}</span>}
                  </div>
                  <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                    <NativeSelect
                      className="h-7 text-xs"
                      value={String(r[field.name] ?? "")}
                      onChange={(e) => move(r.id, e.target.value)}
                      aria-label={`${field.label} değiştir`}
                    >
                      {field.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
