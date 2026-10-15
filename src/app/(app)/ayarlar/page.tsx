import { and, asc, eq } from "drizzle-orm";
import { Lock } from "lucide-react";
import { PageHeader } from "@/components/page/page-header";
import { suspensePage } from "@/components/page/suspense-page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DOC_TYPES, formatDocNumber, isDocTypeKey, type DocTypeKey } from "@/lib/documents/types";
import { formatDate, formatNumber, todayIso } from "@/lib/format";
import { MODULES, PLANS, type PlanKey } from "@/lib/modules";
import { canManageCompany, ROLE_LABEL } from "@/lib/roles";
import { db } from "@/server/db";
import { member, numberSeries, tenantProfile, user } from "@/server/db/schema";
import { getTenantContext } from "@/server/session";
import { CompanyForm } from "./company-form";

export default suspensePage(async function SettingsPage() {
  const ctx = await getTenantContext();
  // Seri yılı belge tarihinin yılıdır; burada içinde bulunulan yıl gösterilir
  const year = Number(todayIso().slice(0, 4));
  const [profile, users, series] = await Promise.all([
    db.query.tenantProfile.findFirst({ where: eq(tenantProfile.tenantId, ctx.tenantId) }),
    db
      .select({ id: user.id, name: user.name, email: user.email, role: member.role, since: member.createdAt })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(member.organizationId, ctx.tenantId))
      .orderBy(asc(member.createdAt)),
    db
      .select()
      .from(numberSeries)
      .where(and(eq(numberSeries.tenantId, ctx.tenantId), eq(numberSeries.year, year))),
  ]);
  const canEdit = canManageCompany(ctx.role, ctx.isSuperAdmin);
  const plan = ctx.plan as PlanKey;
  const enabled = new Set(ctx.enabledModules);
  const docSeries = series
    .map((s) => ({ type: s.series.replace(/^belge:/, ""), issued: s.nextValue - 1 }))
    .filter((s): s is { type: DocTypeKey; issued: number } => isDocTypeKey(s.type) && s.issued > 0)
    .sort((a, b) => DOC_TYPES[a.type].label.localeCompare(DOC_TYPES[b.type].label, "tr"));

  return (
    <>
      <PageHeader title="Şirket Ayarları" description={`${ctx.tenantName} şirketinin bilgileri, paketi ve kullanıcıları.`} />

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Şirket bilgileri</CardTitle>
              <CardDescription>
                {canEdit
                  ? "Yazdırılan fatura, irsaliye ve tekliflerin üst kısmında bu bilgiler görünür."
                  : "Bu bilgileri yalnızca şirket sahibi veya yöneticisi değiştirebilir."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CompanyForm
                readOnly={!canEdit}
                initial={{
                  name: ctx.tenantName,
                  legalName: profile?.legalName ?? "",
                  taxOffice: profile?.taxOffice ?? "",
                  taxNumber: profile?.taxNumber ?? "",
                  address: profile?.address ?? "",
                  city: profile?.city ?? "",
                  phone: profile?.phone ?? "",
                  email: profile?.email ?? "",
                }}
              />
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle>Kullanıcılar</CardTitle>
              <CardDescription>
                {formatNumber(users.length)} / {formatNumber(profile?.userLimit ?? 0)} kullanıcı. Yeni kullanıcı ve rol değişikliği için Paventech
                destek ekibine yazın.
              </CardDescription>
            </CardHeader>
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Ad soyad</TableHead>
                  <TableHead>E-posta</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Eklenme</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.name}
                      {u.id === ctx.userId && <span className="ml-2 text-xs text-muted-foreground">(siz)</span>}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "member" ? "muted" : "info"}>{ROLE_LABEL[u.role] ?? u.role}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(u.since)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Paket <Badge variant="secondary">{PLANS[plan]?.label ?? plan}</Badge>
              </CardTitle>
              <CardDescription>
                {enabled.size} / {MODULES.length} modül açık. Modül açma ve paket değişikliği Paventech tarafından yapılır.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-3">
              <div className="flex flex-wrap gap-1.5">
                {MODULES.map((m) =>
                  enabled.has(m.key) ? (
                    <Badge key={m.key} variant={m.tier === "plus" ? "plus" : "secondary"}>
                      {m.short}
                    </Badge>
                  ) : (
                    <Badge key={m.key} variant="outline" className="text-muted-foreground">
                      <Lock /> {m.short}
                    </Badge>
                  ),
                )}
              </div>
              {(profile?.aiMonthlyCredits ?? 0) > 0 && (
                <p className="text-sm text-muted-foreground">Aylık AI kredisi: {formatNumber(profile?.aiMonthlyCredits ?? 0)}</p>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle>Belge numaraları ({year})</CardTitle>
              <CardDescription>Numara belge onaylanırken verilir; taslak silmek seride boşluk bırakmaz.</CardDescription>
            </CardHeader>
            {docSeries.length === 0 ? (
              <CardContent className="pt-0 text-sm text-muted-foreground">Bu yıl henüz onaylı belge yok.</CardContent>
            ) : (
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Belge</TableHead>
                    <TableHead>Son numara</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docSeries.map((s) => (
                    <TableRow key={s.type}>
                      <TableCell>{DOC_TYPES[s.type].label}</TableCell>
                      <TableCell className="font-mono text-xs">{formatDocNumber(DOC_TYPES[s.type].prefix, year, s.issued)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      </div>
    </>
  );
});
