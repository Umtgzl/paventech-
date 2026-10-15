import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { ArrowRight, BellRing, Zap } from "lucide-react";
import { EmptyState } from "@/components/page/empty-state";
import { suspensePage } from "@/components/page/suspense-page";
import { PlusHeader } from "@/components/plus/plus-header";
import { RuleSwitch } from "@/components/plus/rule-switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { db } from "@/server/db";
import { automationRules, notification } from "@/server/db/schema";
import { AUTOMATION_TEMPLATES } from "@/server/domain/automation";
import { requireModule } from "@/server/session";

export default suspensePage(async function AutomationPage() {
  const ctx = await requireModule("otomasyon");
  const [rules, recent] = await Promise.all([
    db.select().from(automationRules).where(eq(automationRules.tenantId, ctx.tenantId)),
    db
      .select()
      .from(notification)
      .where(and(eq(notification.tenantId, ctx.tenantId), eq(notification.kind, "kritik_stok")))
      .orderBy(desc(notification.createdAt))
      .limit(8),
  ]);
  const byTemplate = new Map(rules.map((r) => [r.template, r]));

  return (
    <>
      <PlusHeader
        module="Otomasyon"
        title="Otomasyon Kuralları"
        description="“Şu olunca şunu yap” kuralları. Onaylanan belgeler ve stok hareketleri kuralları kendiliğinden tetikler."
        note="Prototipte kritik stok kuralı gerçekten çalışır: stok kritik seviyeye inince bildirim zilinde uyarı çıkar. Diğer şablonlar canlı sürümde e-posta, SMS ve WhatsApp sağlayıcılarıyla devreye girecek."
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-3">
          {AUTOMATION_TEMPLATES.map((t) => {
            const enabled = byTemplate.get(t.template)?.enabled ?? false;
            const lastRun = t.template === "kritik_stok" ? recent[0]?.createdAt : undefined;
            return (
              <Card key={t.template} className={cn(!t.live && "bg-muted/30")}>
                <CardContent className="flex items-start gap-4">
                  <div
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg",
                      t.live ? "bg-plus/10 text-plus" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Zap className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{t.name}</span>
                      {t.live ? (
                        enabled ? (
                          <Badge variant="success">Açık</Badge>
                        ) : (
                          <Badge variant="muted">Kapalı</Badge>
                        )
                      ) : (
                        <Badge variant="muted">Yakında</Badge>
                      )}
                    </div>
                    <div className="mt-2 grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-3">
                      <span className="text-muted-foreground">Ne zaman</span>
                      <span>{t.trigger}</span>
                      <span className="text-muted-foreground">Ne yapar</span>
                      <span>{t.action}</span>
                    </div>
                    {lastRun && <p className="mt-2 text-xs text-muted-foreground">Son tetiklenme: {formatDateTime(lastRun)}</p>}
                  </div>
                  <RuleSwitch template={t.template} name={t.name} enabled={enabled} live={t.live} />
                </CardContent>
              </Card>
            );
          })}

          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Kendi kuralınızı kurun <Badge variant="muted">Sıradaki adım</Badge>
              </CardTitle>
              <CardDescription>Olay, şart ve aksiyonu seçerek kural yazılır; kod gerekmez.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-md border bg-card px-2.5 py-1">Satış faturası onaylandığında</span>
              <ArrowRight className="size-4 text-muted-foreground" />
              <span className="rounded-md border bg-card px-2.5 py-1">tutar 100.000 ₺ üstündeyse</span>
              <ArrowRight className="size-4 text-muted-foreground" />
              <span className="rounded-md border bg-card px-2.5 py-1">yöneticiye bildirim gönder</span>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="size-4 text-plus" /> Kuralların ürettiği son bildirimler
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            {recent.length === 0 ? (
              <EmptyState title="Henüz bildirim yok" description="Kural tetiklendiğinde bildirimler burada listelenir." />
            ) : (
              <ul className="flex flex-col divide-y">
                {recent.map((n) => (
                  <li key={n.id} className="py-2.5 first:pt-0 last:pb-0">
                    <Link href={n.href ?? "#"} className="group flex flex-col gap-0.5">
                      <span className="flex items-center gap-2 text-sm font-medium group-hover:text-primary">
                        {!n.readAt && <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label="Okunmadı" />}
                        {n.title}
                      </span>
                      {n.body && <span className="text-xs text-muted-foreground">{n.body}</span>}
                      <span className="text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
});
