"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";

export function Pagination({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  if (total === 0) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const go = (p: number) => {
    const next = new URLSearchParams(params.toString());
    next.set("sayfa", String(p));
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
      <span>
        {formatNumber(from, 0)}–{formatNumber(to, 0)} / {formatNumber(total, 0)} kayıt
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => go(page - 1)} aria-label="Önceki sayfa">
          <ChevronLeft />
        </Button>
        <span className="px-2">
          {page} / {pages}
        </span>
        <Button variant="outline" size="icon-sm" disabled={page >= pages} onClick={() => go(page + 1)} aria-label="Sonraki sayfa">
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
