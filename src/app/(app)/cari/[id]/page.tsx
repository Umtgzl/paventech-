import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { FileText, HandCoins, Receipt, ShoppingCart, Truck } from "lucide-react";
import { DocStatusBadge } from "@/components/documents/status-badge";
import { CellValue } from "@/components/entity/cell-value";
import { EditEntityButton } from "@/components/entity/edit-entity-button";
import { EmptyState } from "@/components/page/empty-state";
import { PageHeader } from "@/components/page/page-header";
import { RowLink } from "@/components/page/row-link";
import { StatCard } from "@/components/page/stat-card";
import { suspensePage } from "@/components/page/suspense-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DOC_TYPES, isDocTypeKey } from "@/lib/documents/types";
import { ENTITIES, PARTNER_KIND } from "@/lib/entities/registry";
import { formatDate, formatMoney, todayIso } from "@/lib/format";
import { dec } from "@/lib/money";
import { db } from "@/server/db";
import { documents } from "@/server/db/schema";
import { getEntity } from "@/server/entities/service";
import { partnerBalance, partnerStatement } from "@/server/ledger/queries";
import { hasModule, requireModule } from "@/server/session";

export default suspensePage(async function CariDetailPage(props: PageProps<"/cari/[id]">) {
  const { id } = await props.params;
  const ctx = await requireModule("cari");
  const row = await getEntity(db, ctx.tenantId, "cari", id);
  if (!row) notFound();
  const today = todayIso();

  const [balance, statement, docs] = await Promise.all([
    partnerBalance(db, ctx.tenantId, id, today),
    partnerStatement(db, ctx.tenantId, id),
    db
      .select({
        id: documents.id,
        type: documents.type,
        number: documents.number,
        status: documents.status,
        date: documents.date,
        grandTotal: documents.grandTotal,
      })
      .from(documents)
      .where(and(eq(documents.tenantId, ctx.tenantId), eq(documents.partnerId, id)))
      .orderBy(desc(documents.date), desc(documents.createdAt))
      .limit(50),
  ]);

  const kind = String(row.kind);
  const isCustomer = kind !== "tedarikci";
  const isSupplier = kind !== "musteri";
  const bal = dec(balance.balance);
  const kindOpt = PARTNER_KIND.find((k) => k.value === kind);
  const def = ENTITIES.cari;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Cari Hesaplar", href: "/cari" }, { label: String(row.name) }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {String(row.name)}
            <Badge variant={kindOpt?.tone ?? "secondary"}>{kindOpt?.label}</Badge>
            {!row.isActive && <Badge variant="muted">Pasif</Badge>}
          </span>
        }
        description={[row.code, row.city, row.phone].filter(Boolean).join(" · ")}
        actions={
          <>
            <EditEntityButton def={def} row={row} />
            {isCustomer && hasModule(ctx, "satis") && (
              <Button variant="outline" asChild>
                <Link href={`/belge/satis-faturasi/yeni?cari=${id}`}>
                  <ShoppingCart /> Satış faturası
                </Link>
              </Button>
            )}
            {isSupplier && hasModule(ctx, "satinalma") && (
              <Button variant="outline" asChild>
                <Link href={`/belge/alis-faturasi/yeni?cari=${id}`}>
                  <Truck /> Alış faturası
                </Link>
              </Button>
            )}
            {hasModule(ctx, "kasa") && (
              <Button asChild>
                <Link href={`/belge/${isCustomer ? "tahsilat" : "odeme"}/yeni?cari=${id}`}>
                  <HandCoins /> {isCustomer ? "Tahsilat al" : "Ödeme yap"}
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Toplam borç" value={formatMoney(balance.debit)} hint="Faturalar, ödemeler" />
        <StatCard label="Toplam alacak" value={formatMoney(balance.credit)} hint="Tahsilatlar, alış faturaları" />
        <StatCard
          label="Bakiye"
          value={formatMoney(bal.abs().toString())}
          tone={bal.gt(0) ? "warning" : bal.lt(0) ? "success" : "default"}
          hint={bal.gt(0) ? "Cari bize borçlu" : bal.lt(0) ? "Biz cariye borçluyuz" : "Hesap kapalı"}
        />
        <StatCard
          label="Vadesi geçen"
          value={formatMoney(balance.overdue)}
          tone={dec(balance.overdue).gt(0) ? "danger" : "default"}
          hint={`Vade: ${row.paymentTermDays} gün`}
        />
      </div>

      <Tabs defaultValue="ekstre">
        <TabsList>
          <TabsTrigger value="ekstre">
            <Receipt className="size-4" /> Ekstre
          </TabsTrigger>
          <TabsTrigger value="belgeler">
            <FileText className="size-4" /> Belgeler ({docs.length})
          </TabsTrigger>
          <TabsTrigger value="bilgiler">Kart bilgileri</TabsTrigger>
        </TabsList>

        <TabsContent value="ekstre">
          {statement.length === 0 ? (
            <EmptyState title="Henüz hareket yok" description="Onaylanan fatura, tahsilat ve ödemeler burada listelenir." />
          ) : (
            <Card className="overflow-hidden py-0">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Tarih</TableHead>
                    <TableHead>Açıklama</TableHead>
                    <TableHead>Vade</TableHead>
                    <TableHead className="text-right">Borç</TableHead>
                    <TableHead className="text-right">Alacak</TableHead>
                    <TableHead className="text-right">Bakiye</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statement.map((s) => {
                    const b = dec(s.balance);
                    const content = (
                      <>
                        <TableCell>{formatDate(s.date)}</TableCell>
                        <TableCell className="max-w-80 truncate">{s.description}</TableCell>
                        <TableCell className="text-muted-foreground">{dec(s.debit).gt(0) ? formatDate(s.dueDate) : ""}</TableCell>
                        <TableCell className="num">{dec(s.debit).gt(0) ? formatMoney(s.debit) : ""}</TableCell>
                        <TableCell className="num">{dec(s.credit).gt(0) ? formatMoney(s.credit) : ""}</TableCell>
                        <TableCell className="num font-medium">
                          {formatMoney(b.abs().toString())}{" "}
                          <span className="text-xs text-muted-foreground">{b.gt(0) ? "B" : b.lt(0) ? "A" : ""}</span>
                        </TableCell>
                      </>
                    );
                    return s.documentId ? (
                      <RowLink key={s.id} href={`/belge/detay/${s.documentId}`}>
                        {content}
                      </RowLink>
                    ) : (
                      <TableRow key={s.id}>{content}</TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="belgeler">
          {docs.length === 0 ? (
            <EmptyState title="Bu cariye ait belge yok" />
          ) : (
            <Card className="overflow-hidden py-0">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Tür</TableHead>
                    <TableHead>Belge no</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead className="text-right">Tutar</TableHead>
                    <TableHead>Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map((d) => (
                    <RowLink key={d.id} href={`/belge/detay/${d.id}`}>
                      <TableCell>{isDocTypeKey(d.type) ? DOC_TYPES[d.type].label : d.type}</TableCell>
                      <TableCell className="font-mono text-xs">{d.number ?? "Taslak"}</TableCell>
                      <TableCell>{formatDate(d.date)}</TableCell>
                      <TableCell className="num">{formatMoney(d.grandTotal)}</TableCell>
                      <TableCell>
                        <DocStatusBadge status={d.status} />
                      </TableCell>
                    </RowLink>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="bilgiler">
          <Card>
            <CardContent className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {def.fields
                .filter((f) => f.name !== "name")
                .map((f) => (
                  <div key={f.name}>
                    <span className="block text-xs text-muted-foreground">{f.label}</span>
                    <CellValue field={f} row={row} />
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
});
