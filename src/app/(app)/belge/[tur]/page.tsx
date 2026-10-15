import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { DocStatusBadge, EStatusBadge } from "@/components/documents/status-badge";
import { EmptyState } from "@/components/page/empty-state";
import { ListToolbar } from "@/components/page/list-toolbar";
import { PageHeader } from "@/components/page/page-header";
import { Pagination } from "@/components/page/pagination";
import { RowLink } from "@/components/page/row-link";
import { suspensePage } from "@/components/page/suspense-page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { docTypeBySlug } from "@/lib/documents/types";
import { formatDate, formatMoney } from "@/lib/format";
import { MODULE_MAP } from "@/lib/modules";
import { db } from "@/server/db";
import { listDocuments } from "@/server/documents/queries";
import { hasModule, requireModule } from "@/server/session";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default suspensePage(async function DocumentListPage(props: PageProps<"/belge/[tur]">) {
  const { tur } = await props.params;
  const def = docTypeBySlug(tur);
  if (!def) notFound();
  const ctx = await requireModule(def.module);
  const sp = await props.searchParams;
  const status = one(sp.durum);
  const list = await listDocuments(db, ctx.tenantId, def.key, {
    q: one(sp.q),
    status: status && ["taslak", "onayli", "iptal"].includes(status) ? status : undefined,
    page: Number(one(sp.sayfa) ?? "1") || 1,
  });
  const showE = def.eDocument && hasModule(ctx, "edonusum");

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: MODULE_MAP[def.module].short }, { label: def.plural }]}
        title={def.plural}
        description={
          def.stock !== 0 || def.partnerEffect || def.cash !== 0
            ? "Onaylanan belgeler stok, cari ve kasa hareketlerini otomatik oluşturur."
            : "Bu belge stoğa ve cariye dokunmaz; onaylanınca bir sonraki belgeye dönüştürülebilir."
        }
        actions={
          <Button asChild>
            <Link href={`/belge/${def.slug}/yeni`}>
              <Plus /> Yeni {def.label.toLocaleLowerCase("tr-TR")}
            </Link>
          </Button>
        }
      />
      <ListToolbar
        placeholder="Belge no, cari veya açıklama..."
        tabs={[
          { value: "", label: "Tümü" },
          { value: "taslak", label: "Taslak" },
          { value: "onayli", label: "Onaylı" },
          { value: "iptal", label: "İptal" },
        ]}
      >
        {def.priced && list.total > 0 && (
          <span className="text-sm text-muted-foreground">
            Onaylı toplam: <span className="font-semibold text-foreground tabular-nums">{formatMoney(list.approvedSum)}</span>
          </span>
        )}
      </ListToolbar>

      {list.rows.length === 0 ? (
        <EmptyState
          title={one(sp.q) || status ? "Eşleşen belge yok" : `Henüz ${def.label.toLocaleLowerCase("tr-TR")} yok`}
          description="Yeni belge oluşturabilir ya da önceki bir belgeden dönüştürebilirsiniz."
          action={
            <Button asChild>
              <Link href={`/belge/${def.slug}/yeni`}>
                <Plus /> Yeni {def.label.toLocaleLowerCase("tr-TR")}
              </Link>
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead>Belge no</TableHead>
                <TableHead>Tarih</TableHead>
                {def.partner !== "yok" && <TableHead>Cari</TableHead>}
                {def.hasDueDate && <TableHead>Vade</TableHead>}
                {def.priced && <TableHead className="text-right">Tutar</TableHead>}
                <TableHead>Durum</TableHead>
                {showE && <TableHead>e-Belge</TableHead>}
                <TableHead>Açıklama</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.rows.map((r) => (
                <RowLink key={r.id} href={`/belge/detay/${r.id}`}>
                  <TableCell className="font-mono text-xs">{r.number ?? <span className="text-muted-foreground">Taslak</span>}</TableCell>
                  <TableCell>{formatDate(r.date)}</TableCell>
                  {def.partner !== "yok" && <TableCell className="max-w-64 truncate font-medium">{r.partnerName ?? "—"}</TableCell>}
                  {def.hasDueDate && <TableCell>{formatDate(r.dueDate)}</TableCell>}
                  {def.priced && <TableCell className="num font-medium">{formatMoney(r.grandTotal)}</TableCell>}
                  <TableCell>
                    <DocStatusBadge status={r.status} />
                  </TableCell>
                  {showE && <TableCell>{r.status === "onayli" ? <EStatusBadge status={r.eStatus} /> : null}</TableCell>}
                  <TableCell className="max-w-56 truncate text-muted-foreground">{r.notes}</TableCell>
                </RowLink>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <Pagination page={list.page} pageSize={list.pageSize} total={list.total} />
    </>
  );
});
