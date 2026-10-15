import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/page/page-header";
import { suspensePage } from "@/components/page/suspense-page";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { MODULES, PLANS, type PlanKey } from "@/lib/modules";
import { db } from "@/server/db";
import { organization, tenantModule, tenantProfile } from "@/server/db/schema";
import { countMembers } from "@/server/domain/tenants";
import { requireSuperAdmin } from "@/server/session";
import { NewTenantDialog } from "./new-tenant-dialog";

export default suspensePage(async function SuperAdminPage() {
  await requireSuperAdmin();

  const tenants = await db
    .select({
      id: organization.id,
      name: organization.name,
      createdAt: organization.createdAt,
      plan: tenantProfile.plan,
      sector: tenantProfile.sector,
      isActive: tenantProfile.isActive,
      userLimit: tenantProfile.userLimit,
    })
    .from(organization)
    .leftJoin(tenantProfile, eq(tenantProfile.tenantId, organization.id))
    .orderBy(desc(organization.createdAt));

  const [members, modules] = await Promise.all([
    countMembers(db, tenants.map((t) => t.id)),
    db.select().from(tenantModule).where(eq(tenantModule.enabled, true)),
  ]);
  const plusKeys = new Set(MODULES.filter((m) => m.tier === "plus").map((m) => m.key));
  const moduleCount = new Map<string, { std: number; plus: number }>();
  for (const m of modules) {
    const c = moduleCount.get(m.tenantId) ?? { std: 0, plus: 0 };
    if (plusKeys.has(m.moduleKey as never)) c.plus++;
    else c.std++;
    moduleCount.set(m.tenantId, c);
  }

  return (
    <>
      <PageHeader
        title="Şirketler"
        description="Müşteri şirketlerini açın, paketlerini ve modüllerini yönetin."
        actions={<NewTenantDialog />}
      />
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Şirket</TableHead>
              <TableHead>Paket</TableHead>
              <TableHead>Sektör</TableHead>
              <TableHead className="text-right">Kullanıcı</TableHead>
              <TableHead className="text-right">Modül</TableHead>
              <TableHead>Açılış</TableHead>
              <TableHead>Durum</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((t) => {
              const c = moduleCount.get(t.id) ?? { std: 0, plus: 0 };
              return (
                <TableRow key={t.id}>
                  <TableCell>
                    <Link href={`/super-admin/sirket/${t.id}`} className="font-medium text-primary hover:underline">
                      {t.name}
                    </Link>
                  </TableCell>
                  <TableCell>{PLANS[(t.plan ?? "baslangic") as PlanKey]?.label ?? t.plan}</TableCell>
                  <TableCell className="capitalize">{t.sector}</TableCell>
                  <TableCell className="num">
                    {members.get(t.id) ?? 0} / {t.userLimit ?? "-"}
                  </TableCell>
                  <TableCell className="num">
                    {c.std}
                    {c.plus > 0 && <span className="ml-1 text-plus">+{c.plus} Plus</span>}
                  </TableCell>
                  <TableCell>{formatDate(t.createdAt)}</TableCell>
                  <TableCell>
                    {t.isActive === false ? <Badge variant="danger">Pasif</Badge> : <Badge variant="success">Aktif</Badge>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
});
