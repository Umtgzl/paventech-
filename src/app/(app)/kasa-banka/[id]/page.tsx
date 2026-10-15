import Link from "next/link";
import { notFound } from "next/navigation";
import { EditEntityButton } from "@/components/entity/edit-entity-button";
import { EmptyState } from "@/components/page/empty-state";
import { PageHeader } from "@/components/page/page-header";
import { RowLink } from "@/components/page/row-link";
import { StatCard } from "@/components/page/stat-card";
import { suspensePage } from "@/components/page/suspense-page";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ENTITIES } from "@/lib/entities/registry";
import { formatDate, formatMoney } from "@/lib/format";
import { dec, sumDec } from "@/lib/money";
import { db } from "@/server/db";
import { getEntity } from "@/server/entities/service";
import { cashStatement } from "@/server/ledger/queries";
import { requireModule } from "@/server/session";

export default suspensePage(async function CashAccountPage(props: PageProps<"/kasa-banka/[id]">) {
  const { id } = await props.params;
  const ctx = await requireModule("kasa");
  const row = await getEntity(db, ctx.tenantId, "kasa-hesap", id);
  if (!row) notFound();
  const lines = await cashStatement(db, ctx.tenantId, id);
  const inflow = sumDec(lines.filter((l) => dec(l.amount).gt(0)).map((l) => l.amount));
  const outflow = sumDec(lines.filter((l) => dec(l.amount).lt(0)).map((l) => l.amount)).abs();
  const balance = inflow.minus(outflow);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Kasa & Banka", href: "/kasa-banka" }, { label: String(row.name) }]}
        title={String(row.name)}
        description={[row.code, row.bankName, row.iban].filter(Boolean).join(" · ")}
        actions={<EditEntityButton def={ENTITIES["kasa-hesap"]} row={row} />}
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Toplam giriş" value={formatMoney(inflow)} tone="success" />
        <StatCard label="Toplam çıkış" value={formatMoney(outflow)} />
        <StatCard label="Bakiye" value={formatMoney(balance)} tone={balance.lt(0) ? "danger" : "default"} />
      </div>
      {lines.length === 0 ? (
        <EmptyState title="Bu hesapta hareket yok" description="Tahsilat, ödeme ve masraf fişleri bu hesabı kullandıkça burada görünür." />
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead>Tarih</TableHead>
                <TableHead>Açıklama</TableHead>
                <TableHead>Cari</TableHead>
                <TableHead className="text-right">Giriş</TableHead>
                <TableHead className="text-right">Çıkış</TableHead>
                <TableHead className="text-right">Bakiye</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => {
                const a = dec(l.amount);
                const cells = (
                  <>
                    <TableCell>{formatDate(l.date)}</TableCell>
                    <TableCell className="max-w-80 truncate">{l.description}</TableCell>
                    <TableCell>
                      {l.partnerId ? (
                        <Link href={`/cari/${l.partnerId}`} className="hover:underline">
                          {l.partnerName}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="num text-success">{a.gt(0) ? formatMoney(l.amount) : ""}</TableCell>
                    <TableCell className="num">{a.lt(0) ? formatMoney(a.abs().toString()) : ""}</TableCell>
                    <TableCell className="num font-medium">{formatMoney(l.balance)}</TableCell>
                  </>
                );
                return l.documentId ? (
                  <RowLink key={l.id} href={`/belge/detay/${l.documentId}`}>
                    {cells}
                  </RowLink>
                ) : (
                  <TableRow key={l.id}>{cells}</TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
});
