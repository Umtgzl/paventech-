import Link from "next/link";
import { formatMoney, formatQty } from "@/lib/format";
import { dec } from "@/lib/money";

/** Tek seri yatay çubuklar: değer çubuğun ucunda, renk yalnızca işarette. */
export function TopProducts({ items }: { items: { id: string; name: string; unit: string; revenue: string; quantity: string }[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Son 90 günde satış yok.</p>;
  const max = dec(items[0].revenue);
  return (
    <ul className="flex flex-col gap-3">
      {items.map((p) => {
        const pct = max.gt(0) ? dec(p.revenue).div(max).mul(100).toNumber() : 0;
        return (
          <li key={p.id} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <Link href={`/stok/urunler/${p.id}`} className="truncate hover:underline">
                {p.name}
              </Link>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatQty(p.quantity)} {p.unit}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2.5 flex-1">
                <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max(pct, 2)}%`, background: "var(--chart-1)" }} />
              </div>
              <span className="w-24 shrink-0 text-right text-xs font-medium tabular-nums">{formatMoney(p.revenue)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
