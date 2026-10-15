"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { BarChart3, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";

const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const compact = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 });

const SERIES = [
  { key: "sales", label: "Satış", color: "var(--chart-1)" },
  { key: "purchases", label: "Alış", color: "var(--chart-2)" },
] as const;

interface Point {
  month: string;
  sales: string;
  purchases: string;
}

/** Son 6 ay satış ve alış (KDV dahil, iadeler düşülmüş). Tablo görünümüyle birlikte. */
export function MonthlyChart({ data }: { data: Point[] }) {
  const [view, setView] = useState<"grafik" | "tablo">("grafik");
  const rows = data.map((d) => ({
    label: `${MONTHS[Number(d.month.slice(5, 7)) - 1]} ${d.month.slice(2, 4)}`,
    sales: Number(d.sales),
    purchases: Number(d.purchases),
  }));
  const last = rows.length - 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        {/* Lejant: iki seri olduğu için her zaman görünür; metin renkli değil, işaret renkli */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[2px]" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
        <div className="flex rounded-md border p-0.5">
          <Button size="xs" variant={view === "grafik" ? "secondary" : "ghost"} onClick={() => setView("grafik")} aria-label="Grafik görünümü">
            <BarChart3 /> Grafik
          </Button>
          <Button size="xs" variant={view === "tablo" ? "secondary" : "ghost"} onClick={() => setView("tablo")} aria-label="Tablo görünümü">
            <Table2 /> Tablo
          </Button>
        </div>
      </div>

      {view === "grafik" ? (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} barGap={2} barCategoryGap="28%" margin={{ top: 20, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: "var(--chart-axis)" }}
                tick={{ fill: "var(--chart-muted)", fontSize: 12 }}
              />
              <YAxis
                width={56}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--chart-muted)", fontSize: 12 }}
                tickFormatter={(v: number) => `₺${compact.format(v)}`}
              />
              <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={(p) => <ChartTooltip {...p} />} />
              {SERIES.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={24}>
                  {s.key === "sales" && (
                    <LabelList
                      dataKey="sales"
                      position="top"
                      content={(props) => {
                        const { x, y, width, value, index } = props as { x: number; y: number; width: number; value: number; index: number };
                        if (index !== last) return null;
                        return (
                          <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={11} fill="var(--foreground)" fontWeight={600}>
                            ₺{compact.format(value)}
                          </text>
                        );
                      }}
                    />
                  )}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="py-1.5 text-left font-medium">Ay</th>
              <th className="py-1.5 text-right font-medium">Satış</th>
              <th className="py-1.5 text-right font-medium">Alış</th>
              <th className="py-1.5 text-right font-medium">Fark</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((r) => (
              <tr key={r.label} className="border-b last:border-0">
                <td className="py-1.5">{r.label}</td>
                <td className="py-1.5 text-right">{formatMoney(r.sales)}</td>
                <td className="py-1.5 text-right">{formatMoney(r.purchases)}</td>
                <td className="py-1.5 text-right">{formatMoney(r.sales - r.purchases)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ChartTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-44 rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-muted-foreground">{label}</p>
      {SERIES.map((s) => {
        const item = payload.find((p) => p.dataKey === s.key);
        return (
          <div key={s.key} className="flex items-center justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="font-semibold text-foreground tabular-nums">{formatMoney(Number(item?.value ?? 0))}</span>
          </div>
        );
      })}
    </div>
  );
}
