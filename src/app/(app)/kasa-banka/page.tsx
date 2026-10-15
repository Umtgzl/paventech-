import Link from "next/link";
import { ArrowLeftRight, CreditCard, HandCoins, Landmark, Wallet } from "lucide-react";
import { NewEntityButton } from "@/components/entity/edit-entity-button";
import { PageHeader } from "@/components/page/page-header";
import { StatCard } from "@/components/page/stat-card";
import { suspensePage } from "@/components/page/suspense-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ENTITIES } from "@/lib/entities/registry";
import { formatMoney } from "@/lib/format";
import { dec, sumDec } from "@/lib/money";
import { db } from "@/server/db";
import { cashBalances } from "@/server/ledger/queries";
import { requireModule } from "@/server/session";

const KIND = {
  kasa: { label: "Kasa", icon: Wallet },
  banka: { label: "Banka", icon: Landmark },
  pos: { label: "POS", icon: CreditCard },
  kredi_karti: { label: "Kredi kartı", icon: CreditCard },
} as const;

export default suspensePage(async function CashPage() {
  const ctx = await requireModule("kasa");
  const accounts = await cashBalances(db, ctx.tenantId);
  const total = sumDec(accounts.map((a) => a.balance));
  const byKind = (...kinds: string[]) => sumDec(accounts.filter((a) => kinds.includes(a.kind)).map((a) => a.balance));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Kasa & Banka" }, { label: "Hesaplar" }]}
        title="Kasa ve Banka Hesapları"
        description="Bakiyeler tahsilat, ödeme, masraf ve virman fişlerinden anlık hesaplanır."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/belge/virman/yeni">
                <ArrowLeftRight /> Virman
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/belge/odeme/yeni">Ödeme yap</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/belge/tahsilat/yeni">
                <HandCoins /> Tahsilat al
              </Link>
            </Button>
            <NewEntityButton def={ENTITIES["kasa-hesap"]} label="Yeni hesap" />
          </>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Toplam nakit varlık" value={formatMoney(total)} tone={total.lt(0) ? "danger" : "default"} />
        <StatCard label="Kasalar" value={formatMoney(byKind("kasa"))} />
        <StatCard label="Banka, POS ve kart" value={formatMoney(byKind("banka", "pos", "kredi_karti"))} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a) => {
          const k = KIND[a.kind as keyof typeof KIND] ?? KIND.kasa;
          const Icon = k.icon;
          const b = dec(a.balance);
          return (
            <Link key={a.id} href={`/kasa-banka/${a.id}`}>
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardContent className="flex flex-col gap-3 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{a.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {k.label}
                        {a.bankName && ` · ${a.bankName}`} · {a.code}
                      </p>
                    </div>
                    {!a.isActive && <Badge variant="muted">Pasif</Badge>}
                  </div>
                  <p className={`text-2xl font-semibold tabular-nums ${b.lt(0) ? "text-destructive" : ""}`}>{formatMoney(a.balance, a.currency)}</p>
                  {a.iban && <p className="truncate font-mono text-[11px] text-muted-foreground">{a.iban}</p>}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
});
