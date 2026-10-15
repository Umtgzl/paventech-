"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type VisibilityState } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  KanbanSquare,
  Loader2,
  Plus,
  Search,
  Table2,
} from "lucide-react";
import { EmptyState } from "@/components/page/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { entityDetailHref } from "@/lib/entities/registry";
import type { EntityDef, EntityRow } from "@/lib/entities/types";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CellValue } from "./cell-value";
import { EntityBoard } from "./entity-board";
import { EntityFormSheet, type RelationOptions } from "./entity-form-sheet";

export interface EntityTableProps {
  def: EntityDef;
  rows: EntityRow[];
  total: number;
  page: number;
  pageSize: number;
  sort: string;
  dir: "asc" | "desc";
  q: string;
  view: "tablo" | "pano";
  relationOptions: RelationOptions;
  /** Satıra tıklayınca detay sayfası yerine düzenleme paneli açılsın */
  editInPlace?: boolean;
}

const NUMERIC = new Set(["money", "decimal", "integer", "percent"]);

export function EntityTable(props: EntityTableProps) {
  const { def } = props;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [navigating, startNav] = useTransition();
  const [search, setSearch] = useState(props.q);
  const [editing, setEditing] = useState<EntityRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  // ⌘K'dan "Yeni ..." ile gelindiyse formu aç
  useEffect(() => {
    if (params.get("yeni") === "1") {
      setEditing(null);
      setFormOpen(true);
    }
  }, [params]);

  function setParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("yeni");
    startNav(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  // Arama: yazmayı bırakınca 300 ms sonra sunucudan getir
  useEffect(() => {
    if (search === props.q) return;
    const t = setTimeout(() => setParams({ q: search, sayfa: null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Kolon tercihi tarayıcıda hatırlanır (sunucuda varsayılan çizilir, hidrasyondan sonra yüklenir)
  const storageKey = `pv:kolonlar:${def.key}`;
  const [visibility, setVisibility] = useState<VisibilityState>(() =>
    Object.fromEntries(def.fields.map((f) => [f.name, !!f.list])),
  );
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) setVisibility((base) => ({ ...base, ...JSON.parse(saved) }));
    } catch {
      /* gizli sekme vb. */
    }
    setPrefsLoaded(true);
  }, [storageKey]);
  useEffect(() => {
    if (!prefsLoaded) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(visibility));
    } catch {
      /* gizli sekme vb. */
    }
  }, [storageKey, visibility, prefsLoaded]);

  const columns = useMemo<ColumnDef<EntityRow>[]>(
    () =>
      def.fields.map((f) => ({
        id: f.name,
        header: f.label,
        cell: ({ row }) => <CellValue field={f} row={row.original} />,
        meta: { numeric: NUMERIC.has(f.type) },
      })),
    [def.fields],
  );

  // TanStack Table v8 React Compiler ile memoize edilemez; derleyici bu bileşeni atlar (beklenen durum)
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: props.rows,
    columns,
    state: { columnVisibility: visibility },
    onColumnVisibilityChange: setVisibility,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    getRowId: (r) => r.id,
  });

  function toggleSort(field: string) {
    if (props.sort === field) setParams({ sirala: field, yon: props.dir === "asc" ? "desc" : "asc" });
    else setParams({ sirala: field, yon: "asc" });
  }

  function openRow(row: EntityRow) {
    const href = entityDetailHref(def, row.id);
    if (href && !props.editInPlace) router.push(href);
    else {
      setEditing(row);
      setFormOpen(true);
    }
  }

  const from = props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1;
  const to = Math.min(props.page * props.pageSize, props.total);
  const pageCount = Math.max(1, Math.ceil(props.total / props.pageSize));
  const exportHref = `/api/export/${def.key}?${new URLSearchParams({
    ...(props.q ? { q: props.q } : {}),
    sirala: props.sort,
    yon: props.dir,
  }).toString()}`;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`${def.plural} içinde ara...`}
            className="pl-8"
          />
        </div>
        {navigating && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        <div className="flex-1" />
        {def.board && (
          <div className="flex rounded-md border bg-card p-0.5">
            <Button
              size="xs"
              variant={props.view === "tablo" ? "secondary" : "ghost"}
              onClick={() => setParams({ gorunum: null })}
            >
              <Table2 /> Tablo
            </Button>
            <Button
              size="xs"
              variant={props.view === "pano" ? "secondary" : "ghost"}
              onClick={() => setParams({ gorunum: "pano" })}
            >
              <KanbanSquare /> Pano
            </Button>
          </div>
        )}
        {props.view === "tablo" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 /> Kolonlar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Görünen kolonlar</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table.getAllLeafColumns().map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={col.getIsVisible()}
                  onCheckedChange={(v) => col.toggleVisibility(!!v)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {String(col.columnDef.header)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button variant="outline" size="sm" asChild>
          <a href={exportHref}>
            <Download /> Excel (CSV)
          </a>
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus /> Yeni {def.label.toLocaleLowerCase("tr-TR")}
        </Button>
      </div>

      {props.view === "pano" && def.board ? (
        <EntityBoard def={def} rows={props.rows} onOpen={openRow} />
      ) : props.rows.length === 0 ? (
        <EmptyState
          title={props.q ? "Aramanızla eşleşen kayıt yok" : `Henüz ${def.plural.toLocaleLowerCase("tr-TR")} yok`}
          description={props.q ? "Farklı bir kelimeyle deneyin." : "İlk kaydı oluşturarak başlayın."}
          action={
            !props.q && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus /> Yeni {def.label.toLocaleLowerCase("tr-TR")}
              </Button>
            )
          }
        />
      ) : (
        <Card className={cn("overflow-hidden py-0 transition-opacity", navigating && "opacity-60")}>
          <Table>
            <TableHeader className="bg-muted/40">
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="hover:bg-transparent">
                  {hg.headers.map((h) => {
                    const numeric = (h.column.columnDef.meta as { numeric?: boolean } | undefined)?.numeric;
                    const active = props.sort === h.column.id;
                    return (
                      <TableHead key={h.id} className={cn(numeric && "text-right")}>
                        <button
                          type="button"
                          onClick={() => toggleSort(h.column.id)}
                          className={cn(
                            "inline-flex items-center gap-1 hover:text-foreground",
                            active && "text-foreground",
                            numeric && "flex-row-reverse",
                          )}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {active &&
                            (props.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                        </button>
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => openRow(r.original)}>
                  {r.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {props.view === "tablo" && props.total > 0 && (
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {formatNumber(from, 0)}–{formatNumber(to, 0)} / {formatNumber(props.total, 0)} kayıt
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={props.page <= 1 || navigating}
              onClick={() => setParams({ sayfa: String(props.page - 1) })}
              aria-label="Önceki sayfa"
            >
              <ChevronLeft />
            </Button>
            <span className="px-2">
              {props.page} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={props.page >= pageCount || navigating}
              onClick={() => setParams({ sayfa: String(props.page + 1) })}
              aria-label="Sonraki sayfa"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}

      <EntityFormSheet
        def={def}
        row={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
        relationOptions={props.relationOptions}
        onSaved={(id) => {
          const href = entityDetailHref(def, id);
          if (!editing && href && !props.editInPlace) router.push(href);
        }}
      />
    </>
  );
}

export function EntityLinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={href}>{children}</Link>
    </Button>
  );
}
