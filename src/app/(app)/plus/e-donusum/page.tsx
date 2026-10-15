import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Inbox } from "lucide-react";
import { EStatusBadge } from "@/components/documents/status-badge";
import { RowLink } from "@/components/page/row-link";
import { StatCard } from "@/components/page/stat-card";
import { suspensePage } from "@/components/page/suspense-page";
import { PlusHeader } from "@/components/plus/plus-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DOC_TYPES, isDocTypeKey } from "@/lib/documents/types";
import { formatDate, formatMoney } from "@/lib/format";
import { db } from "@/server/db";
import { documents, partners } from "@/server/db/schema";
import { requireModule } from "@/server/session";

export default suspensePage(async function OutgoingEDocsPage() {
  const ctx = await requireModule("edonusum");
  const rows = await db
    .select({
      id: documents.id,
      type: documents.type,
      number: documents.number,
      date: documents.date,
      total: documents.grandTotal,
      eStatus: documents.eStatus,
      partnerName: partners.name,
      taxNumber: partners.taxNumber,
    })
    .from(documents)
    .leftJoin(partners, eq(partners.id, documents.partnerId))
    .where(and(eq(documents.tenantId, ctx.tenantId), eq(documents.status, "onayli"), inArray(documents.type, ["satis_fatura", "satis_irsaliye"])))
    .orderBy(desc(documents.date))
    .limit(100);
  const count = (s: string | null) => rows.filter((r) => r.eStatus === s).length;

  return (
    <>
      <PlusHeader
        module="e-Dönüşüm"
        title="Giden e-Belgeler"
        description="Onaylı satış faturaları ve irsaliyelerin e-Fatura / e-Arşiv / e-İrsaliye durumu."
        note="Gönderim simüle edilir. Canlı sürümde belge UBL-TR XML olarak üretilip seçilen özel entegratörün API'si üzerinden GİB'e iletilecek; alıcının e-Fatura mükellefiyeti otomatik sorgulanıp e-Fatura veya e-Arşiv seçilecek."
        actions={
          <Button variant="outline" asChild>
            <Link href="/plus/e-donusum/gelen">
              <Inbox /> Gelen e-faturalar
            </Link>
          </Button>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Gönderilmedi" value={count(null)} tone={count(null) > 0 ? "warning" : "default"} hint="Onaylı ama entegratöre iletilmemiş" />
        <StatCard label="Gönderildi" value={count("gonderildi")} hint="Alıcı yanıtı bekleniyor" />
        <StatCard label="Kabul edildi" value={count("kabul")} tone="success" />
      </div>
      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead>Belge</TableHead>
              <TableHead>Numara</TableHead>
              <TableHead>Tarih</TableHead>
              <TableHead>Alıcı</TableHead>
              <TableHead className="text-right">Tutar</TableHead>
              <TableHead>e-Durum</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <RowLink key={r.id} href={`/belge/detay/${r.id}`}>
                <TableCell>{isDocTypeKey(r.type) ? (r.type === "satis_irsaliye" ? "e-İrsaliye" : "e-Fatura / e-Arşiv") : r.type}</TableCell>
                <TableCell className="font-mono text-xs">{r.number}</TableCell>
                <TableCell>{formatDate(r.date)}</TableCell>
                <TableCell className="font-medium">
                  {r.partnerName}
                  {r.taxNumber && <span className="ml-2 text-xs text-muted-foreground">VKN {r.taxNumber}</span>}
                </TableCell>
                <TableCell className="num">{isDocTypeKey(r.type) && DOC_TYPES[r.type].priced ? formatMoney(r.total) : "—"}</TableCell>
                <TableCell>
                  <EStatusBadge status={r.eStatus} />
                </TableCell>
              </RowLink>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
});
