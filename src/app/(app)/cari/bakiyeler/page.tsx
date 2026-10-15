import { EmptyState } from "@/components/page/empty-state";
import { ListToolbar } from "@/components/page/list-toolbar";
import { PageHeader } from "@/components/page/page-header";
import { RowLink } from "@/components/page/row-link";
import { StatCard } from "@/components/page/stat-card";
import { suspensePage } from "@/components/page/suspense-page";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PARTNER_KIND } from "@/lib/entities/registry";
import { formatMoney, todayIso } from "@/lib/format";
import { dec, sumDec } from "@/lib/money";
import { db } from "@/server/db";
import { partnerBalances } from "@/server/ledger/queries";
import { requireModule } from "@/server/session";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default suspensePage(async function BalancesPage(props: PageProps<"/cari/bakiyeler">) {
  const ctx = await requireModule("cari");
  const sp = await props.searchParams;
  const filter = one(sp.durum);
  const all = await partnerBalances(db, ctx.tenantId, todayIso(), { q: one(sp.q) });
  const rows = all.filter((r) => {
    const b = dec(r.balance);
    if (filter === "borclu") return b.gt(0);
    if (filter === "alacakli") return b.lt(0);
    if (filter === "vadesi-gecen") return dec(r.overdue).gt(0);
    return !b.isZero() || filter === "tumu";
  });

  const receivable = sumDec(all.filter((r) => dec(r.balance).gt(0)).map((r) => r.balance));
  const payable = sumDec(all.filter((r) => dec(r.balance).lt(0)).map((r) => r.balance)).abs();
  const overdue = sumDec(all.map((r) => r.overdue));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Cari Hesaplar", href: "/cari" }, { label: "Bakiyeler" }]}
        title="Cari Bakiyeler"
        description="Vadesi geçen tutar, tahsilatların en eski borçları kapattığı (FIFO) varsayımıyla hesaplanır."
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Toplam alacağımız" value={formatMoney(receivable)} tone="warning" hint="Müşterilerin bize borcu" />
        <StatCard label="Toplam borcumuz" value={formatMoney(payable)} hint="Tedarikçilere borcumuz" />
        <StatCard label="Vadesi geçen alacak" value={formatMoney(overdue)} tone={overdue.gt(0) ? "danger" : "default"} />
      </div>
      <ListToolbar
        placeholder="Cari adı veya kodu..."
        tabs={[
          { value: "", label: "Açık hesaplar" },
          { value: "borclu", label: "Borçlu" },
          { value: "alacakli", label: "Alacaklı" },
          { value: "vadesi-gecen", label: "Vadesi geçen" },
          { value: "tumu", label: "Tümü" },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState title="Listelenecek cari yok" />
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead>Kod</TableHead>
                <TableHead>Cari</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead className="text-right">Borç</TableHead>
                <TableHead className="text-right">Alacak</TableHead>
                <TableHead className="text-right">Bakiye</TableHead>
                <TableHead className="text-right">Vadesi geçen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const b = dec(r.balance);
                const k = PARTNER_KIND.find((x) => x.value === r.kind);
                return (
                  <RowLink key={r.id} href={`/cari/${r.id}`}>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>
                      <Badge variant={k?.tone ?? "secondary"}>{k?.label}</Badge>
                    </TableCell>
                    <TableCell className="num">{formatMoney(r.debit)}</TableCell>
                    <TableCell className="num">{formatMoney(r.credit)}</TableCell>
                    <TableCell className={`num font-medium ${b.gt(0) ? "text-warning-foreground" : b.lt(0) ? "text-success" : ""}`}>
                      {formatMoney(b.abs().toString())} {b.gt(0) ? "B" : b.lt(0) ? "A" : ""}
                    </TableCell>
                    <TableCell className={`num ${dec(r.overdue).gt(0) ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                      {dec(r.overdue).gt(0) ? formatMoney(r.overdue) : "—"}
                    </TableCell>
                  </RowLink>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>Toplam ({rows.length} cari)</TableCell>
                <TableCell className="num">{formatMoney(sumDec(rows.map((r) => r.debit)))}</TableCell>
                <TableCell className="num">{formatMoney(sumDec(rows.map((r) => r.credit)))}</TableCell>
                <TableCell className="num">{formatMoney(sumDec(rows.map((r) => r.balance)))}</TableCell>
                <TableCell className="num">{formatMoney(sumDec(rows.map((r) => r.overdue)))}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Card>
      )}
    </>
  );
});
