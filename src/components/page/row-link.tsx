"use client";

import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";

/** Tıklanınca bir sayfaya giden tablo satırı (sunucu bileşeni tablolarında kullanılır). */
export function RowLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  const router = useRouter();
  return (
    <TableRow
      className={`cursor-pointer ${className ?? ""}`}
      onClick={(e) => {
        // Satır içindeki bir bağlantıya tıklandıysa onun yönlendirmesi geçerli olsun
        if ((e.target as HTMLElement).closest("a, button")) return;
        router.push(href);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(href);
      }}
      tabIndex={0}
    >
      {children}
    </TableRow>
  );
}
