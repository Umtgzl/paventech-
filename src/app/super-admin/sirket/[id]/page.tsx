import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/page/page-header";
import { suspensePage } from "@/components/page/suspense-page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { MODULES, PLANS, type PlanKey } from "@/lib/modules";
import { ROLE_LABEL } from "@/lib/roles";
import { db } from "@/server/db";
import { member, organization, tenantModule, tenantProfile, user } from "@/server/db/schema";
import { requireSuperAdmin } from "@/server/session";
import { AddUserForm, EnterTenantButton, ModuleSwitches, PlanPicker, ProfileForm } from "./tenant-admin-forms";

export default suspensePage(async function TenantAdminPage(props: PageProps<"/super-admin/sirket/[id]">) {
  await requireSuperAdmin();
  const { id } = await props.params;

  const org = await db.query.organization.findFirst({ where: eq(organization.id, id) });
  if (!org) notFound();

  const [profile, modules, users] = await Promise.all([
    db.query.tenantProfile.findFirst({ where: eq(tenantProfile.tenantId, id) }),
    db.select().from(tenantModule).where(eq(tenantModule.tenantId, id)),
    db
      .select({ id: user.id, name: user.name, email: user.email, role: member.role, since: member.createdAt, platformRole: user.role })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(member.organizationId, id))
      .orderBy(member.createdAt),
  ]);

  const enabled = modules.filter((m) => m.enabled).map((m) => m.moduleKey);
  const plan = (profile?.plan ?? "baslangic") as PlanKey;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Şirketler", href: "/super-admin" }, { label: org.name }]}
        title={
          <span className="flex items-center gap-2">
            {org.name}
            <Badge variant="secondary">{PLANS[plan]?.label ?? plan}</Badge>
            {profile?.isActive === false && <Badge variant="danger">Pasif</Badge>}
          </span>
        }
        description={`Açılış: ${formatDate(org.createdAt)} · ${enabled.length} / ${MODULES.length} modül açık`}
        actions={<EnterTenantButton tenantId={id} />}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Modüller</CardTitle>
              <CardDescription>
                Açılan modül müşterinin menüsünde anında belirir. Bağımlı modüller otomatik açılır/kapanır.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PlanPicker tenantId={id} current={plan} />
              <ModuleSwitches tenantId={id} enabled={enabled} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kullanıcılar</CardTitle>
              <CardDescription>
                {users.length} / {profile?.userLimit ?? "-"} kullanıcı
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad</TableHead>
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
                        {u.platformRole === "admin" && (
                          <Badge variant="plus" className="ml-2">
                            Paventech
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{ROLE_LABEL[u.role] ?? u.role}</TableCell>
                      <TableCell>{formatDate(u.since)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <AddUserForm tenantId={id} />
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Şirket bilgileri ve kotalar</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm
              tenantId={id}
              initial={{
                name: org.name,
                legalName: profile?.legalName ?? "",
                taxOffice: profile?.taxOffice ?? "",
                taxNumber: profile?.taxNumber ?? "",
                city: profile?.city ?? "",
                sector: profile?.sector ?? "genel",
                userLimit: profile?.userLimit ?? 5,
                aiMonthlyCredits: profile?.aiMonthlyCredits ?? 0,
                showLockedModules: profile?.showLockedModules ?? true,
                isActive: profile?.isActive ?? true,
              }}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
});
