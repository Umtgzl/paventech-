import { EmptyState } from "@/components/page/empty-state";
import { RowLink } from "@/components/page/row-link";
import { suspensePage } from "@/components/page/suspense-page";
import { PlusHeader } from "@/components/plus/plus-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format";
import { db } from "@/server/db";
import { listInbox } from "@/server/plus/inbox";
import { requireModule } from "@/server/session";

const STATUS = {
  yeni: { label: "Yeni", variant: "info" },
  islendi: { label: "Alışa aktarıldı", variant: "success" },
  reddedildi: { label: "Reddedildi", variant: "muted" },
} as const;

export default suspensePage(async function InboxPage() {
  const ctx = await requireModule("edonusum");
  const items = await listInbox(db, ctx.tenantId);
  return (
    <>
      <PlusHeader
        module="e-Dönüşüm"
        title="Gelen e-Faturalar"
        description="Tedarikçilerden gelen e-faturalar. Satırlar stok kartlarınızla otomatik eşleşir, alış faturası tek tıkla hazırlanır."
        note="Gelen kutusu örnek e-faturalarla dolu. Canlı sürümde e-faturalar özel entegratörden otomatik çekilecek (UBL-TR XML)."
      />
      {items.length === 0 ? (
        <EmptyState title="Gelen e-fatura yok" />
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead>Fatura no</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Tedarikçi</TableHead>
                <TableHead className="text-right">Satır</TableHead>
                <TableHead className="text-right">Tutar</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => {
                const st = STATUS[i.status as keyof typeof STATUS] ?? STATUS.yeni;
                return (
                  <RowLink key={i.id} href={`/plus/e-donusum/gelen/${i.id}`}>
                    <TableCell className="font-mono text-xs">{i.number}</TableCell>
                    <TableCell>{formatDate(i.date)}</TableCell>
                    <TableCell className="font-medium">
                      {i.supplierName}
                      <span className="ml-2 text-xs text-muted-foreground">VKN {i.supplierTaxNumber}</span>
                    </TableCell>
                    <TableCell className="num">{i.lines.length}</TableCell>
                    <TableCell className="num">{formatMoney(i.grandTotal)}</TableCell>
                    <TableCell>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </TableCell>
                  </RowLink>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
});
