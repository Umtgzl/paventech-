"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowRight, FileText, Loader2, Package, Plus, Users } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DOC_TYPE_LIST } from "@/lib/documents/types";
import type { ModuleKey } from "@/lib/modules";
import { normalizeTr } from "@/lib/utils";
import { globalSearchAction, type SearchHit } from "@/server/services/shell-actions";

export interface CommandEntry {
  label: string;
  group: string;
  href: string;
}

/**
 * ⌘K komut paleti: menüde kaybolmadan sayfaya git, yeni belge aç,
 * cari/ürün/belge numarası ara.
 */
export function CommandMenu({
  open,
  onOpenChange,
  commands,
  enabledModules,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: CommandEntry[];
  enabledModules: ModuleKey[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, startSearch] = useTransition();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => {
      startSearch(async () => setHits(await globalSearchAction(q)));
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const actions = useMemo(() => {
    const list: CommandEntry[] = [];
    if (enabledModules.includes("cari")) list.push({ label: "Yeni Cari Kart", group: "Cari", href: "/cari?yeni=1" });
    if (enabledModules.includes("stok"))
      list.push({ label: "Yeni Ürün Kartı", group: "Stok", href: "/stok/urunler?yeni=1" });
    for (const d of DOC_TYPE_LIST) {
      if (enabledModules.includes(d.module)) {
        list.push({ label: `Yeni ${d.label}`, group: d.plural, href: `/belge/${d.slug}/yeni` });
      }
    }
    return list;
  }, [enabledModules]);

  const q = normalizeTr(query.trim());
  const match = (e: CommandEntry) => !q || normalizeTr(`${e.label} ${e.group}`).includes(q);
  const visibleActions = actions.filter(match).slice(0, q ? 8 : 5);
  const visibleCommands = commands.filter(match).slice(0, q ? 10 : 8);
  const visibleHits = query.trim().length >= 2 ? hits : [];

  function go(href: string) {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setQuery("");
      }}
    >
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl" showClose={false}>
        <DialogTitle className="sr-only">Komut paleti</DialogTitle>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Sayfa, işlem, cari, ürün veya belge no..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[420px]">
            <CommandEmpty>{searching ? "Aranıyor..." : "Sonuç bulunamadı."}</CommandEmpty>
            {visibleHits.length > 0 && (
              <CommandGroup heading="Kayıtlar">
                {visibleHits.map((h) => (
                  <CommandItem key={h.href} value={h.href} onSelect={() => go(h.href)}>
                    {h.kind === "cari" ? <Users /> : h.kind === "urun" ? <Package /> : <FileText />}
                    <span className="flex-1 truncate">{h.title}</span>
                    <span className="text-xs text-muted-foreground">{h.subtitle}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {searching && visibleHits.length === 0 && query.trim().length >= 2 && (
              <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Kayıtlar aranıyor...
              </div>
            )}
            {visibleActions.length > 0 && (
              <CommandGroup heading="Hızlı işlemler">
                {visibleActions.map((a) => (
                  <CommandItem key={a.href} value={`action:${a.href}`} onSelect={() => go(a.href)}>
                    <Plus />
                    <span>{a.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {visibleCommands.length > 0 && (
              <CommandGroup heading="Sayfalar">
                {visibleCommands.map((c) => (
                  <CommandItem key={c.href} value={`page:${c.href}`} onSelect={() => go(c.href)}>
                    <ArrowRight />
                    <span>{c.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{c.group}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
