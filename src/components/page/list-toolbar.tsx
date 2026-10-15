"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Liste sayfaları için arama kutusu ve sekme filtresi (URL'e yazar). */
export function ListToolbar({
  placeholder = "Ara...",
  tabs,
  tabParam = "durum",
  children,
}: {
  placeholder?: string;
  tabs?: { value: string; label: string }[];
  tabParam?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const activeTab = params.get(tabParam) ?? "";

  function push(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (!v) next.delete(k);
      else next.set(k, v);
    }
    next.delete("sayfa");
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const t = setTimeout(() => push({ q }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="pl-8" />
      </div>
      {tabs && (
        <div className="flex rounded-md border bg-card p-0.5">
          {tabs.map((t) => (
            <Button
              key={t.value}
              size="xs"
              variant={activeTab === t.value ? "secondary" : "ghost"}
              onClick={() => push({ [tabParam]: t.value || null })}
            >
              {t.label}
            </Button>
          ))}
        </div>
      )}
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      <div className="flex-1" />
      {children}
    </div>
  );
}
